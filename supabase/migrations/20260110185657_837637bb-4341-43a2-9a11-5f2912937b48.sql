-- 1. جدول أسعار الصرف التاريخية
CREATE TABLE public.exchange_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  currency_id UUID NOT NULL REFERENCES public.currencies(id) ON DELETE CASCADE,
  rate_date DATE NOT NULL,
  buy_rate NUMERIC NOT NULL DEFAULT 1.0,
  sell_rate NUMERIC NOT NULL DEFAULT 1.0,
  is_locked BOOLEAN DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(currency_id, rate_date)
);

-- 2. جدول قيود فروقات العملة
CREATE TABLE public.fx_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  adjustment_date DATE NOT NULL,
  currency_id UUID NOT NULL REFERENCES public.currencies(id),
  original_amount NUMERIC NOT NULL DEFAULT 0,
  adjusted_amount NUMERIC NOT NULL DEFAULT 0,
  difference_amount NUMERIC NOT NULL DEFAULT 0,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('gain', 'loss')),
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  gain_account_id UUID REFERENCES public.accounts(id),
  loss_account_id UUID REFERENCES public.accounts(id),
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. جدول كشوف البنك للتسوية
CREATE TABLE public.bank_statements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id),
  statement_date DATE NOT NULL,
  statement_number TEXT,
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  closing_balance NUMERIC NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed')),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. جدول بنود كشف البنك
CREATE TABLE public.bank_statement_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  statement_id UUID NOT NULL REFERENCES public.bank_statements(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  description TEXT,
  reference TEXT,
  debit_amount NUMERIC DEFAULT 0,
  credit_amount NUMERIC DEFAULT 0,
  is_matched BOOLEAN DEFAULT false,
  matched_entry_id UUID REFERENCES public.journal_entry_lines(id),
  match_difference NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. جدول قيود التسوية البنكية
CREATE TABLE public.bank_reconciliations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id),
  reconciliation_date DATE NOT NULL,
  statement_balance NUMERIC NOT NULL DEFAULT 0,
  book_balance NUMERIC NOT NULL DEFAULT 0,
  difference NUMERIC NOT NULL DEFAULT 0,
  adjustment_journal_id UUID REFERENCES public.journal_entries(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. جدول أنواع القيود
CREATE TABLE public.journal_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type_category TEXT NOT NULL CHECK (type_category IN ('general', 'adjustment', 'closing', 'automatic', 'opening')),
  is_auto_generated BOOLEAN DEFAULT false,
  default_debit_account_id UUID REFERENCES public.accounts(id),
  default_credit_account_id UUID REFERENCES public.accounts(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. جدول الإقفال السنوي
CREATE TABLE public.year_end_closings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fiscal_period_id UUID NOT NULL REFERENCES public.fiscal_periods(id),
  closing_date DATE NOT NULL,
  retained_earnings_account_id UUID REFERENCES public.accounts(id),
  total_revenue NUMERIC DEFAULT 0,
  total_expenses NUMERIC DEFAULT 0,
  net_income NUMERIC DEFAULT 0,
  closing_journal_id UUID REFERENCES public.journal_entries(id),
  opening_journal_id UUID REFERENCES public.journal_entries(id),
  next_period_id UUID REFERENCES public.fiscal_periods(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  closed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- إضافة عمود نوع القيد لجدول القيود
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS journal_type_id UUID REFERENCES public.journal_types(id);

-- إضافة أعمدة للعملات في القيود
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS original_currency_id UUID REFERENCES public.currencies(id);
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC DEFAULT 1.0;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS original_amount NUMERIC DEFAULT 0;

-- إضافة عمود حالة التجميد للحسابات
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT false;

-- تفعيل RLS
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fx_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.year_end_closings ENABLE ROW LEVEL SECURITY;

-- سياسات RLS للجداول الجديدة
CREATE POLICY "Authenticated users can view exchange_rates" ON public.exchange_rates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage exchange_rates" ON public.exchange_rates FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view fx_adjustments" ON public.fx_adjustments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage fx_adjustments" ON public.fx_adjustments FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view bank_statements" ON public.bank_statements FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage bank_statements" ON public.bank_statements FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view bank_statement_lines" ON public.bank_statement_lines FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage bank_statement_lines" ON public.bank_statement_lines FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view bank_reconciliations" ON public.bank_reconciliations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage bank_reconciliations" ON public.bank_reconciliations FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view journal_types" ON public.journal_types FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage journal_types" ON public.journal_types FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view year_end_closings" ON public.year_end_closings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage year_end_closings" ON public.year_end_closings FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- إدراج أنواع القيود الافتراضية
INSERT INTO public.journal_types (code, name, type_category, is_auto_generated) VALUES
('GEN', 'قيود يومية', 'general', false),
('ADJ', 'قيود تسوية', 'adjustment', false),
('CLS', 'قيود إقفال', 'closing', true),
('AUTO', 'قيود آلية', 'automatic', true),
('OPN', 'قيود افتتاحية', 'opening', false);

-- دالة للتحقق من توازن القيد
CREATE OR REPLACE FUNCTION public.validate_journal_entry_balance()
RETURNS TRIGGER AS $$
DECLARE
  total_debit NUMERIC;
  total_credit NUMERIC;
BEGIN
  SELECT COALESCE(SUM(debit_amount), 0), COALESCE(SUM(credit_amount), 0)
  INTO total_debit, total_credit
  FROM public.journal_entry_lines
  WHERE journal_entry_id = NEW.journal_entry_id;
  
  IF total_debit <> total_credit THEN
    RAISE EXCEPTION 'مجموع المدين يجب أن يساوي مجموع الدائن';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- دالة للتحقق من أن الحساب فرعي وليس رئيسي
CREATE OR REPLACE FUNCTION public.validate_account_is_leaf()
RETURNS TRIGGER AS $$
DECLARE
  has_children BOOLEAN;
  is_frozen BOOLEAN;
  allows_manual BOOLEAN;
BEGIN
  -- التحقق من أن الحساب ليس له حسابات فرعية
  SELECT EXISTS (SELECT 1 FROM public.accounts WHERE parent_id = NEW.account_id)
  INTO has_children;
  
  IF has_children THEN
    RAISE EXCEPTION 'لا يمكن إدخال حركات على حساب رئيسي له حسابات فرعية';
  END IF;
  
  -- التحقق من أن الحساب غير مجمد
  SELECT a.is_frozen, a.allow_manual_entry INTO is_frozen, allows_manual
  FROM public.accounts a WHERE a.id = NEW.account_id;
  
  IF is_frozen THEN
    RAISE EXCEPTION 'الحساب مجمد ولا يقبل قيود جديدة';
  END IF;
  
  IF NOT allows_manual THEN
    RAISE EXCEPTION 'الحساب لا يقبل إدخالات يدوية';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- دالة للتحقق من الفترة المحاسبية
CREATE OR REPLACE FUNCTION public.validate_entry_period()
RETURNS TRIGGER AS $$
DECLARE
  period_open BOOLEAN;
BEGIN
  SELECT NOT fp.is_closed INTO period_open
  FROM public.fiscal_periods fp
  WHERE NEW.entry_date BETWEEN fp.start_date AND fp.end_date
  LIMIT 1;
  
  IF period_open IS NULL THEN
    -- لا توجد فترة محاسبية لهذا التاريخ
    RAISE EXCEPTION 'لا توجد فترة محاسبية مفتوحة لهذا التاريخ';
  END IF;
  
  IF NOT period_open THEN
    RAISE EXCEPTION 'الفترة المحاسبية مغلقة ولا يمكن إضافة قيود';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- دالة لمنع حذف حساب له حركات
CREATE OR REPLACE FUNCTION public.prevent_delete_account_with_entries()
RETURNS TRIGGER AS $$
DECLARE
  has_entries BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.journal_entry_lines WHERE account_id = OLD.id)
  INTO has_entries;
  
  IF has_entries THEN
    RAISE EXCEPTION 'لا يمكن حذف حساب له حركات سابقة';
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- دالة لمنع تعديل القيد المرحل
CREATE OR REPLACE FUNCTION public.prevent_posted_entry_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_posted = true AND TG_OP = 'UPDATE' THEN
    IF NEW.is_posted = false THEN
      RAISE EXCEPTION 'لا يمكن إلغاء ترحيل قيد مرحّل';
    END IF;
    -- السماح فقط بتحديث بعض الحقول
    IF OLD.entry_date <> NEW.entry_date OR 
       OLD.description <> NEW.description THEN
      RAISE EXCEPTION 'لا يمكن تعديل قيد مرحّل';
    END IF;
  END IF;
  
  IF OLD.is_posted = true AND TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'لا يمكن حذف قيد مرحّل';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- دالة للتحقق من عدم تداخل الفترات المحاسبية
CREATE OR REPLACE FUNCTION public.validate_fiscal_period_no_overlap()
RETURNS TRIGGER AS $$
DECLARE
  overlapping_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO overlapping_count
  FROM public.fiscal_periods
  WHERE id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  AND (
    (NEW.start_date BETWEEN start_date AND end_date) OR
    (NEW.end_date BETWEEN start_date AND end_date) OR
    (start_date BETWEEN NEW.start_date AND NEW.end_date)
  );
  
  IF overlapping_count > 0 THEN
    RAISE EXCEPTION 'الفترة المحاسبية متداخلة مع فترة أخرى';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- دالة للتحقق قبل إغلاق الفترة
CREATE OR REPLACE FUNCTION public.validate_period_before_close()
RETURNS TRIGGER AS $$
DECLARE
  unposted_entries INTEGER;
BEGIN
  IF NEW.is_closed = true AND OLD.is_closed = false THEN
    -- التحقق من عدم وجود قيود غير مرحلة
    SELECT COUNT(*) INTO unposted_entries
    FROM public.journal_entries
    WHERE entry_date BETWEEN OLD.start_date AND OLD.end_date
    AND is_posted = false;
    
    IF unposted_entries > 0 THEN
      RAISE EXCEPTION 'لا يمكن إغلاق الفترة - يوجد % قيود غير مرحلة', unposted_entries;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- دالة لمنع تعديل سعر الصرف بعد الاستخدام
CREATE OR REPLACE FUNCTION public.prevent_locked_rate_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_locked = true THEN
    RAISE EXCEPTION 'لا يمكن تعديل سعر صرف مستخدم في قيود مرحّلة';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- إنشاء المحفزات (Triggers)
CREATE TRIGGER validate_account_before_entry
  BEFORE INSERT ON public.journal_entry_lines
  FOR EACH ROW EXECUTE FUNCTION public.validate_account_is_leaf();

CREATE TRIGGER prevent_account_delete_with_entries
  BEFORE DELETE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_account_with_entries();

CREATE TRIGGER prevent_posted_entry_changes
  BEFORE UPDATE OR DELETE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.prevent_posted_entry_modification();

CREATE TRIGGER validate_fiscal_period_overlap
  BEFORE INSERT OR UPDATE ON public.fiscal_periods
  FOR EACH ROW EXECUTE FUNCTION public.validate_fiscal_period_no_overlap();

CREATE TRIGGER validate_period_close
  BEFORE UPDATE ON public.fiscal_periods
  FOR EACH ROW EXECUTE FUNCTION public.validate_period_before_close();

CREATE TRIGGER prevent_locked_rate_update
  BEFORE UPDATE ON public.exchange_rates
  FOR EACH ROW EXECUTE FUNCTION public.prevent_locked_rate_modification();

-- تحديث updated_at تلقائياً
CREATE TRIGGER update_exchange_rates_updated_at
  BEFORE UPDATE ON public.exchange_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bank_statements_updated_at
  BEFORE UPDATE ON public.bank_statements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();