-- 1) Remove the legacy conflicting permission layer
DROP TABLE IF EXISTS public.user_permissions CASCADE;
DROP TABLE IF EXISTS public.role_permissions CASCADE;
DROP TABLE IF EXISTS public.permissions CASCADE;

-- 2) Permission change log (screen permissions)
CREATE TABLE public.permission_change_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type public.perm_subject_type NOT NULL,
  subject_id uuid NOT NULL,
  subject_label text,
  screen_id uuid,
  screen_code varchar,
  screen_name varchar,
  action_type text NOT NULL,
  before_state jsonb,
  after_state jsonb,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.permission_change_logs TO authenticated;
GRANT ALL ON public.permission_change_logs TO service_role;

ALTER TABLE public.permission_change_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view permission change logs"
ON public.permission_change_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can insert permission change logs"
ON public.permission_change_logs FOR INSERT TO authenticated
WITH CHECK (true);

CREATE INDEX idx_perm_change_logs_subject ON public.permission_change_logs(subject_type, subject_id);
CREATE INDEX idx_perm_change_logs_created ON public.permission_change_logs(created_at DESC);

-- 3) Policy change log
CREATE TABLE public.policy_change_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid,
  policy_name text,
  action_type text NOT NULL,
  before_state jsonb,
  after_state jsonb,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.policy_change_logs TO authenticated;
GRANT ALL ON public.policy_change_logs TO service_role;

ALTER TABLE public.policy_change_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view policy change logs"
ON public.policy_change_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can insert policy change logs"
ON public.policy_change_logs FOR INSERT TO authenticated
WITH CHECK (true);

CREATE INDEX idx_policy_change_logs_created ON public.policy_change_logs(created_at DESC);

-- 4) Auto-log screen permission changes
CREATE OR REPLACE FUNCTION public.log_screen_permission_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rec record;
  _label text;
  _screen record;
BEGIN
  _rec := COALESCE(NEW, OLD);

  SELECT code, name INTO _screen FROM public.app_screens WHERE id = _rec.screen_id;

  _label := CASE _rec.subject_type
    WHEN 'user_type' THEN (SELECT name FROM public.user_types WHERE id = _rec.subject_id)
    WHEN 'group' THEN (SELECT name FROM public.user_groups WHERE id = _rec.subject_id)
    ELSE (SELECT full_name FROM public.profiles WHERE id = _rec.subject_id)
  END;

  INSERT INTO public.permission_change_logs (
    subject_type, subject_id, subject_label, screen_id, screen_code, screen_name,
    action_type, before_state, after_state, changed_by
  ) VALUES (
    _rec.subject_type, _rec.subject_id, _label, _rec.screen_id, _screen.code, _screen.name,
    lower(TG_OP),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    auth.uid()
  );

  RETURN _rec;
END $$;

DROP TRIGGER IF EXISTS trg_log_screen_permission_change ON public.screen_permissions;
CREATE TRIGGER trg_log_screen_permission_change
AFTER INSERT OR UPDATE OR DELETE ON public.screen_permissions
FOR EACH ROW EXECUTE FUNCTION public.log_screen_permission_change();

-- 5) Auto-log access policy changes
CREATE OR REPLACE FUNCTION public.log_access_policy_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _rec record;
BEGIN
  _rec := COALESCE(NEW, OLD);
  INSERT INTO public.policy_change_logs (
    policy_id, policy_name, action_type, before_state, after_state, changed_by
  ) VALUES (
    _rec.id, _rec.name, lower(TG_OP),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    auth.uid()
  );
  RETURN _rec;
END $$;

DROP TRIGGER IF EXISTS trg_log_access_policy_change ON public.access_policies;
CREATE TRIGGER trg_log_access_policy_change
AFTER INSERT OR UPDATE OR DELETE ON public.access_policies
FOR EACH ROW EXECUTE FUNCTION public.log_access_policy_change();

