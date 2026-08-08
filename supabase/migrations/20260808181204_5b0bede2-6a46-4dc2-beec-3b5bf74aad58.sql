
-- ============ ENUMS ============
DO $$ BEGIN CREATE TYPE public.perm_subject_type AS ENUM ('user_type','group','user'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.access_scope AS ENUM ('all','branch','department','own'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.policy_effect AS ENUM ('allow','deny'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ USER TYPES ============
CREATE TABLE IF NOT EXISTS public.user_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL UNIQUE,
  name varchar(150) NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_types TO authenticated;
GRANT ALL ON public.user_types TO service_role;
ALTER TABLE public.user_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_types_read" ON public.user_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_types_admin_write" ON public.user_types FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ USER GROUPS ============
CREATE TABLE IF NOT EXISTS public.user_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL UNIQUE,
  name varchar(150) NOT NULL,
  description text,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_groups TO authenticated;
GRANT ALL ON public.user_groups TO service_role;
ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_groups_read" ON public.user_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_groups_admin_write" ON public.user_groups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.user_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  group_id uuid NOT NULL REFERENCES public.user_groups(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, group_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_group_members TO authenticated;
GRANT ALL ON public.user_group_members TO service_role;
ALTER TABLE public.user_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ugm_read" ON public.user_group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "ugm_admin_write" ON public.user_group_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ APP SCREENS REGISTRY ============
CREATE TABLE IF NOT EXISTS public.app_screens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(100) NOT NULL UNIQUE,
  name varchar(150) NOT NULL,
  module varchar(50) NOT NULL,
  route varchar(150) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_screens TO authenticated;
GRANT ALL ON public.app_screens TO service_role;
ALTER TABLE public.app_screens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "screens_read" ON public.app_screens FOR SELECT TO authenticated USING (true);
CREATE POLICY "screens_admin_write" ON public.app_screens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ SCREEN PERMISSION MATRIX ============
CREATE TABLE IF NOT EXISTS public.screen_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type public.perm_subject_type NOT NULL,
  subject_id uuid NOT NULL,
  screen_id uuid NOT NULL REFERENCES public.app_screens(id) ON DELETE CASCADE,
  can_view boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  can_approve boolean NOT NULL DEFAULT false,
  can_post boolean NOT NULL DEFAULT false,
  can_export boolean NOT NULL DEFAULT false,
  scope public.access_scope NOT NULL DEFAULT 'branch',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_type, subject_id, screen_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.screen_permissions TO authenticated;
GRANT ALL ON public.screen_permissions TO service_role;
ALTER TABLE public.screen_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sp_read" ON public.screen_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "sp_admin_write" ON public.screen_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ ReBAC : RELATIONS + POLICIES ============
CREATE TABLE IF NOT EXISTS public.resource_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  relation varchar(50) NOT NULL,
  resource_type varchar(50) NOT NULL,
  resource_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, relation, resource_type, resource_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_relations TO authenticated;
GRANT ALL ON public.resource_relations TO service_role;
ALTER TABLE public.resource_relations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rr_self_read" ON public.resource_relations FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "rr_admin_write" ON public.resource_relations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.access_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(150) NOT NULL,
  description text,
  subject_type public.perm_subject_type NOT NULL,
  subject_id uuid NOT NULL,
  screen_id uuid REFERENCES public.app_screens(id) ON DELETE CASCADE,
  action varchar(20) NOT NULL DEFAULT 'view',
  relation varchar(50),
  effect public.policy_effect NOT NULL DEFAULT 'allow',
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_policies TO authenticated;
GRANT ALL ON public.access_policies TO service_role;
ALTER TABLE public.access_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ap_read" ON public.access_policies FOR SELECT TO authenticated USING (true);
CREATE POLICY "ap_admin_write" ON public.access_policies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- link profiles to user type
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_type_id uuid REFERENCES public.user_types(id) ON DELETE SET NULL;

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_user_types_updated ON public.user_types;
CREATE TRIGGER trg_user_types_updated BEFORE UPDATE ON public.user_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_user_groups_updated ON public.user_groups;
CREATE TRIGGER trg_user_groups_updated BEFORE UPDATE ON public.user_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_screen_permissions_updated ON public.screen_permissions;
CREATE TRIGGER trg_screen_permissions_updated BEFORE UPDATE ON public.screen_permissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_access_policies_updated ON public.access_policies;
CREATE TRIGGER trg_access_policies_updated BEFORE UPDATE ON public.access_policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SEED SCREENS ============
INSERT INTO public.app_screens (code, name, module, route, sort_order) VALUES
('finance.accounts','شجرة الحسابات','finance','/finance/accounts',1),
('finance.journal-entries','القيود اليومية','finance','/finance/journal-entries',2),
('finance.hr-vouchers','سندات صرف HR','finance','/finance/hr-vouchers',3),
('finance.journal-types','أنواع القيود','finance','/finance/journal-types',4),
('finance.general-ledger','الأستاذ العام','finance','/finance/general-ledger',5),
('finance.sub-ledger','دفتر الأستاذ المساعد','finance','/finance/sub-ledger',6),
('finance.currencies','العملات','finance','/finance/currencies',7),
('finance.exchange-rates','أسعار الصرف','finance','/finance/exchange-rates',8),
('finance.fx-adjustment','تسوية فروقات العملة','finance','/finance/fx-adjustment',9),
('finance.bank-statements','كشوفات البنك','finance','/finance/bank-statements',10),
('finance.bank-reconciliation','التسوية البنكية','finance','/finance/bank-reconciliation',11),
('finance.fiscal-periods','الفترات المحاسبية','finance','/finance/fiscal-periods',12),
('finance.year-end-closing','الإقفال السنوي','finance','/finance/year-end-closing',13),
('finance.cost-centers','مراكز التكلفة','finance','/finance/cost-centers',14),
('finance.reports','التقارير المالية','finance','/finance/reports',15),
('finance.cash-bank','الصناديق والبنوك','finance','/finance/cash-bank',16),
('finance.bank-cash-report','حركة البنوك والصناديق','finance','/finance/bank-cash-report',17),
('finance.expenses-revenue','المصاريف والإيرادات','finance','/finance/expenses-revenue',18),
('finance.fixed-assets','الأصول الثابتة','finance','/finance/fixed-assets',19),
('finance.asset-depreciation','إهلاك الأصول','finance','/finance/asset-depreciation',20),
('finance.taxes','إدارة الضرائب','finance','/finance/taxes',21),
('finance.vat-declaration','الإقرار الضريبي (VAT)','finance','/finance/vat-declaration',22),
('finance.aging-report','تحليل أعمار الذمم','finance','/finance/aging-report',23),
('inventory.warehouses','المستودعات','inventory','/inventory/warehouses',1),
('inventory.products','الأصناف والمنتجات','inventory','/inventory/products',2),
('inventory.categories','فئات المنتجات','inventory','/inventory/categories',3),
('inventory.units','وحدات القياس','inventory','/inventory/units',4),
('inventory.vouchers.receipt','إذن استلام (وارد)','inventory','/inventory/vouchers/receipt',5),
('inventory.vouchers.issue','إذن صرف (صادر)','inventory','/inventory/vouchers/issue',6),
('inventory.vouchers.transfer','تحويل بين مستودعات','inventory','/inventory/vouchers/transfer',7),
('inventory.vouchers.count','جرد المخزون','inventory','/inventory/vouchers/count',8),
('inventory.stock-balance','أرصدة وكرت الصنف','inventory','/inventory/stock-balance',9),
('inventory.movements','الحركات المخزنية','inventory','/inventory/movements',10),
('inventory.reports','تقارير المخزون','inventory','/inventory/reports',11),
('sales.customers','العملاء','sales','/sales/customers',1),
('sales.quotations','عروض الأسعار','sales','/sales/quotations',2),
('sales.orders','أوامر البيع','sales','/sales/orders',3),
('sales.delivery-notes','إذونات التسليم','sales','/sales/delivery-notes',4),
('sales.invoices','فواتير المبيعات','sales','/sales/invoices',5),
('sales.returns','مرتجعات المبيعات','sales','/sales/returns',6),
('sales.collections','التحصيلات','sales','/sales/collections',7),
('sales.reports','تقارير المبيعات','sales','/sales/reports',8),
('purchases.suppliers','الموردين','purchases','/purchases/suppliers',1),
('purchases.requests','طلبات الشراء','purchases','/purchases/requests',2),
('purchases.orders','أوامر الشراء','purchases','/purchases/orders',3),
('purchases.goods-receipts','إذونات الاستلام','purchases','/purchases/goods-receipts',4),
('purchases.invoices','فواتير المشتريات','purchases','/purchases/invoices',5),
('purchases.landed-costs','التكاليف الإضافية','purchases','/purchases/landed-costs',6),
('purchases.returns','مرتجعات المشتريات','purchases','/purchases/returns',7),
('purchases.payments','المدفوعات','purchases','/purchases/payments',8),
('purchases.reports','تقارير المشتريات','purchases','/purchases/reports',9),
('pos.sessions','جلسات الكاشير','pos','/pos/sessions',1),
('pos.orders','فواتير POS','pos','/pos/orders',2),
('pos.reports','تقارير POS','pos','/pos/reports',3),
('pos.configs','إعدادات نقاط البيع','pos','/pos/configs',4),
('hr','لوحة الموارد البشرية','hr','/hr',1),
('hr.employees','الموظفين','hr','/hr/employees',2),
('hr.departments','الأقسام','hr','/hr/departments',3),
('hr.job-titles','المسميات الوظيفية','hr','/hr/job-titles',4),
('hr.contracts','العقود','hr','/hr/contracts',5),
('hr.attendance','الحضور اليومي','hr','/hr/attendance',6),
('hr.leave-types','أنواع الإجازات','hr','/hr/leave-types',7),
('hr.leave-requests','طلبات الإجازات','hr','/hr/leave-requests',8),
('hr.salary-components','مكونات الراتب','hr','/hr/salary-components',9),
('hr.advances','سلف الرواتب','hr','/hr/advances',10),
('hr.loans','قروض الموظفين','hr','/hr/loans',11),
('hr.payroll','تشغيل الرواتب','hr','/hr/payroll',12),
('hr.performance','تقييم الأداء','hr','/hr/performance',13),
('hr.training-programs','برامج التدريب','hr','/hr/training-programs',14),
('hr.training-sessions','جلسات التدريب','hr','/hr/training-sessions',15),
('hr.alerts','تنبيهات الوثائق','hr','/hr/alerts',16),
('hr.end-of-service','نهاية الخدمة','hr','/hr/end-of-service',17),
('hr.reports','تقارير الموارد البشرية','hr','/hr/reports',18),
('my.portal','بوابتي','portal','/my/portal',1),
('settings.users','المستخدمين والصلاحيات','settings','/settings/users',1),
('settings.branches','الفروع','settings','/settings/branches',2),
('settings.general','الإعدادات العامة','settings','/settings/general',3),
('settings.logs','سجلات النظام','settings','/settings/logs',4)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, module = EXCLUDED.module, route = EXCLUDED.route;

-- ============ SEED USER TYPES ============
INSERT INTO public.user_types (code, name, description, is_system) VALUES
('admin','مدير النظام','وصول كامل لجميع الشاشات والإجراءات',true),
('branch_manager','مدير الفرع','تحكم كامل داخل فرعه فقط',true),
('accountant','محاسب','المالية والمشتريات',true),
('sales_manager','مدير مبيعات','المبيعات والعملاء و POS',true),
('inventory_manager','مدير مخزون','المخزون والمستودعات',true),
('hr_manager','مدير الموارد البشرية','الموارد البشرية والرواتب',true),
('cashier','كاشير','شاشة نقاط البيع فقط',true),
('employee','موظف (بوابتي)','بوابة الموظف فقط',true)
ON CONFLICT (code) DO NOTHING;

-- ============ SEED DEFAULT MATRIX PER USER TYPE ============
-- admin: everything, scope all
INSERT INTO public.screen_permissions (subject_type, subject_id, screen_id, can_view, can_create, can_edit, can_delete, can_approve, can_post, can_export, scope)
SELECT 'user_type', ut.id, s.id, true,true,true,true,true,true,true,'all'
FROM public.user_types ut CROSS JOIN public.app_screens s WHERE ut.code = 'admin'
ON CONFLICT (subject_type, subject_id, screen_id) DO NOTHING;

-- branch_manager: everything except settings.users, scope branch
INSERT INTO public.screen_permissions (subject_type, subject_id, screen_id, can_view, can_create, can_edit, can_delete, can_approve, can_post, can_export, scope)
SELECT 'user_type', ut.id, s.id, true,true,true,false,true,true,true,'branch'
FROM public.user_types ut CROSS JOIN public.app_screens s
WHERE ut.code = 'branch_manager' AND s.code <> 'settings.users'
ON CONFLICT (subject_type, subject_id, screen_id) DO NOTHING;

-- module-scoped types
INSERT INTO public.screen_permissions (subject_type, subject_id, screen_id, can_view, can_create, can_edit, can_delete, can_approve, can_post, can_export, scope)
SELECT 'user_type', ut.id, s.id, true,true,true,false,false,false,true,'branch'
FROM public.user_types ut JOIN public.app_screens s ON s.module = ANY (
  CASE ut.code
    WHEN 'accountant' THEN ARRAY['finance','purchases','portal']
    WHEN 'sales_manager' THEN ARRAY['sales','pos','portal']
    WHEN 'inventory_manager' THEN ARRAY['inventory','portal']
    WHEN 'hr_manager' THEN ARRAY['hr','portal']
    WHEN 'cashier' THEN ARRAY['pos','portal']
    WHEN 'employee' THEN ARRAY['portal']
    ELSE ARRAY[]::text[]
  END)
WHERE ut.code IN ('accountant','sales_manager','inventory_manager','hr_manager','cashier','employee')
ON CONFLICT (subject_type, subject_id, screen_id) DO NOTHING;

-- employee portal is own-scoped
UPDATE public.screen_permissions sp SET scope = 'own', can_create = false, can_edit = false
WHERE sp.subject_type = 'user_type'
  AND sp.subject_id = (SELECT id FROM public.user_types WHERE code = 'employee');

-- backfill profiles.user_type_id from existing roles
UPDATE public.profiles p SET user_type_id = ut.id
FROM public.user_roles ur JOIN public.user_types ut ON ut.code = ur.role::text
WHERE ur.user_id = p.id AND p.user_type_id IS NULL;

-- ============ FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.has_screen_access(_user_id uuid, _screen_code text, _action text DEFAULT 'view')
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _screen_id uuid; _allowed boolean := false; _denied boolean := false;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  IF public.has_role(_user_id, 'admin') THEN RETURN true; END IF;
  SELECT id INTO _screen_id FROM public.app_screens WHERE code = _screen_code AND is_active;
  IF _screen_id IS NULL THEN RETURN false; END IF;

  -- explicit deny policies win
  SELECT EXISTS (
    SELECT 1 FROM public.access_policies ap
    WHERE ap.is_active AND ap.effect = 'deny' AND ap.action = _action
      AND (ap.screen_id IS NULL OR ap.screen_id = _screen_id)
      AND (
        (ap.subject_type = 'user' AND ap.subject_id = _user_id)
        OR (ap.subject_type = 'group' AND ap.subject_id IN (SELECT group_id FROM public.user_group_members WHERE user_id = _user_id))
        OR (ap.subject_type = 'user_type' AND ap.subject_id = (SELECT user_type_id FROM public.profiles WHERE id = _user_id))
      )
  ) INTO _denied;
  IF _denied THEN RETURN false; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.screen_permissions sp
    WHERE sp.screen_id = _screen_id
      AND (
        (sp.subject_type = 'user' AND sp.subject_id = _user_id)
        OR (sp.subject_type = 'group' AND sp.subject_id IN (SELECT group_id FROM public.user_group_members WHERE user_id = _user_id))
        OR (sp.subject_type = 'user_type' AND sp.subject_id = (SELECT user_type_id FROM public.profiles WHERE id = _user_id))
      )
      AND CASE _action
        WHEN 'view' THEN sp.can_view
        WHEN 'create' THEN sp.can_create
        WHEN 'edit' THEN sp.can_edit
        WHEN 'delete' THEN sp.can_delete
        WHEN 'approve' THEN sp.can_approve
        WHEN 'post' THEN sp.can_post
        WHEN 'export' THEN sp.can_export
        ELSE false END
  ) INTO _allowed;
  IF _allowed THEN RETURN true; END IF;

  -- ReBAC allow policies based on relations
  RETURN EXISTS (
    SELECT 1 FROM public.access_policies ap
    WHERE ap.is_active AND ap.effect = 'allow' AND ap.action = _action
      AND (ap.screen_id IS NULL OR ap.screen_id = _screen_id)
      AND ap.relation IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.resource_relations rr WHERE rr.user_id = _user_id AND rr.relation = ap.relation)
      AND (
        (ap.subject_type = 'user' AND ap.subject_id = _user_id)
        OR (ap.subject_type = 'group' AND ap.subject_id IN (SELECT group_id FROM public.user_group_members WHERE user_id = _user_id))
        OR (ap.subject_type = 'user_type' AND ap.subject_id = (SELECT user_type_id FROM public.profiles WHERE id = _user_id))
      )
  );
END $$;

CREATE OR REPLACE FUNCTION public.get_effective_screen_permissions(_user_id uuid)
RETURNS TABLE(screen_code varchar, screen_name varchar, module varchar, route varchar,
  can_view boolean, can_create boolean, can_edit boolean, can_delete boolean,
  can_approve boolean, can_post boolean, can_export boolean, scope public.access_scope)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH is_admin AS (SELECT public.has_role(_user_id,'admin') AS ok),
  subj AS (
    SELECT 'user'::public.perm_subject_type AS st, _user_id AS sid
    UNION ALL SELECT 'group', group_id FROM public.user_group_members WHERE user_id = _user_id
    UNION ALL SELECT 'user_type', user_type_id FROM public.profiles WHERE id = _user_id AND user_type_id IS NOT NULL
  ),
  agg AS (
    SELECT sp.screen_id,
      bool_or(sp.can_view) v, bool_or(sp.can_create) c, bool_or(sp.can_edit) e, bool_or(sp.can_delete) d,
      bool_or(sp.can_approve) a, bool_or(sp.can_post) p, bool_or(sp.can_export) x,
      (ARRAY_AGG(sp.scope ORDER BY CASE sp.scope WHEN 'all' THEN 1 WHEN 'branch' THEN 2 WHEN 'department' THEN 3 ELSE 4 END))[1] AS sc
    FROM public.screen_permissions sp JOIN subj ON subj.st = sp.subject_type AND subj.sid = sp.subject_id
    GROUP BY sp.screen_id
  )
  SELECT s.code, s.name, s.module, s.route,
    CASE WHEN (SELECT ok FROM is_admin) THEN true ELSE COALESCE(agg.v,false) END,
    CASE WHEN (SELECT ok FROM is_admin) THEN true ELSE COALESCE(agg.c,false) END,
    CASE WHEN (SELECT ok FROM is_admin) THEN true ELSE COALESCE(agg.e,false) END,
    CASE WHEN (SELECT ok FROM is_admin) THEN true ELSE COALESCE(agg.d,false) END,
    CASE WHEN (SELECT ok FROM is_admin) THEN true ELSE COALESCE(agg.a,false) END,
    CASE WHEN (SELECT ok FROM is_admin) THEN true ELSE COALESCE(agg.p,false) END,
    CASE WHEN (SELECT ok FROM is_admin) THEN true ELSE COALESCE(agg.x,false) END,
    CASE WHEN (SELECT ok FROM is_admin) THEN 'all'::public.access_scope ELSE COALESCE(agg.sc,'own'::public.access_scope) END
  FROM public.app_screens s LEFT JOIN agg ON agg.screen_id = s.id
  WHERE s.is_active;
$$;

CREATE OR REPLACE FUNCTION public.has_relation(_user_id uuid, _relation text, _resource_type text, _resource_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id,'admin') OR EXISTS (
    SELECT 1 FROM public.resource_relations
    WHERE user_id = _user_id AND relation = _relation
      AND resource_type = _resource_type AND resource_id = _resource_id
  );
$$;
