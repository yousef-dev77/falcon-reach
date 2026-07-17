
-- 1) Loan type enum
DO $$ BEGIN
  CREATE TYPE public.loan_kind AS ENUM ('advance', 'loan');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Extend hr_loans
ALTER TABLE public.hr_loans
  ADD COLUMN IF NOT EXISTS loan_type public.loan_kind NOT NULL DEFAULT 'advance',
  ADD COLUMN IF NOT EXISTS months_count integer,
  ADD COLUMN IF NOT EXISTS manager_approval_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manager_approved_by uuid,
  ADD COLUMN IF NOT EXISTS manager_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Extend loan_status enum with 'pending_approval' if missing
DO $$ BEGIN
  ALTER TYPE public.loan_status ADD VALUE IF NOT EXISTS 'pending_approval';
EXCEPTION WHEN others THEN NULL; END $$;

-- 3) Installments table
CREATE TABLE IF NOT EXISTS public.hr_loan_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.hr_loans(id) ON DELETE CASCADE,
  installment_no integer NOT NULL,
  due_date date NOT NULL,
  amount numeric(14,2) NOT NULL,
  paid_amount numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- pending | paid | partial | skipped
  paid_at timestamptz,
  payslip_id uuid REFERENCES public.hr_payslips(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loan_id, installment_no)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_loan_installments TO authenticated;
GRANT ALL ON public.hr_loan_installments TO service_role;

ALTER TABLE public.hr_loan_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hr staff read installments" ON public.hr_loan_installments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'branch_manager') OR public.has_role(auth.uid(),'hr_manager'));
CREATE POLICY "hr staff manage installments" ON public.hr_loan_installments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr_manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr_manager'));

CREATE TRIGGER trg_upd_hr_loan_installments BEFORE UPDATE ON public.hr_loan_installments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_loan_installments_loan ON public.hr_loan_installments(loan_id);

-- 4) Schedule generator
CREATE OR REPLACE FUNCTION public.generate_loan_schedule(_loan_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  l record;
  n integer;
  i integer;
  d date;
  amt numeric(14,2);
  last_amt numeric(14,2);
BEGIN
  SELECT * INTO l FROM public.hr_loans WHERE id = _loan_id;
  IF l IS NULL THEN RAISE EXCEPTION 'Loan not found'; END IF;

  DELETE FROM public.hr_loan_installments WHERE loan_id = _loan_id;

  IF l.installment_amount IS NULL OR l.installment_amount <= 0 THEN
    n := COALESCE(l.months_count, 1);
    amt := ROUND(l.total_amount / n, 2);
  ELSE
    n := CEIL(l.total_amount / l.installment_amount);
    amt := l.installment_amount;
  END IF;

  last_amt := l.total_amount - amt * (n - 1);
  d := l.start_date;
  FOR i IN 1..n LOOP
    INSERT INTO public.hr_loan_installments(loan_id, installment_no, due_date, amount)
    VALUES (_loan_id, i, d, CASE WHEN i = n THEN last_amt ELSE amt END);
    d := (d + INTERVAL '1 month')::date;
  END LOOP;
END $$;

-- 5) Approval / Activation functions
CREATE OR REPLACE FUNCTION public.request_loan_approval(_loan_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.hr_loans
    SET status = 'pending_approval'::loan_status
  WHERE id = _loan_id AND status = 'draft'::loan_status;
END $$;

CREATE OR REPLACE FUNCTION public.approve_loan(_loan_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l record;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'branch_manager')) THEN
    RAISE EXCEPTION 'Only admin or branch_manager may approve loans';
  END IF;
  SELECT * INTO l FROM public.hr_loans WHERE id = _loan_id;
  IF l IS NULL THEN RAISE EXCEPTION 'Loan not found'; END IF;
  IF l.status NOT IN ('draft'::loan_status,'pending_approval'::loan_status) THEN
    RAISE EXCEPTION 'Loan cannot be approved in current state';
  END IF;

  UPDATE public.hr_loans SET
    status = 'active'::loan_status,
    approved_by = auth.uid(),
    approved_at = now(),
    manager_approved_by = auth.uid(),
    manager_approved_at = now()
  WHERE id = _loan_id;

  PERFORM public.generate_loan_schedule(_loan_id);
END $$;

CREATE OR REPLACE FUNCTION public.reject_loan(_loan_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'branch_manager')) THEN
    RAISE EXCEPTION 'Only admin or branch_manager may reject loans';
  END IF;
  UPDATE public.hr_loans
    SET status = 'cancelled'::loan_status, rejection_reason = _reason
  WHERE id = _loan_id AND status IN ('draft'::loan_status,'pending_approval'::loan_status);
END $$;

-- 6) Loan advance vs loan setting keys (separate GL accounts)
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description, category)
VALUES
  ('default_salary_advance_account_id', NULL, 'account', 'حساب سلف الرواتب (قصيرة الأجل)', 'hr'),
  ('default_employee_loan_account_id', NULL, 'account', 'حساب قروض الموظفين (طويلة الأجل)', 'hr')
ON CONFLICT (setting_key) DO NOTHING;