-- 6) Explain access decision (for the permission simulator)
CREATE OR REPLACE FUNCTION public.explain_screen_access(
  _user_id uuid,
  _screen_code text,
  _action text DEFAULT 'view'
)
RETURNS TABLE(
  step_order int,
  layer text,
  layer_label text,
  source_name text,
  result text,
  is_decisive boolean,
  note text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _screen_id uuid;
  _decided boolean := false;
  _is_admin boolean;
  _ut uuid;
  _found boolean;
  _names text;
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;

  SELECT id INTO _screen_id FROM public.app_screens WHERE code = _screen_code AND is_active;
  SELECT user_type_id INTO _ut FROM public.profiles WHERE id = _user_id;
  _is_admin := public.has_role(_user_id, 'admin');

  -- Layer 0: super admin
  IF _is_admin THEN
    RETURN QUERY SELECT 0, 'admin', 'مسؤول النظام', 'admin'::text, 'allow'::text, true,
      'المسؤول العام يملك كل الصلاحيات دون قيود'::text;
    RETURN;
  END IF;
  RETURN QUERY SELECT 0, 'admin', 'مسؤول النظام', NULL::text, 'skip'::text, false,
    'المستخدم ليس مسؤول نظام'::text;

  IF _screen_id IS NULL THEN
    RETURN QUERY SELECT 1, 'screen', 'الشاشة', _screen_code, 'deny'::text, true,
      'الشاشة غير موجودة أو غير مفعّلة'::text;
    RETURN;
  END IF;

  -- Layer 1: explicit deny policies
  SELECT string_agg(ap.name, '، ') INTO _names
  FROM public.access_policies ap
  WHERE ap.is_active AND ap.effect = 'deny' AND ap.action = _action
    AND (ap.screen_id IS NULL OR ap.screen_id = _screen_id)
    AND (
      (ap.subject_type = 'user' AND ap.subject_id = _user_id)
      OR (ap.subject_type = 'group' AND ap.subject_id IN (SELECT group_id FROM public.user_group_members WHERE user_id = _user_id))
      OR (ap.subject_type = 'user_type' AND ap.subject_id = _ut)
    );

  IF _names IS NOT NULL THEN
    RETURN QUERY SELECT 1, 'deny_policy', 'سياسة منع صريحة', _names, 'deny'::text, true,
      'المنع الصريح يتجاوز كل الصلاحيات الأخرى'::text;
    RETURN;
  END IF;
  RETURN QUERY SELECT 1, 'deny_policy', 'سياسة منع صريحة', NULL::text, 'skip'::text, false,
    'لا توجد سياسة منع مطابقة'::text;

  -- Layer 2: user override
  SELECT EXISTS (
    SELECT 1 FROM public.screen_permissions sp
    WHERE sp.screen_id = _screen_id AND sp.subject_type = 'user' AND sp.subject_id = _user_id
      AND CASE _action
        WHEN 'view' THEN sp.can_view WHEN 'create' THEN sp.can_create
        WHEN 'edit' THEN sp.can_edit WHEN 'delete' THEN sp.can_delete
        WHEN 'approve' THEN sp.can_approve WHEN 'post' THEN sp.can_post
        WHEN 'export' THEN sp.can_export ELSE false END
  ) INTO _found;

  IF _found THEN
    RETURN QUERY SELECT 2, 'user_override', 'استثناء خاص بالمستخدم',
      (SELECT full_name FROM public.profiles WHERE id = _user_id), 'allow'::text, true,
      'صلاحية ممنوحة مباشرة لهذا المستخدم'::text;
    _decided := true;
  ELSE
    RETURN QUERY SELECT 2, 'user_override', 'استثناء خاص بالمستخدم', NULL::text, 'skip'::text, false,
      'لا يوجد استثناء فردي لهذه الشاشة'::text;
  END IF;
  IF _decided THEN RETURN; END IF;

  -- Layer 3: groups
  SELECT string_agg(g.name, '، ') INTO _names
  FROM public.screen_permissions sp
  JOIN public.user_groups g ON g.id = sp.subject_id
  WHERE sp.screen_id = _screen_id AND sp.subject_type = 'group'
    AND sp.subject_id IN (SELECT group_id FROM public.user_group_members WHERE user_id = _user_id)
    AND CASE _action
      WHEN 'view' THEN sp.can_view WHEN 'create' THEN sp.can_create
      WHEN 'edit' THEN sp.can_edit WHEN 'delete' THEN sp.can_delete
      WHEN 'approve' THEN sp.can_approve WHEN 'post' THEN sp.can_post
      WHEN 'export' THEN sp.can_export ELSE false END;

  IF _names IS NOT NULL THEN
    RETURN QUERY SELECT 3, 'group', 'مجموعة المستخدمين', _names, 'allow'::text, true,
      'الصلاحية موروثة من عضوية المجموعة'::text;
    RETURN;
  END IF;
  RETURN QUERY SELECT 3, 'group', 'مجموعة المستخدمين', NULL::text, 'skip'::text, false,
    'لا توجد مجموعة تمنح هذا الإجراء'::text;

  -- Layer 4: user type
  SELECT string_agg(ut.name, '، ') INTO _names
  FROM public.screen_permissions sp
  JOIN public.user_types ut ON ut.id = sp.subject_id
  WHERE sp.screen_id = _screen_id AND sp.subject_type = 'user_type' AND sp.subject_id = _ut
    AND CASE _action
      WHEN 'view' THEN sp.can_view WHEN 'create' THEN sp.can_create
      WHEN 'edit' THEN sp.can_edit WHEN 'delete' THEN sp.can_delete
      WHEN 'approve' THEN sp.can_approve WHEN 'post' THEN sp.can_post
      WHEN 'export' THEN sp.can_export ELSE false END;

  IF _names IS NOT NULL THEN
    RETURN QUERY SELECT 4, 'user_type', 'نوع المستخدم', _names, 'allow'::text, true,
      'الصلاحية موروثة من نوع المستخدم'::text;
    RETURN;
  END IF;
  RETURN QUERY SELECT 4, 'user_type', 'نوع المستخدم',
    (SELECT name FROM public.user_types WHERE id = _ut), 'skip'::text, false,
    'نوع المستخدم لا يمنح هذا الإجراء'::text;

  -- Layer 5: ReBAC relation policies
  SELECT string_agg(ap.name, '، ') INTO _names
  FROM public.access_policies ap
  WHERE ap.is_active AND ap.effect = 'allow' AND ap.action = _action
    AND (ap.screen_id IS NULL OR ap.screen_id = _screen_id)
    AND ap.relation IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.resource_relations rr WHERE rr.user_id = _user_id AND rr.relation = ap.relation)
    AND (
      (ap.subject_type = 'user' AND ap.subject_id = _user_id)
      OR (ap.subject_type = 'group' AND ap.subject_id IN (SELECT group_id FROM public.user_group_members WHERE user_id = _user_id))
      OR (ap.subject_type = 'user_type' AND ap.subject_id = _ut)
    );

  IF _names IS NOT NULL THEN
    RETURN QUERY SELECT 5, 'relation', 'سياسة مبنية على العلاقة', _names, 'allow'::text, true,
      'مسموح بسبب علاقة المستخدم بالسجل'::text;
    RETURN;
  END IF;
  RETURN QUERY SELECT 5, 'relation', 'سياسة مبنية على العلاقة', NULL::text, 'skip'::text, false,
    'لا توجد علاقة مطابقة'::text;

  -- Layer 6: default deny
  RETURN QUERY SELECT 6, 'default', 'الرفض الافتراضي', NULL::text, 'deny'::text, true,
    'لم تُمنح الصلاحية من أي طبقة، فالنتيجة رفض'::text;
END $$;

-- 7) Usage stats for user types and groups
CREATE OR REPLACE FUNCTION public.get_access_subject_stats()
RETURNS TABLE(
  subject_type text,
  subject_id uuid,
  members_count bigint,
  screens_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'user_type'::text, ut.id,
    (SELECT count(*) FROM public.profiles p WHERE p.user_type_id = ut.id),
    (SELECT count(*) FROM public.screen_permissions sp WHERE sp.subject_type = 'user_type' AND sp.subject_id = ut.id AND sp.can_view)
  FROM public.user_types ut
  UNION ALL
  SELECT 'group'::text, g.id,
    (SELECT count(*) FROM public.user_group_members m WHERE m.group_id = g.id),
    (SELECT count(*) FROM public.screen_permissions sp WHERE sp.subject_type = 'group' AND sp.subject_id = g.id AND sp.can_view)
  FROM public.user_groups g;
$$;