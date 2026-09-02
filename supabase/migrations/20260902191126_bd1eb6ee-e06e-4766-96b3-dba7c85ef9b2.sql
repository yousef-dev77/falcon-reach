REVOKE EXECUTE ON FUNCTION public.claim_idempotency_key(text,text,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.complete_idempotency_key(text,text,jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.claim_idempotency_key(text,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_idempotency_key(text,text,jsonb) TO authenticated, service_role;