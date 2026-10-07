ALTER TABLE public.fixed_assets
  ADD COLUMN IF NOT EXISTS disposal_date date,
  ADD COLUMN IF NOT EXISTS disposal_type text,
  ADD COLUMN IF NOT EXISTS disposal_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS disposal_gain_loss numeric,
  ADD COLUMN IF NOT EXISTS disposal_journal_entry_id uuid,
  ADD COLUMN IF NOT EXISTS disposal_notes text;

CREATE OR REPLACE FUNCTION public.post_asset_depreciation(_schedule_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  s RECORD; a RECORD; _entry_id UUID; _entry_number TEXT; _branch_id UUID; _exp_acc UUID; _dep_acc UUID;
BEGIN
  SELECT * INTO s FROM public.asset_depreciation_schedule WHERE id = _schedule_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'قسط الإهلاك غير موجود'; END IF;
  IF s.is_posted THEN RAISE EXCEPTION 'مرحّل مسبقاً'; END IF;
  SELECT * INTO a FROM public.fixed_assets WHERE id = s.asset_id FOR UPDATE;
  IF a.status = 'disposed' THEN RAISE EXCEPTION 'الأصل مستبعد ولا يمكن إهلاكه'; END IF;
  IF EXISTS (SELECT 1 FROM public.asset_depreciation_schedule WHERE asset_id = a.id AND is_posted = false AND period_date < s.period_date) THEN
    RAISE EXCEPTION 'يجب ترحيل الأقساط السابقة أولاً';
  END IF;
  IF s.period_date > CURRENT_DATE THEN RAISE EXCEPTION 'لا يمكن ترحيل قسط مستقبلي'; END IF;
  _exp_acc := COALESCE(a.expense_account_id, (SELECT setting_value::uuid FROM public.system_settings WHERE setting_key = 'default_depreciation_expense_account_id' AND setting_value <> ''));
  _dep_acc := COALESCE(a.depreciation_account_id, (SELECT setting_value::uuid FROM public.system_settings WHERE setting_key = 'default_accumulated_depreciation_account_id' AND setting_value <> ''));
  IF _exp_acc IS NULL OR _dep_acc IS NULL THEN RAISE EXCEPTION 'حدد حساب مصروف الإهلاك وحساب مجمع الإهلاك في بطاقة الأصل'; END IF;
  _branch_id := COALESCE(a.branch_id, (SELECT id FROM public.branches WHERE is_active = true ORDER BY created_at LIMIT 1));
  _entry_number := 'JE-DEP-' || to_char(s.period_date,'YYYYMM') || '-' || substr(replace(s.id::text,'-',''),1,6);
  INSERT INTO public.journal_entries (entry_number, entry_date, description, reference, branch_id, created_by, is_posted)
  VALUES (_entry_number, s.period_date, 'إهلاك ' || a.name || ' - ' || to_char(s.period_date,'YYYY-MM'), a.code, _branch_id, COALESCE(auth.uid(), a.created_by), false)
  RETURNING id INTO _entry_id;
  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description) VALUES
    (_entry_id, _exp_acc, s.depreciation_amount, 0, 'مصروف إهلاك ' || a.name),
    (_entry_id, _dep_acc, 0, s.depreciation_amount, 'مجمع إهلاك ' || a.name);
  UPDATE public.journal_entries SET is_posted = true, approved_by = auth.uid() WHERE id = _entry_id;
  UPDATE public.asset_depreciation_schedule SET is_posted = true, journal_entry_id = _entry_id, posted_at = now(), posted_by = auth.uid() WHERE id = _schedule_id;
  UPDATE public.fixed_assets SET accumulated_depreciation = s.accumulated_amount, current_value = a.purchase_cost - s.accumulated_amount, updated_at = now() WHERE id = a.id;
  RETURN _entry_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.dispose_fixed_asset(_asset_id uuid, _disposal_date date, _disposal_type text, _amount numeric, _proceeds_account_id uuid, _gain_loss_account_id uuid, _notes text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE a RECORD; _book NUMERIC; _gl NUMERIC; _entry_id UUID; _branch UUID; _num TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  SELECT * INTO a FROM public.fixed_assets WHERE id = _asset_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الأصل غير موجود'; END IF;
  IF a.status = 'disposed' THEN RAISE EXCEPTION 'الأصل مستبعد مسبقاً'; END IF;
  IF _disposal_type NOT IN ('sale','scrap') THEN RAISE EXCEPTION 'نوع استبعاد غير صالح'; END IF;
  IF a.account_id IS NULL OR a.depreciation_account_id IS NULL THEN RAISE EXCEPTION 'حدد حساب الأصل وحساب مجمع الإهلاك في بطاقة الأصل'; END IF;
  _amount := COALESCE(_amount,0);
  IF _disposal_type = 'scrap' THEN _amount := 0; END IF;
  IF _amount < 0 THEN RAISE EXCEPTION 'قيمة البيع غير صالحة'; END IF;
  IF _amount > 0 AND _proceeds_account_id IS NULL THEN RAISE EXCEPTION 'حدد حساب المتحصلات (صندوق/بنك/مدين)'; END IF;
  IF _disposal_date > CURRENT_DATE THEN RAISE EXCEPTION 'لا يمكن الاستبعاد بتاريخ مستقبلي'; END IF;
  IF EXISTS (SELECT 1 FROM public.asset_depreciation_schedule WHERE asset_id=a.id AND is_posted=false AND period_date <= _disposal_date) THEN
    RAISE EXCEPTION 'رحّل أقساط الإهلاك المستحقة حتى تاريخ الاستبعاد أولاً';
  END IF;
  _book := a.purchase_cost - COALESCE(a.accumulated_depreciation,0);
  _gl := _amount - _book;
  IF _gl <> 0 AND _gain_loss_account_id IS NULL THEN RAISE EXCEPTION 'حدد حساب أرباح/خسائر بيع الأصول'; END IF;
  _branch := COALESCE(a.branch_id, (SELECT id FROM public.branches WHERE is_active=true ORDER BY created_at LIMIT 1));
  _num := 'JE-DSP-' || to_char(_disposal_date,'YYYYMM') || '-' || substr(replace(a.id::text,'-',''),1,6);
  INSERT INTO public.journal_entries (entry_number, entry_date, description, reference, branch_id, created_by, is_posted)
  VALUES (_num, _disposal_date, CASE WHEN _disposal_type='sale' THEN 'بيع أصل ' ELSE 'تخريد أصل ' END || a.name, a.code, _branch, auth.uid(), false)
  RETURNING id INTO _entry_id;
  IF COALESCE(a.accumulated_depreciation,0) > 0 THEN
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
    VALUES (_entry_id, a.depreciation_account_id, a.accumulated_depreciation, 0, 'إقفال مجمع إهلاك ' || a.name);
  END IF;
  IF _amount > 0 THEN
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
    VALUES (_entry_id, _proceeds_account_id, _amount, 0, 'متحصلات بيع ' || a.name);
  END IF;
  IF _gl < 0 THEN
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
    VALUES (_entry_id, _gain_loss_account_id, -_gl, 0, 'خسارة استبعاد ' || a.name);
  ELSIF _gl > 0 THEN
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
    VALUES (_entry_id, _gain_loss_account_id, 0, _gl, 'ربح بيع ' || a.name);
  END IF;
  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
  VALUES (_entry_id, a.account_id, 0, a.purchase_cost, 'إقفال تكلفة ' || a.name);
  UPDATE public.journal_entries SET is_posted = true, approved_by = auth.uid() WHERE id = _entry_id;
  DELETE FROM public.asset_depreciation_schedule WHERE asset_id = a.id AND is_posted = false;
  UPDATE public.fixed_assets SET status='disposed', disposal_date=_disposal_date, disposal_type=_disposal_type,
    disposal_amount=_amount, disposal_gain_loss=_gl, disposal_journal_entry_id=_entry_id, disposal_notes=_notes,
    current_value=0, updated_at=now() WHERE id=a.id;
  RETURN _entry_id;
END; $function$;
REVOKE EXECUTE ON FUNCTION public.dispose_fixed_asset(uuid,date,text,numeric,uuid,uuid,text) FROM anon;