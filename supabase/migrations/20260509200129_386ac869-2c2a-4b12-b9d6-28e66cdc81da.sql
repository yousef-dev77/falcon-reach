-- ============================================
-- 1. TAXES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.taxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  rate NUMERIC NOT NULL DEFAULT 0,
  tax_type TEXT NOT NULL DEFAULT 'both' CHECK (tax_type IN ('sales','purchase','both')),
  is_inclusive BOOLEAN DEFAULT false,
  output_account_id UUID,
  input_account_id UUID,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.taxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view taxes" ON public.taxes
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can manage taxes" ON public.taxes
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE TRIGGER trg_taxes_updated_at
  BEFORE UPDATE ON public.taxes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed common Saudi VAT rates
INSERT INTO public.taxes (code, name, rate, tax_type, description) VALUES
  ('VAT15', 'ضريبة القيمة المضافة 15%', 15, 'both', 'المعدل الأساسي للضريبة في السعودية'),
  ('VAT0', 'صفرية', 0, 'both', 'سلع وخدمات معدلها صفر (تصدير)'),
  ('VATEX', 'معفاة', 0, 'both', 'سلع وخدمات معفاة من الضريبة')
ON CONFLICT (code) DO NOTHING;

-- Add tax_id to invoice lines
ALTER TABLE public.sales_invoice_lines ADD COLUMN IF NOT EXISTS tax_id UUID;
ALTER TABLE public.purchase_invoice_lines ADD COLUMN IF NOT EXISTS tax_id UUID;

-- ============================================
-- 2. SALES RETURNS
-- ============================================
CREATE TYPE public.return_status AS ENUM ('draft','confirmed','cancelled');

CREATE TABLE IF NOT EXISTS public.sales_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number TEXT NOT NULL,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id UUID NOT NULL,
  original_invoice_id UUID,
  branch_id UUID,
  warehouse_id UUID,
  reason TEXT,
  notes TEXT,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status public.return_status NOT NULL DEFAULT 'draft',
  journal_entry_id UUID,
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_return_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL,
  product_id UUID NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  tax_id UUID,
  tax_percent NUMERIC DEFAULT 0,
  line_total NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_return_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth view sales_returns" ON public.sales_returns FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth manage sales_returns" ON public.sales_returns FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth view sales_return_lines" ON public.sales_return_lines FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth manage sales_return_lines" ON public.sales_return_lines FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE TRIGGER trg_sales_returns_updated_at BEFORE UPDATE ON public.sales_returns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 3. PURCHASE RETURNS
-- ============================================
CREATE TABLE IF NOT EXISTS public.purchase_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number TEXT NOT NULL,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_id UUID NOT NULL,
  original_invoice_id UUID,
  branch_id UUID,
  warehouse_id UUID,
  reason TEXT,
  notes TEXT,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status public.return_status NOT NULL DEFAULT 'draft',
  journal_entry_id UUID,
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_return_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL,
  product_id UUID NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  tax_id UUID,
  tax_percent NUMERIC DEFAULT 0,
  line_total NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_return_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth view purchase_returns" ON public.purchase_returns FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth manage purchase_returns" ON public.purchase_returns FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth view purchase_return_lines" ON public.purchase_return_lines FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth manage purchase_return_lines" ON public.purchase_return_lines FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE TRIGGER trg_purchase_returns_updated_at BEFORE UPDATE ON public.purchase_returns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 4. ASSET DEPRECIATION SCHEDULE
-- ============================================
CREATE TABLE IF NOT EXISTS public.asset_depreciation_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL,
  period_date DATE NOT NULL,
  depreciation_amount NUMERIC NOT NULL DEFAULT 0,
  accumulated_amount NUMERIC NOT NULL DEFAULT 0,
  book_value NUMERIC NOT NULL DEFAULT 0,
  is_posted BOOLEAN NOT NULL DEFAULT false,
  journal_entry_id UUID,
  posted_at TIMESTAMPTZ,
  posted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asset_id, period_date)
);

ALTER TABLE public.asset_depreciation_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view depreciation" ON public.asset_depreciation_schedule FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth manage depreciation" ON public.asset_depreciation_schedule FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Add fields to fixed_assets
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS depreciation_account_id UUID;
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS expense_account_id UUID;
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS depreciation_start_date DATE;

-- ============================================
-- 5. FUNCTIONS
-- ============================================

