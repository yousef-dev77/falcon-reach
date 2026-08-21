CREATE OR REPLACE FUNCTION public.get_effective_screen_permissions(_user_id uuid)
RETURNS TABLE(
  screen_code varchar,
  screen_name varchar,
  module varchar,
  route varchar,
  can_view boolean,
  can_create boolean,
  can_edit boolean,
  can_delete boolean,
  can_approve boolean,
  can_post boolean,
  can_export boolean,
  scope public.access_scope
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH authorized AS (
    SELECT (
      auth.uid() = _user_id
      OR public.has_role(auth.uid(), 'admin')
      OR COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
    ) AS ok
  ),
  identity AS (
    SELECT
      public.has_role(_user_id, 'admin') AS is_admin,
      (SELECT p.user_type_id FROM public.profiles p WHERE p.id = _user_id) AS user_type_id
    FROM authorized a
    WHERE a.ok
  ),
  inherited AS (
    SELECT
      sp.screen_id,
      bool_or(sp.can_view) AS can_view,
      bool_or(sp.can_create) AS can_create,
      bool_or(sp.can_edit) AS can_edit,
      bool_or(sp.can_delete) AS can_delete,
      bool_or(sp.can_approve) AS can_approve,
      bool_or(sp.can_post) AS can_post,
      bool_or(sp.can_export) AS can_export,
      (array_agg(sp.scope ORDER BY CASE sp.scope
        WHEN 'all' THEN 1 WHEN 'branch' THEN 2 WHEN 'department' THEN 3 ELSE 4 END))[1] AS scope
    FROM public.screen_permissions sp
    CROSS JOIN identity i
    WHERE
      (sp.subject_type = 'user_type' AND sp.subject_id = i.user_type_id)
      OR
      (sp.subject_type = 'group' AND sp.subject_id IN (
        SELECT ugm.group_id FROM public.user_group_members ugm WHERE ugm.user_id = _user_id
      ))
    GROUP BY sp.screen_id
  ),
  individual AS (
    SELECT sp.*
    FROM public.screen_permissions sp
    CROSS JOIN identity i
    WHERE sp.subject_type = 'user' AND sp.subject_id = _user_id
  )
  SELECT
    s.code,
    s.name,
    s.module,
    s.route,
    CASE WHEN i.is_admin THEN true WHEN COALESCE(u.deny_view, false) THEN false ELSE COALESCE(u.can_view, false) OR COALESCE(h.can_view, false) END,
    CASE WHEN i.is_admin THEN true WHEN COALESCE(u.deny_create, false) THEN false ELSE COALESCE(u.can_create, false) OR COALESCE(h.can_create, false) END,
    CASE WHEN i.is_admin THEN true WHEN COALESCE(u.deny_edit, false) THEN false ELSE COALESCE(u.can_edit, false) OR COALESCE(h.can_edit, false) END,
    CASE WHEN i.is_admin THEN true WHEN COALESCE(u.deny_delete, false) THEN false ELSE COALESCE(u.can_delete, false) OR COALESCE(h.can_delete, false) END,
    CASE WHEN i.is_admin THEN true WHEN COALESCE(u.deny_approve, false) THEN false ELSE COALESCE(u.can_approve, false) OR COALESCE(h.can_approve, false) END,
    CASE WHEN i.is_admin THEN true WHEN COALESCE(u.deny_post, false) THEN false ELSE COALESCE(u.can_post, false) OR COALESCE(h.can_post, false) END,
    CASE WHEN i.is_admin THEN true WHEN COALESCE(u.deny_export, false) THEN false ELSE COALESCE(u.can_export, false) OR COALESCE(h.can_export, false) END,
    CASE
      WHEN i.is_admin THEN 'all'::public.access_scope
      WHEN u.screen_id IS NOT NULL AND (u.can_view OR u.can_create OR u.can_edit OR u.can_delete OR u.can_approve OR u.can_post OR u.can_export) THEN u.scope
      ELSE COALESCE(h.scope, 'own'::public.access_scope)
    END
  FROM public.app_screens s
  CROSS JOIN identity i
  LEFT JOIN inherited h ON h.screen_id = s.id
  LEFT JOIN individual u ON u.screen_id = s.id
  WHERE s.is_active;
$$;

CREATE OR REPLACE FUNCTION public.explain_screen_access(
  _user_id uuid,
  _screen_code text,
  _action text DEFAULT 'view'
)
RETURNS TABLE(
  step_order integer,
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
  _user_type_id uuid;
  _source text;
  _matched boolean;
  _denied boolean;
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;

  IF NOT (
    auth.uid() = _user_id
    OR public.has_role(auth.uid(), 'admin')
    OR COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
  ) THEN
    RETURN QUERY SELECT 0, 'security', 'التحقق الأمني', NULL::text, 'deny', true,
      'لا يسمح لك بمراجعة صلاحيات مستخدم آخر.';
    RETURN;
  END IF;

  SELECT s.id INTO _screen_id
  FROM public.app_screens s
  WHERE s.code = _screen_code AND s.is_active;

  IF public.has_role(_user_id, 'admin') THEN
    RETURN QUERY SELECT 0, 'admin', 'مسؤول النظام', 'مسؤول النظام'::text, 'allow', true,
      'مسؤول النظام يملك وصولاً كاملاً.';
    RETURN;
  END IF;

  RETURN QUERY SELECT 0, 'admin', 'مسؤول النظام', NULL::text, 'skip', false,
    'المستخدم ليس مسؤول النظام.';

  IF _screen_id IS NULL THEN
    RETURN QUERY SELECT 1, 'screen', 'الشاشة', _screen_code, 'deny', true,
      'الشاشة غير موجودة أو غير مفعلة.';
    RETURN;
  END IF;

  SELECT CASE _action
    WHEN 'view' THEN sp.deny_view WHEN 'create' THEN sp.deny_create
    WHEN 'edit' THEN sp.deny_edit WHEN 'delete' THEN sp.deny_delete
    WHEN 'approve' THEN sp.deny_approve WHEN 'post' THEN sp.deny_post
    WHEN 'export' THEN sp.deny_export ELSE false END
  INTO _denied
  FROM public.screen_permissions sp
  WHERE sp.screen_id = _screen_id AND sp.subject_type = 'user' AND sp.subject_id = _user_id;

  IF COALESCE(_denied, false) THEN
    RETURN QUERY SELECT 1, 'user_exception', 'استثناء المستخدم',
      (SELECT p.full_name FROM public.profiles p WHERE p.id = _user_id), 'deny', true,
      'يوجد استثناء فردي يمنع هذا الإجراء، لذلك يتجاوز الصلاحيات الموروثة.';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.screen_permissions sp
    WHERE sp.screen_id = _screen_id AND sp.subject_type = 'user' AND sp.subject_id = _user_id
      AND CASE _action
        WHEN 'view' THEN sp.can_view WHEN 'create' THEN sp.can_create
        WHEN 'edit' THEN sp.can_edit WHEN 'delete' THEN sp.can_delete
        WHEN 'approve' THEN sp.can_approve WHEN 'post' THEN sp.can_post
        WHEN 'export' THEN sp.can_export ELSE false END
  ) INTO _matched;

  IF _matched THEN
    RETURN QUERY SELECT 1, 'user_exception', 'استثناء المستخدم',
      (SELECT p.full_name FROM public.profiles p WHERE p.id = _user_id), 'allow', true,
      'يوجد استثناء فردي يمنح هذا الإجراء.';
    RETURN;
  END IF;

  RETURN QUERY SELECT 1, 'user_exception', 'استثناء المستخدم', NULL::text, 'skip', false,
    'لا يوجد استثناء فردي لهذا الإجراء.';

  SELECT string_agg(g.name, '، ')
  INTO _source
  FROM public.screen_permissions sp
  JOIN public.user_groups g ON g.id = sp.subject_id
  WHERE sp.screen_id = _screen_id
    AND sp.subject_type = 'group'
    AND sp.subject_id IN (SELECT ugm.group_id FROM public.user_group_members ugm WHERE ugm.user_id = _user_id)
    AND CASE _action
      WHEN 'view' THEN sp.can_view WHEN 'create' THEN sp.can_create
      WHEN 'edit' THEN sp.can_edit WHEN 'delete' THEN sp.can_delete
      WHEN 'approve' THEN sp.can_approve WHEN 'post' THEN sp.can_post
      WHEN 'export' THEN sp.can_export ELSE false END;

  IF _source IS NOT NULL THEN
    RETURN QUERY SELECT 2, 'group', 'مجموعة الصلاحيات', _source, 'allow', true,
      'الصلاحية موروثة من عضوية المستخدم في المجموعة.';
    RETURN;
  END IF;

  RETURN QUERY SELECT 2, 'group', 'مجموعة الصلاحيات', NULL::text, 'skip', false,
    'لا توجد مجموعة تمنح هذا الإجراء.';

  SELECT p.user_type_id INTO _user_type_id FROM public.profiles p WHERE p.id = _user_id;

  SELECT ut.name INTO _source
  FROM public.screen_permissions sp
  JOIN public.user_types ut ON ut.id = sp.subject_id
  WHERE sp.screen_id = _screen_id
    AND sp.subject_type = 'user_type'
    AND sp.subject_id = _user_type_id
    AND CASE _action
      WHEN 'view' THEN sp.can_view WHEN 'create' THEN sp.can_create
      WHEN 'edit' THEN sp.can_edit WHEN 'delete' THEN sp.can_delete
      WHEN 'approve' THEN sp.can_approve WHEN 'post' THEN sp.can_post
      WHEN 'export' THEN sp.can_export ELSE false END
  LIMIT 1;

  IF _source IS NOT NULL THEN
    RETURN QUERY SELECT 3, 'user_type', 'نوع المستخدم', _source, 'allow', true,
      'الصلاحية موروثة من نوع المستخدم الأساسي.';
    RETURN;
  END IF;

  RETURN QUERY SELECT 3, 'user_type', 'نوع المستخدم',
    (SELECT ut.name FROM public.user_types ut WHERE ut.id = _user_type_id), 'skip', false,
    'نوع المستخدم لا يمنح هذا الإجراء.';

  RETURN QUERY SELECT 4, 'default', 'الرفض الافتراضي', NULL::text, 'deny', true,
    'لم يمنح نوع المستخدم أو أي مجموعة أو استثناء هذا الإجراء.';
END;
$$;

REVOKE ALL ON FUNCTION public.get_effective_screen_permissions(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_screen_access(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.explain_screen_access(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_effective_screen_permissions(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_screen_access(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.explain_screen_access(uuid, text, text) TO authenticated, service_role;