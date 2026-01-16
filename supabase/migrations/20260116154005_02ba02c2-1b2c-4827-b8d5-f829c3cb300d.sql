
-- ربط المستخدمين بالفروع (يمكن للمستخدم الانتماء لأكثر من فرع)
CREATE TABLE public.user_branch_assignments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, branch_id)
);

-- تحديث user_roles لإضافة الفرع (الصلاحية قد تكون عامة أو خاصة بفرع)
ALTER TABLE public.user_roles 
ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
ADD COLUMN is_global BOOLEAN DEFAULT false;

-- جدول الصلاحيات التفصيلية
CREATE TABLE public.permissions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    module VARCHAR(50) NOT NULL, -- finance, inventory, sales, purchases, settings
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ربط الأدوار بالصلاحيات
CREATE TABLE public.role_permissions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    role public.app_role NOT NULL,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(role, permission_id)
);

-- صلاحيات مخصصة للمستخدم (تجاوز صلاحيات الدور)
CREATE TABLE public.user_permissions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    is_granted BOOLEAN DEFAULT true, -- true = منح، false = سحب
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, permission_id, branch_id)
);

-- Enable RLS
ALTER TABLE public.user_branch_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their branch assignments"
ON public.user_branch_assignments FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage branch assignments"
ON public.user_branch_assignments FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view permissions"
ON public.permissions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage permissions"
ON public.permissions FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view role permissions"
ON public.role_permissions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage role permissions"
ON public.role_permissions FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their permissions"
ON public.user_permissions FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage user permissions"
ON public.user_permissions FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- دالة للتحقق من صلاحية المستخدم على فرع معين
CREATE OR REPLACE FUNCTION public.has_branch_access(_user_id UUID, _branch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        -- المدير لديه وصول لكل الفروع
        SELECT 1 FROM public.user_roles 
        WHERE user_id = _user_id AND role = 'admin' AND is_global = true
    ) OR EXISTS (
        -- المستخدم معين لهذا الفرع
        SELECT 1 FROM public.user_branch_assignments 
        WHERE user_id = _user_id AND branch_id = _branch_id
    )
$$;

-- دالة للتحقق من صلاحية معينة
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission_code VARCHAR, _branch_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _permission_id UUID;
    _user_role public.app_role;
    _is_granted BOOLEAN;
BEGIN
    -- المدير لديه كل الصلاحيات
    IF public.has_role(_user_id, 'admin') THEN
        RETURN true;
    END IF;

    -- الحصول على permission_id
    SELECT id INTO _permission_id FROM public.permissions WHERE code = _permission_code;
    IF _permission_id IS NULL THEN
        RETURN false;
    END IF;

    -- التحقق من صلاحية مخصصة للمستخدم
    SELECT is_granted INTO _is_granted 
    FROM public.user_permissions 
    WHERE user_id = _user_id 
      AND permission_id = _permission_id 
      AND (branch_id IS NULL OR branch_id = _branch_id);
    
    IF _is_granted IS NOT NULL THEN
        RETURN _is_granted;
    END IF;

    -- التحقق من صلاحيات الدور
    SELECT ur.role INTO _user_role
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND (ur.is_global = true OR ur.branch_id = _branch_id)
    LIMIT 1;

    IF _user_role IS NOT NULL THEN
        RETURN EXISTS (
            SELECT 1 FROM public.role_permissions 
            WHERE role = _user_role AND permission_id = _permission_id
        );
    END IF;

    RETURN false;
END;
$$;

