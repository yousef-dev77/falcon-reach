
CREATE TABLE IF NOT EXISTS public.installed_modules (
  module_key TEXT PRIMARY KEY,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  installed_by UUID REFERENCES auth.users(id)
);

GRANT SELECT ON public.installed_modules TO authenticated;
GRANT ALL ON public.installed_modules TO service_role;

ALTER TABLE public.installed_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_installed_modules" ON public.installed_modules;
CREATE POLICY "auth_read_installed_modules" ON public.installed_modules
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_manage_installed_modules" ON public.installed_modules;
CREATE POLICY "admin_manage_installed_modules" ON public.installed_modules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.installed_modules(module_key)
VALUES ('finance'), ('settings')
ON CONFLICT DO NOTHING;
