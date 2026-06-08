
REVOKE EXECUTE ON FUNCTION public.reopen_fiscal_period(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reclose_fiscal_period(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_fiscal_period(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reclose_fiscal_period(uuid) TO authenticated;
