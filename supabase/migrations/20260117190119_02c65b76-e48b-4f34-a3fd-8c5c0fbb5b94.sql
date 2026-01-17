-- جدول تسلسلات المستندات لكل فرع
CREATE TABLE public.document_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
    document_type VARCHAR(50) NOT NULL, -- 'sales_invoice', 'purchase_invoice', 'journal_entry', 'payment', 'collection', 'movement'
    prefix VARCHAR(20) NOT NULL, -- e.g., 'INV', 'PUR', 'JE'
    current_number INTEGER NOT NULL DEFAULT 0,
    format_pattern VARCHAR(100) NOT NULL DEFAULT '{PREFIX}-{BRANCH}-{NUMBER}', -- يمكن تخصيصه
    number_padding INTEGER NOT NULL DEFAULT 4, -- عدد الأصفار
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(branch_id, document_type)
);

-- تفعيل RLS
ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان
CREATE POLICY "Users can view document sequences for their branches" 
ON public.document_sequences FOR SELECT TO authenticated
USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_branch_access(auth.uid(), branch_id)
);

CREATE POLICY "Admins can manage document sequences" 
ON public.document_sequences FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- دالة لتوليد رقم المستند التالي
CREATE OR REPLACE FUNCTION public.get_next_document_number(
    _branch_id UUID,
    _document_type VARCHAR(50)
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _sequence RECORD;
    _branch_code VARCHAR(20);
    _next_number INTEGER;
    _formatted_number TEXT;
BEGIN
    -- الحصول على كود الفرع
    SELECT code INTO _branch_code FROM public.branches WHERE id = _branch_id;
    
    -- الحصول على أو إنشاء التسلسل
    SELECT * INTO _sequence FROM public.document_sequences 
    WHERE branch_id = _branch_id AND document_type = _document_type
    FOR UPDATE;
    
    IF NOT FOUND THEN
        -- إنشاء تسلسل جديد إذا لم يوجد
        INSERT INTO public.document_sequences (branch_id, document_type, prefix, current_number)
        VALUES (
            _branch_id, 
            _document_type,
            CASE _document_type
                WHEN 'sales_invoice' THEN 'INV'
                WHEN 'purchase_invoice' THEN 'PUR'
                WHEN 'journal_entry' THEN 'JE'
                WHEN 'payment' THEN 'PAY'
                WHEN 'collection' THEN 'COL'
                WHEN 'movement' THEN 'MOV'
                ELSE UPPER(SUBSTRING(_document_type, 1, 3))
            END,
            1
        )
        RETURNING * INTO _sequence;
        _next_number := 1;
    ELSE
        -- زيادة الرقم
        _next_number := _sequence.current_number + 1;
        UPDATE public.document_sequences 
        SET current_number = _next_number, updated_at = now()
        WHERE id = _sequence.id;
    END IF;
    
    -- تنسيق الرقم
    _formatted_number := _sequence.prefix || '-' || _branch_code || '-' || 
                         LPAD(_next_number::TEXT, _sequence.number_padding, '0');
    
    RETURN _formatted_number;
END;
$$;

-- دالة للتحقق من صلاحية المستخدم للفرع المحدد
CREATE OR REPLACE FUNCTION public.get_user_branches(_user_id UUID)
RETURNS TABLE (
    branch_id UUID,
    branch_name VARCHAR,
    branch_code VARCHAR,
    is_primary BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    -- إذا كان المستخدم admin عام، يحصل على كل الفروع
    SELECT b.id, b.name, b.code, false
    FROM public.branches b
    WHERE EXISTS (
        SELECT 1 FROM public.user_roles ur 
        WHERE ur.user_id = _user_id 
        AND ur.role = 'admin' 
        AND ur.is_global = true
    )
    AND b.is_active = true
    
    UNION
    
    -- الفروع المعينة للمستخدم
    SELECT b.id, b.name, b.code, uba.is_primary
    FROM public.user_branch_assignments uba
    JOIN public.branches b ON b.id = uba.branch_id
    WHERE uba.user_id = _user_id
    AND b.is_active = true
$$;

-- Trigger لتحديث updated_at
CREATE TRIGGER update_document_sequences_updated_at
    BEFORE UPDATE ON public.document_sequences
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- إضافة إعدادات الشركة في جدول الإعدادات
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, category, description) VALUES
('company_name', 'شركة فالكون', 'text', 'company', 'اسم الشركة'),
('company_logo', '', 'text', 'company', 'شعار الشركة'),
('company_address', '', 'text', 'company', 'عنوان الشركة'),
('company_phone', '', 'text', 'company', 'هاتف الشركة'),
('company_email', '', 'text', 'company', 'البريد الإلكتروني للشركة'),
('company_tax_number', '', 'text', 'company', 'الرقم الضريبي'),
('fiscal_year_start', '01-01', 'text', 'company', 'بداية السنة المالية (شهر-يوم)'),
('multi_branch_enabled', 'true', 'boolean', 'system', 'تفعيل نظام الفروع المتعددة'),
('centralized_accounts', 'true', 'boolean', 'system', 'شجرة حسابات مركزية'),
('auto_create_branch_warehouse', 'true', 'boolean', 'system', 'إنشاء مستودع تلقائي عند إضافة فرع'),
('auto_create_branch_cashbox', 'true', 'boolean', 'system', 'إنشاء صندوق تلقائي عند إضافة فرع')
ON CONFLICT (setting_key) DO NOTHING;