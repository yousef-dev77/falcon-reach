
-- 1) أعمدة إضافية على year_end_closings
ALTER TABLE public.year_end_closings
  ADD COLUMN IF NOT EXISTS reopened_at timestamptz,
  ADD COLUMN IF NOT EXISTS reopened_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reopen_reason text;

-- 2) جدول سجل فتح/إقفال الفترات
CREATE TABLE IF NOT EXISTS public.fiscal_period_reopen_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_period_id uuid NOT NULL REFERENCES public.fiscal_periods(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('reopen','reclose')),
  reason text,
  performed_by uuid REFERENCES auth.users(id),
  performed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.fiscal_period_reopen_logs TO authenticated;
GRANT ALL ON public.fiscal_period_reopen_logs TO service_role;

ALTER TABLE public.fiscal_period_reopen_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read reopen logs"
  ON public.fiscal_period_reopen_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert reopen logs"
  ON public.fiscal_period_reopen_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) دالة إعادة فتح السنة المالية (للمسؤول فقط)
CREATE OR REPLACE FUNCTION public.reopen_fiscal_period(_period_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'غير مصرح: يجب أن تكون مسؤولاً لفتح السنة المالية';
  END IF;

  IF _reason IS NULL OR length(trim(_reason)) < 5 THEN
    RAISE EXCEPTION 'يجب إدخال سبب واضح لإعادة الفتح';
  END IF;

  UPDATE public.fiscal_periods
     SET is_closed = false
   WHERE id = _period_id;

  UPDATE public.year_end_closings
     SET status = 'reopened',
         reopened_at = now(),
         reopened_by = auth.uid(),
         reopen_reason = _reason
   WHERE fiscal_period_id = _period_id
     AND status = 'completed';

  INSERT INTO public.fiscal_period_reopen_logs(fiscal_period_id, action, reason, performed_by)
  VALUES (_period_id, 'reopen', _reason, auth.uid());
END;
$$;

-- 4) دالة إعادة إقفال السنة بعد التعديل
CREATE OR REPLACE FUNCTION public.reclose_fiscal_period(_period_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'غير مصرح: يجب أن تكون مسؤولاً لإقفال السنة المالية';
  END IF;

  UPDATE public.fiscal_periods
     SET is_closed = true
   WHERE id = _period_id;

  UPDATE public.year_end_closings
     SET status = 'completed'
   WHERE fiscal_period_id = _period_id
     AND status = 'reopened';

  INSERT INTO public.fiscal_period_reopen_logs(fiscal_period_id, action, reason, performed_by)
  VALUES (_period_id, 'reclose', 'إعادة إقفال بعد التعديل', auth.uid());
END;
$$;