-- Generate depreciation schedule
CREATE OR REPLACE FUNCTION public.generate_asset_depreciation_schedule(_asset_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a RECORD;
  _months INTEGER;
  _monthly NUMERIC;
  _accumulated NUMERIC := 0;
  _depreciable NUMERIC;
  _i INTEGER;
  _period DATE;
  _count INTEGER := 0;
BEGIN
  SELECT * INTO a FROM public.fixed_assets WHERE id = _asset_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'الأصل غير موجود'; END IF;
  IF a.useful_life_years IS NULL OR a.useful_life_years <= 0 THEN
    RAISE EXCEPTION 'يجب تحديد العمر الإنتاجي';
  END IF;

  -- Delete unposted future entries
  DELETE FROM public.asset_depreciation_schedule
  WHERE asset_id = _asset_id AND is_posted = false;

  _depreciable := a.purchase_cost - COALESCE(a.salvage_value, 0);
  _months := a.useful_life_years * 12;
  _monthly := _depreciable / _months;

  -- Start from already-posted accumulated
  SELECT COALESCE(MAX(accumulated_amount), 0), COALESCE(MAX(period_date), COALESCE(a.depreciation_start_date, a.purchase_date) - INTERVAL '1 month')
    INTO _accumulated, _period
  FROM public.asset_depreciation_schedule
  WHERE asset_id = _asset_id AND is_posted = true;

  IF _accumulated = 0 THEN
    _period := COALESCE(a.depreciation_start_date, a.purchase_date) - INTERVAL '1 month';
  END IF;

  FOR _i IN 1.._months LOOP
    _period := (_period + INTERVAL '1 month')::DATE;
    -- end of month
    _period := (DATE_TRUNC('month', _period) + INTERVAL '1 month - 1 day')::DATE;

    EXIT WHEN _accumulated >= _depreciable;

    _accumulated := LEAST(_accumulated + _monthly, _depreciable);

    INSERT INTO public.asset_depreciation_schedule
      (asset_id, period_date, depreciation_amount, accumulated_amount, book_value)
    VALUES
      (_asset_id, _period, _monthly, _accumulated, a.purchase_cost - _accumulated)
    ON CONFLICT (asset_id, period_date) DO NOTHING;

    _count := _count + 1;
  END LOOP;

  RETURN _count;
END; $$;

-- Post a depreciation entry (creates JE)
CREATE OR REPLACE FUNCTION public.post_asset_depreciation(_schedule_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s RECORD;
  a RECORD;
  _entry_id UUID;
  _entry_number TEXT;
  _branch_id UUID;
  _exp_acc UUID;
  _dep_acc UUID;
BEGIN
  SELECT * INTO s FROM public.asset_depreciation_schedule WHERE id = _schedule_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'القيد غير موجود'; END IF;
  IF s.is_posted THEN RAISE EXCEPTION 'مرحّل مسبقاً'; END IF;

  SELECT * INTO a FROM public.fixed_assets WHERE id = s.asset_id;

  _exp_acc := a.expense_account_id;
  _dep_acc := a.depreciation_account_id;

  IF _exp_acc IS NULL THEN
    SELECT setting_value::uuid INTO _exp_acc FROM public.system_settings WHERE setting_key = 'default_depreciation_expense_account_id';
  END IF;
  IF _dep_acc IS NULL THEN
    SELECT setting_value::uuid INTO _dep_acc FROM public.system_settings WHERE setting_key = 'default_accumulated_depreciation_account_id';
  END IF;

  IF _exp_acc IS NULL OR _dep_acc IS NULL THEN
    RAISE EXCEPTION 'يجب تحديد حسابات الإهلاك في الإعدادات';
  END IF;

  -- pick first branch if none
  SELECT id INTO _branch_id FROM public.branches WHERE is_active = true LIMIT 1;

  _entry_number := COALESCE(public.get_next_document_number(_branch_id, 'journal_entry'),
                            'JE-DEP-' || to_char(now(),'YYYYMMDDHH24MISS'));

  INSERT INTO public.journal_entries
    (entry_number, entry_date, description, reference, branch_id, created_by, is_posted)
  VALUES
    (_entry_number, s.period_date, 'إهلاك ' || a.name || ' - ' || to_char(s.period_date,'YYYY-MM'),
     a.code, _branch_id, COALESCE(auth.uid(), a.created_by), true)
  RETURNING id INTO _entry_id;

  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description) VALUES
    (_entry_id, _exp_acc, s.depreciation_amount, 0, 'مصروف إهلاك ' || a.name),
    (_entry_id, _dep_acc, 0, s.depreciation_amount, 'مجمع إهلاك ' || a.name);

  UPDATE public.asset_depreciation_schedule
    SET is_posted = true, journal_entry_id = _entry_id, posted_at = now(), posted_by = auth.uid()
    WHERE id = _schedule_id;

  -- update asset accumulated
  UPDATE public.fixed_assets
    SET accumulated_depreciation = s.accumulated_amount,
        current_value = a.purchase_cost - s.accumulated_amount,
        updated_at = now()
    WHERE id = a.id;

  RETURN _entry_id;
END; $$;

-- Confirm sales return (reverse JE + inventory)
CREATE OR REPLACE FUNCTION public.confirm_sales_return(_return_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD; l RECORD;
  _entry_id UUID; _entry_number TEXT; _mov_number TEXT;
  _ar UUID; _rev UUID; _vat_out UUID; _inv UUID; _cogs UUID;
  _total_cogs NUMERIC := 0;
  _customer RECORD;
BEGIN
  SELECT * INTO r FROM public.sales_returns WHERE id = _return_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'المرتجع غير موجود'; END IF;
  IF r.status <> 'draft' THEN RAISE EXCEPTION 'المرتجع ليس مسودة'; END IF;

  SELECT * INTO _customer FROM public.customers WHERE id = r.customer_id;
  _ar := _customer.account_id;

  SELECT setting_value::uuid INTO _rev FROM public.system_settings WHERE setting_key = 'default_sales_revenue_account_id';
  SELECT setting_value::uuid INTO _vat_out FROM public.system_settings WHERE setting_key = 'default_vat_output_account_id';
  SELECT setting_value::uuid INTO _inv FROM public.system_settings WHERE setting_key = 'default_inventory_account_id';
  SELECT setting_value::uuid INTO _cogs FROM public.system_settings WHERE setting_key = 'default_cogs_account_id';

  IF _ar IS NULL OR _rev IS NULL THEN
    RAISE EXCEPTION 'يجب تحديد حساب العميل وحساب الإيرادات';
  END IF;

  _entry_number := COALESCE(public.get_next_document_number(r.branch_id, 'journal_entry'),
                            'JE-SR-' || to_char(now(),'YYYYMMDDHH24MISS'));

  INSERT INTO public.journal_entries (entry_number, entry_date, description, reference, branch_id, created_by, is_posted)
  VALUES (_entry_number, r.return_date, 'مرتجع مبيعات ' || r.return_number, r.return_number, r.branch_id, r.created_by, true)
  RETURNING id INTO _entry_id;

  -- Reverse revenue: Dr Revenue, Dr VAT, Cr AR
  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
  VALUES (_entry_id, _rev, r.subtotal, 0, 'عكس إيراد - مرتجع');
  IF r.tax_amount > 0 AND _vat_out IS NOT NULL THEN
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
    VALUES (_entry_id, _vat_out, r.tax_amount, 0, 'عكس ضريبة مخرجات');
  END IF;
  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
  VALUES (_entry_id, _ar, 0, r.total_amount, 'تخفيض ذمم العميل');

  -- Reverse inventory movements + COGS
  IF r.warehouse_id IS NOT NULL THEN
    FOR l IN SELECT srl.*, p.cost_price FROM public.sales_return_lines srl
             LEFT JOIN public.products p ON p.id = srl.product_id
             WHERE srl.return_id = _return_id LOOP
      _mov_number := COALESCE(public.get_next_document_number(r.branch_id, 'movement'),
                              'MOV-RET-' || to_char(now(),'YYYYMMDDHH24MISS') || '-' || substr(l.id::text,1,4));
      INSERT INTO public.inventory_movements
        (movement_number, movement_date, product_id, warehouse_id, quantity, unit_cost, reference, notes, created_by)
      VALUES (_mov_number, r.return_date, l.product_id, r.warehouse_id, l.quantity, COALESCE(l.cost_price,0),
              r.return_number, 'مرتجع مبيعات ' || r.return_number, r.created_by);
      _total_cogs := _total_cogs + (l.quantity * COALESCE(l.cost_price,0));
    END LOOP;

    -- Reverse COGS: Dr Inventory, Cr COGS
    IF _total_cogs > 0 AND _inv IS NOT NULL AND _cogs IS NOT NULL THEN
      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description) VALUES
        (_entry_id, _inv, _total_cogs, 0, 'إعادة مخزون مرتجع'),
        (_entry_id, _cogs, 0, _total_cogs, 'عكس تكلفة بضاعة مباعة');
    END IF;
  END IF;

  UPDATE public.sales_returns
    SET status='confirmed', confirmed_at=now(), confirmed_by=auth.uid(),
        journal_entry_id=_entry_id, updated_at=now()
    WHERE id = _return_id;

  RETURN _entry_id;
END; $$;

-- Confirm purchase return
CREATE OR REPLACE FUNCTION public.confirm_purchase_return(_return_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD; l RECORD;
  _entry_id UUID; _entry_number TEXT; _mov_number TEXT;
  _ap UUID; _inv UUID; _vat_in UUID;
  _supplier RECORD;
BEGIN
  SELECT * INTO r FROM public.purchase_returns WHERE id = _return_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'المرتجع غير موجود'; END IF;
  IF r.status <> 'draft' THEN RAISE EXCEPTION 'المرتجع ليس مسودة'; END IF;

  SELECT * INTO _supplier FROM public.suppliers WHERE id = r.supplier_id;
  _ap := _supplier.account_id;

  SELECT setting_value::uuid INTO _inv FROM public.system_settings WHERE setting_key = 'default_inventory_account_id';
  SELECT setting_value::uuid INTO _vat_in FROM public.system_settings WHERE setting_key = 'default_vat_input_account_id';

  IF _ap IS NULL OR _inv IS NULL THEN
    RAISE EXCEPTION 'يجب تحديد حساب المورد وحساب المخزون';
  END IF;

  _entry_number := COALESCE(public.get_next_document_number(r.branch_id, 'journal_entry'),
                            'JE-PR-' || to_char(now(),'YYYYMMDDHH24MISS'));

  INSERT INTO public.journal_entries (entry_number, entry_date, description, reference, branch_id, created_by, is_posted)
  VALUES (_entry_number, r.return_date, 'مرتجع مشتريات ' || r.return_number, r.return_number, r.branch_id, r.created_by, true)
  RETURNING id INTO _entry_id;

  -- Dr AP (decrease), Cr Inventory, Cr VAT input
  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
  VALUES (_entry_id, _ap, r.total_amount, 0, 'تخفيض ذمم المورد');
  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
  VALUES (_entry_id, _inv, 0, r.subtotal, 'تخفيض مخزون - مرتجع');
  IF r.tax_amount > 0 AND _vat_in IS NOT NULL THEN
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
    VALUES (_entry_id, _vat_in, 0, r.tax_amount, 'عكس ضريبة مدخلات');
  END IF;

  -- Reverse inventory movements (negative)
  IF r.warehouse_id IS NOT NULL THEN
    FOR l IN SELECT * FROM public.purchase_return_lines WHERE return_id = _return_id LOOP
      _mov_number := COALESCE(public.get_next_document_number(r.branch_id, 'movement'),
                              'MOV-PRET-' || to_char(now(),'YYYYMMDDHH24MISS') || '-' || substr(l.id::text,1,4));
      INSERT INTO public.inventory_movements
        (movement_number, movement_date, product_id, warehouse_id, quantity, unit_cost, reference, notes, created_by)
      VALUES (_mov_number, r.return_date, l.product_id, r.warehouse_id, -l.quantity, l.unit_price,
              r.return_number, 'مرتجع مشتريات ' || r.return_number, r.created_by);
    END LOOP;
  END IF;

  UPDATE public.purchase_returns
    SET status='confirmed', confirmed_at=now(), confirmed_by=auth.uid(),
        journal_entry_id=_entry_id, updated_at=now()
    WHERE id = _return_id;

  RETURN _entry_id;
END; $$;

-- Lock confirmed returns
CREATE OR REPLACE FUNCTION public.prevent_modify_confirmed_return()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'confirmed' THEN RAISE EXCEPTION 'لا يمكن حذف مرتجع مؤكد'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'confirmed' AND NEW.status = 'confirmed' THEN
    IF NEW.return_date <> OLD.return_date OR NEW.total_amount <> OLD.total_amount THEN
      RAISE EXCEPTION 'لا يمكن تعديل مرتجع مؤكد';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_sales_returns_lock BEFORE UPDATE OR DELETE ON public.sales_returns
  FOR EACH ROW EXECUTE FUNCTION public.prevent_modify_confirmed_return();
CREATE TRIGGER trg_purchase_returns_lock BEFORE UPDATE OR DELETE ON public.purchase_returns
  FOR EACH ROW EXECUTE FUNCTION public.prevent_modify_confirmed_return();

-- Add VAT settings
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, category, description) VALUES
  ('default_vat_output_account_id', NULL, 'uuid', 'tax', 'حساب ضريبة المخرجات الافتراضي'),
  ('default_vat_input_account_id', NULL, 'uuid', 'tax', 'حساب ضريبة المدخلات الافتراضي'),
  ('default_sales_revenue_account_id', NULL, 'uuid', 'sales', 'حساب الإيرادات الافتراضي'),
  ('default_depreciation_expense_account_id', NULL, 'uuid', 'assets', 'حساب مصروف الإهلاك'),
  ('default_accumulated_depreciation_account_id', NULL, 'uuid', 'assets', 'حساب مجمع الإهلاك')
ON CONFLICT (setting_key) DO NOTHING;