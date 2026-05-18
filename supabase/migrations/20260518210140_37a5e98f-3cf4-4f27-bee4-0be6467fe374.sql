
-- 1) Add 'cashier' role to app_role enum (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum WHERE enumlabel = 'cashier'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'cashier';
  END IF;
END$$;

-- 2) PIN code on profiles (hashed) + manager override flag
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pin_hash text,
  ADD COLUMN IF NOT EXISTS can_override_pos boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_pos_active boolean NOT NULL DEFAULT true;

-- 3) Helper: set/verify PIN (uses crypt from pgcrypto)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_user_pin(_user_id uuid, _pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _pin IS NULL OR length(_pin) < 4 OR length(_pin) > 8 OR _pin !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'PIN must be 4 to 8 digits';
  END IF;

  -- Only admin or the user themselves can set their own pin
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = _user_id) THEN
    RAISE EXCEPTION 'Not authorized to set PIN for this user';
  END IF;

  UPDATE public.profiles
     SET pin_hash = crypt(_pin, gen_salt('bf'))
   WHERE id = _user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_user_pin(_pin text, _branch_id uuid DEFAULT NULL)
RETURNS TABLE(user_id uuid, full_name text, is_manager boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.full_name, p.can_override_pos
    FROM public.profiles p
   WHERE p.pin_hash IS NOT NULL
     AND p.is_pos_active = true
     AND p.pin_hash = crypt(_pin, p.pin_hash)
     AND (
       _branch_id IS NULL
       OR EXISTS (
         SELECT 1 FROM public.user_branch_assignments uba
          WHERE uba.user_id = p.id AND uba.branch_id = _branch_id
       )
       OR public.has_role(p.id, 'admin'::app_role)
     )
   LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_user_pin(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_pin(uuid, text) TO authenticated;
