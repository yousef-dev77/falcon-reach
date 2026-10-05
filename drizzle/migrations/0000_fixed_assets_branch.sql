ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);

CREATE OR REPLACE FUNCTION public.post_asset_depreciation(_schedule_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s RECORD; a RECORD; _entry_id UUID; _entry_number TEXT; _branch_id UUID; _exp_acc UUID; _dep_acc UUID;
BEGIN
  SELECT * INTO s FROM public.asset_depreciation_schedule WHERE id = _schedule_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'قسط الإهلاك غير موجود'; END IF;
  IF s.is_posted THEN RAISE EXCEPTION 'مرحّل مسبقاً'; END IF;
  SELECT * INTO a FROM public.fixed_assets WHERE id = s.asset_id FOR UPDATE;
  IF a.status <> 'active' THEN RAISE EXCEPTION 'الأصل غير نشط'; END IF;
  IF EXISTS (SELECT 1 FROM public.asset_depreciation_schedule WHERE asset_id = a.id AND is_posted = false AND period_date < s.period_date) THEN
    RAISE EXCEPTION 'يجب ترحيل الأقساط السابقة أولاً';
  END IF;
  IF s.period_date > CURRENT_DATE THEN RAISE EXCEPTION 'لا يمكن ترحيل قسط مستقبلي'; END IF;

  _exp_acc := COALESCE(a.expense_account_id, (SELECT setting_value::uuid FROM public.system_settings WHERE setting_key = 'default_depreciation_expense_account_id' AND setting_value <> ''));
  _dep_acc := COALESCE(a.depreciation_account_id, (SELECT setting_value::uuid FROM public.system_settings WHERE setting_key = 'default_accumulated_depreciation_account_id' AND setting_value <> ''));
  IF _exp_acc IS NULL OR _dep_acc IS NULL THEN
    RAISE EXCEPTION 'حدد حساب مصروف الإهلاك وحساب مجمع الإهلاك في بطاقة الأصل';
  END IF;

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
END; $$;