-- إدخال الصلاحيات الأساسية
INSERT INTO public.permissions (code, name, description, module) VALUES
-- المالية
('finance.accounts.view', 'عرض الحسابات', 'عرض دليل الحسابات', 'finance'),
('finance.accounts.create', 'إنشاء حساب', 'إضافة حسابات جديدة', 'finance'),
('finance.accounts.edit', 'تعديل حساب', 'تعديل الحسابات', 'finance'),
('finance.accounts.delete', 'حذف حساب', 'حذف الحسابات', 'finance'),
('finance.journals.view', 'عرض القيود', 'عرض قيود اليومية', 'finance'),
('finance.journals.create', 'إنشاء قيد', 'إضافة قيود يومية', 'finance'),
('finance.journals.post', 'ترحيل قيد', 'ترحيل القيود للدفتر', 'finance'),
('finance.journals.reverse', 'عكس قيد', 'عكس قيد مرحل', 'finance'),
('finance.reports.view', 'عرض التقارير المالية', 'الوصول للتقارير المالية', 'finance'),
('finance.closing.execute', 'إقفال السنة المالية', 'تنفيذ الإقفال السنوي', 'finance'),

-- المخزون
('inventory.products.view', 'عرض المنتجات', 'عرض قائمة المنتجات', 'inventory'),
('inventory.products.create', 'إنشاء منتج', 'إضافة منتجات جديدة', 'inventory'),
('inventory.products.edit', 'تعديل منتج', 'تعديل المنتجات', 'inventory'),
('inventory.products.delete', 'حذف منتج', 'حذف المنتجات', 'inventory'),
('inventory.movements.view', 'عرض الحركات', 'عرض حركات المخزون', 'inventory'),
('inventory.movements.create', 'إنشاء حركة', 'إضافة حركات مخزنية', 'inventory'),
('inventory.warehouses.manage', 'إدارة المستودعات', 'إدارة المستودعات', 'inventory'),

-- المبيعات
('sales.invoices.view', 'عرض الفواتير', 'عرض فواتير المبيعات', 'sales'),
('sales.invoices.create', 'إنشاء فاتورة', 'إضافة فواتير مبيعات', 'sales'),
('sales.invoices.approve', 'اعتماد فاتورة', 'اعتماد فواتير المبيعات', 'sales'),
('sales.invoices.cancel', 'إلغاء فاتورة', 'إلغاء فواتير المبيعات', 'sales'),
('sales.customers.manage', 'إدارة العملاء', 'إدارة بيانات العملاء', 'sales'),
('sales.collections.manage', 'إدارة التحصيلات', 'إدارة سندات القبض', 'sales'),
('sales.reports.view', 'تقارير المبيعات', 'عرض تقارير المبيعات', 'sales'),

-- المشتريات
('purchases.invoices.view', 'عرض فواتير المشتريات', 'عرض فواتير المشتريات', 'purchases'),
('purchases.invoices.create', 'إنشاء فاتورة شراء', 'إضافة فواتير مشتريات', 'purchases'),
('purchases.invoices.approve', 'اعتماد فاتورة شراء', 'اعتماد فواتير المشتريات', 'purchases'),
('purchases.suppliers.manage', 'إدارة الموردين', 'إدارة بيانات الموردين', 'purchases'),
('purchases.payments.manage', 'إدارة المدفوعات', 'إدارة سندات الصرف', 'purchases'),
('purchases.reports.view', 'تقارير المشتريات', 'عرض تقارير المشتريات', 'purchases'),

-- الإعدادات
('settings.system.view', 'عرض الإعدادات', 'عرض إعدادات النظام', 'settings'),
('settings.system.edit', 'تعديل الإعدادات', 'تعديل إعدادات النظام', 'settings'),
('settings.users.manage', 'إدارة المستخدمين', 'إدارة المستخدمين والصلاحيات', 'settings'),
('settings.branches.manage', 'إدارة الفروع', 'إدارة فروع الشركة', 'settings'),
('settings.logs.view', 'عرض السجلات', 'عرض سجلات النظام', 'settings');

-- ربط الصلاحيات بالأدوار الافتراضية
-- المحاسب
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'accountant', id FROM public.permissions 
WHERE code LIKE 'finance.%' AND code NOT LIKE '%closing%';

-- مدير المبيعات
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'sales_manager', id FROM public.permissions 
WHERE code LIKE 'sales.%';

-- مدير المخزون
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'inventory_manager', id FROM public.permissions 
WHERE code LIKE 'inventory.%';

-- المستخدم العادي - صلاحيات العرض فقط
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'user', id FROM public.permissions 
WHERE code LIKE '%.view';
