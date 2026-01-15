-- جدول إعدادات النظام المالي والمخزني
CREATE TABLE public.system_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key text NOT NULL UNIQUE,
  setting_value text,
  setting_type text NOT NULL DEFAULT 'text', -- text, number, boolean, account, currency, warehouse
  category text NOT NULL DEFAULT 'general', -- general, finance, inventory, sales, purchases
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان
CREATE POLICY "Authenticated users can view system_settings" 
ON public.system_settings 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage system_settings" 
ON public.system_settings 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- إدخال الإعدادات الافتراضية
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, category, description) VALUES
-- إعدادات مالية
('default_receivable_account', NULL, 'account', 'finance', 'حساب المدينين الافتراضي'),
('default_payable_account', NULL, 'account', 'finance', 'حساب الدائنين الافتراضي'),
('default_sales_account', NULL, 'account', 'finance', 'حساب المبيعات الافتراضي'),
('default_purchase_account', NULL, 'account', 'finance', 'حساب المشتريات الافتراضي'),
('default_sales_tax_account', NULL, 'account', 'finance', 'حساب ضريبة المبيعات الافتراضي'),
('default_purchase_tax_account', NULL, 'account', 'finance', 'حساب ضريبة المشتريات الافتراضي'),
('default_cash_account', NULL, 'account', 'finance', 'حساب الصندوق الافتراضي'),
('default_bank_account', NULL, 'account', 'finance', 'حساب البنك الافتراضي'),
('default_discount_account', NULL, 'account', 'finance', 'حساب الخصم الافتراضي'),
('default_fx_gain_account', NULL, 'account', 'finance', 'حساب أرباح فروقات العملة'),
('default_fx_loss_account', NULL, 'account', 'finance', 'حساب خسائر فروقات العملة'),
('default_retained_earnings_account', NULL, 'account', 'finance', 'حساب الأرباح المحتجزة'),
('default_currency', NULL, 'currency', 'finance', 'العملة الافتراضية'),
('fiscal_year_start_month', '1', 'number', 'finance', 'شهر بداية السنة المالية'),
('allow_negative_inventory', 'false', 'boolean', 'inventory', 'السماح بالمخزون السالب'),
-- إعدادات المخزون
('default_warehouse', NULL, 'warehouse', 'inventory', 'المستودع الافتراضي'),
('default_inventory_account', NULL, 'account', 'inventory', 'حساب المخزون الافتراضي'),
('default_cogs_account', NULL, 'account', 'inventory', 'حساب تكلفة البضاعة المباعة'),
('default_inventory_adjustment_account', NULL, 'account', 'inventory', 'حساب تسويات المخزون'),
-- إعدادات عامة
('company_name', NULL, 'text', 'general', 'اسم الشركة'),
('company_address', NULL, 'text', 'general', 'عنوان الشركة'),
('company_phone', NULL, 'text', 'general', 'هاتف الشركة'),
('company_email', NULL, 'text', 'general', 'البريد الإلكتروني'),
('company_tax_number', NULL, 'text', 'general', 'الرقم الضريبي'),
('default_payment_terms', '30', 'number', 'sales', 'شروط الدفع الافتراضية (أيام)'),
('default_branch', NULL, 'branch', 'general', 'الفرع الافتراضي');

-- تحديث trigger للتاريخ
CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();