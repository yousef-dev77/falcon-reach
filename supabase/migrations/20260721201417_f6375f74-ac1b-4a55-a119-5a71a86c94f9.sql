
-- 1) Add new loan status
ALTER TYPE loan_status ADD VALUE IF NOT EXISTS 'pending_disbursement';

-- 2) HR payment vouchers table
CREATE TABLE IF NOT EXISTS public.hr_payment_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_number TEXT NOT NULL UNIQUE,
  voucher_date DATE NOT NULL DEFAULT CURRENT_DATE,
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id),
  loan_id UUID REFERENCES public.hr_loans(id) ON DELETE SET NULL,
  voucher_type TEXT NOT NULL DEFAULT 'loan_disbursement',
  amount NUMERIC(15,2) NOT NULL,
  description TEXT,
  branch_id UUID REFERENCES public.branches(id),
  status TEXT NOT NULL DEFAULT 'draft', -- draft | posted | rejected
  disbursement_account_id UUID,         -- filled by finance (bank/cash)
  disbursement_kind TEXT,               -- 'bank' | 'cash' set by finance
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  rejection_reason TEXT,
  created_by UUID,
  posted_by UUID,
  posted_at TIMESTAMPTZ,
  rejected_by UUID,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_payment_vouchers TO authenticated;
GRANT ALL ON public.hr_payment_vouchers TO service_role;

ALTER TABLE public.hr_payment_vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read hr vouchers" ON public.hr_payment_vouchers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write hr vouchers" ON public.hr_payment_vouchers
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update hr vouchers" ON public.hr_payment_vouchers
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_hr_vouchers_updated
  BEFORE UPDATE ON public.hr_payment_vouchers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_hr_vouchers_status ON public.hr_payment_vouchers(status);
CREATE INDEX IF NOT EXISTS idx_hr_vouchers_loan ON public.hr_payment_vouchers(loan_id);

-- 3) Rewrite approve_loan: NO journal entry, NO account. Create draft voucher for finance.
CREATE OR REPLACE FUNCTION public.approve_loan(_loan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l RECORD;
  v_voucher_number TEXT;
  v_seq INT;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'branch_manager') OR public.has_role(auth.uid(),'hr_manager')) THEN
    RAISE EXCEPTION 'غير مصرح باعتماد القروض';
  END IF;

  SELECT * INTO l FROM public.hr_loans WHERE id = _loan_id;
  IF l IS NULL THEN RAISE EXCEPTION 'القرض غير موجود'; END IF;
  IF l.status NOT IN ('draft'::loan_status,'pending_approval'::loan_status) THEN
    RAISE EXCEPTION 'لا يمكن اعتماد القرض في حالته الحالية';
  END IF;

  UPDATE public.hr_loans SET
    status = 'pending_disbursement'::loan_status,
    approved_by = auth.uid(),
    approved_at = now(),
    manager_approved_by = auth.uid(),
    manager_approved_at = now()
  WHERE id = _loan_id;

  PERFORM public.generate_loan_schedule(_loan_id);

  -- Create draft voucher for finance
  SELECT COALESCE(COUNT(*),0)+1 INTO v_seq FROM public.hr_payment_vouchers
    WHERE voucher_number LIKE 'HRV-' || to_char(now(),'YYYYMM') || '-%';
  v_voucher_number := 'HRV-' || to_char(now(),'YYYYMM') || '-' || lpad(v_seq::text, 4, '0');

  INSERT INTO public.hr_payment_vouchers (
    voucher_number, voucher_date, employee_id, loan_id, voucher_type,
    amount, description, status, created_by
  ) VALUES (
    v_voucher_number, CURRENT_DATE, l.employee_id, l.id,
    CASE WHEN l.loan_type = 'advance' THEN 'advance_disbursement' ELSE 'loan_disbursement' END,
    l.total_amount,
    CASE WHEN l.loan_type = 'advance' THEN 'صرف سلفة ' ELSE 'صرف قرض ' END || l.loan_number,
    'draft', auth.uid()
  );
END;
$$;

-- 4) Post HR voucher (finance side): creates JE and activates loan.
CREATE OR REPLACE FUNCTION public.post_hr_voucher(
  _voucher_id uuid,
  _bank_account_id uuid DEFAULT NULL,
  _cash_box_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v RECORD;
  _employee_loans_account UUID;
  _credit_account UUID;
  _kind TEXT;
  _acc_id UUID;
  _entry_id UUID;
  _entry_number TEXT;
  _seq INT;
  _emp RECORD;
BEGIN
  SELECT * INTO v FROM public.hr_payment_vouchers WHERE id = _voucher_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'السند غير موجود'; END IF;
  IF v.status <> 'draft' THEN RAISE EXCEPTION 'السند ليس في حالة مسودة'; END IF;
  IF _bank_account_id IS NULL AND _cash_box_id IS NULL THEN
    RAISE EXCEPTION 'يجب اختيار حساب الصرف (بنك أو صندوق)';
  END IF;

  -- Get credit account (bank/cash)
  IF _bank_account_id IS NOT NULL THEN
    SELECT account_id INTO _credit_account FROM public.bank_accounts WHERE id = _bank_account_id;
    _kind := 'bank'; _acc_id := _bank_account_id;
  ELSE
    SELECT account_id INTO _credit_account FROM public.cash_boxes WHERE id = _cash_box_id;
    _kind := 'cash'; _acc_id := _cash_box_id;
  END IF;
  IF _credit_account IS NULL THEN RAISE EXCEPTION 'حساب البنك/الصندوق غير مربوط بحساب في الدليل'; END IF;

  -- Debit: employee loans receivable
  SELECT setting_value::uuid INTO _employee_loans_account
    FROM public.system_settings WHERE setting_key = 'default_employee_loans_account_id';
  IF _employee_loans_account IS NULL THEN
    RAISE EXCEPTION 'يجب تحديد حساب ذمم قروض الموظفين في الإعدادات';
  END IF;

  SELECT * INTO _emp FROM public.hr_employees WHERE id = v.employee_id;

  -- Create JE
  _seq := (SELECT COUNT(*)+1 FROM public.journal_entries WHERE entry_number LIKE 'JE-HR-' || to_char(now(),'YYYYMM') || '-%');
  _entry_number := 'JE-HR-' || to_char(now(),'YYYYMM') || '-' || lpad(_seq::text, 4, '0');

  INSERT INTO public.journal_entries (entry_number, entry_date, description, reference, is_posted, created_by, branch_id)
  VALUES (_entry_number, CURRENT_DATE, v.description || ' — ' || COALESCE(_emp.full_name,''), v.voucher_number, true, auth.uid(), v.branch_id)
  RETURNING id INTO _entry_id;

  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
  VALUES
    (_entry_id, _employee_loans_account, v.amount, 0, v.description || ' — ' || COALESCE(_emp.full_name,'')),
    (_entry_id, _credit_account, 0, v.amount, 'صرف من ' || CASE WHEN _kind='bank' THEN 'البنك' ELSE 'الصندوق' END);

  UPDATE public.hr_payment_vouchers SET
    status = 'posted',
    disbursement_account_id = _acc_id,
    disbursement_kind = _kind,
    journal_entry_id = _entry_id,
    posted_by = auth.uid(),
    posted_at = now()
  WHERE id = _voucher_id;

  -- Activate the loan
  IF v.loan_id IS NOT NULL THEN
    UPDATE public.hr_loans SET
      status = 'active'::loan_status,
      disbursement_journal_entry_id = _entry_id
    WHERE id = v.loan_id;
  END IF;

  RETURN _entry_id;
END;
$$;

-- 5) Reject HR voucher: cancel loan, notify HR.
CREATE OR REPLACE FUNCTION public.reject_hr_voucher(_voucher_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v RECORD;
BEGIN
  SELECT * INTO v FROM public.hr_payment_vouchers WHERE id = _voucher_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'السند غير موجود'; END IF;
  IF v.status <> 'draft' THEN RAISE EXCEPTION 'السند ليس مسودة'; END IF;

  UPDATE public.hr_payment_vouchers SET
    status = 'rejected',
    rejection_reason = _reason,
    rejected_by = auth.uid(),
    rejected_at = now()
  WHERE id = _voucher_id;

  IF v.loan_id IS NOT NULL THEN
    UPDATE public.hr_loans SET
      status = 'cancelled'::loan_status,
      rejection_reason = _reason
    WHERE id = v.loan_id;
    DELETE FROM public.hr_loan_installments WHERE loan_id = v.loan_id;
  END IF;
END;
$$;

-- 6) Rewrite post_payroll_run: single aggregate JE, no GOSI, no per-employee lines.
CREATE OR REPLACE FUNCTION public.post_payroll_run(_run_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run RECORD;
  v_entry_id UUID;
  v_entry_number TEXT;
  v_salary_expense UUID;
  v_salary_payable UUID;
  v_loans_account UUID;
  v_seq INT;
  v_gross NUMERIC;
  v_deductions NUMERIC;
  v_loans NUMERIC;
  v_net NUMERIC;
  v_payslip RECORD;
  v_installment RECORD;
  v_remaining_deduction NUMERIC;
BEGIN
  SELECT * INTO v_run FROM public.hr_payroll_runs WHERE id = _run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'تشغيل الرواتب غير موجود'; END IF;
  IF v_run.status <> 'calculated' THEN RAISE EXCEPTION 'يجب حساب الرواتب أولاً'; END IF;
  IF v_run.branch_id IS NULL THEN RAISE EXCEPTION 'يجب أن يكون التشغيل لفرع محدد'; END IF;

  SELECT setting_value::uuid INTO v_salary_expense FROM public.system_settings WHERE setting_key = 'default_salary_expense_account_id';
  SELECT setting_value::uuid INTO v_salary_payable FROM public.system_settings WHERE setting_key = 'default_salary_payable_account_id';
  SELECT setting_value::uuid INTO v_loans_account  FROM public.system_settings WHERE setting_key = 'default_employee_loans_account_id';

  IF v_salary_expense IS NULL OR v_salary_payable IS NULL THEN
    RAISE EXCEPTION 'يجب تحديد حسابي مصروف الرواتب ورواتب مستحقة الدفع في الإعدادات';
  END IF;

  v_gross := COALESCE(v_run.total_gross, 0);
  v_deductions := COALESCE(v_run.total_deductions, 0);
  v_loans := COALESCE(v_run.total_loans, 0);
  v_net := COALESCE(v_run.total_net, 0);

  -- Single aggregate JE
  v_seq := (SELECT COUNT(*)+1 FROM public.journal_entries WHERE entry_number LIKE 'JE-PAY-' || to_char(now(),'YYYYMM') || '-%');
  v_entry_number := 'JE-PAY-' || to_char(now(),'YYYYMM') || '-' || lpad(v_seq::text, 4, '0');

  INSERT INTO public.journal_entries (entry_number, entry_date, description, reference, is_posted, created_by, branch_id)
  VALUES (v_entry_number, v_run.period_end, 'رواتب ' || v_run.month || '/' || v_run.year, v_run.run_number, true, auth.uid(), v_run.branch_id)
  RETURNING id INTO v_entry_id;

  -- Dr Salary Expense (gross)
  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
  VALUES (v_entry_id, v_salary_expense, v_gross, 0, 'إجمالي الرواتب — ' || v_run.run_number);

  -- Cr Employee Loans (loans deducted)
  IF v_loans > 0 AND v_loans_account IS NOT NULL THEN
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
    VALUES (v_entry_id, v_loans_account, 0, v_loans, 'خصم أقساط قروض/سلف');
  END IF;

  -- Cr Salary Payable (net + other deductions collapsed)
  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
  VALUES (v_entry_id, v_salary_payable, 0, v_net + v_deductions, 'رواتب مستحقة الدفع');

  -- Mark installments as paid (preserve linkage without adding JE lines)
  FOR v_payslip IN SELECT * FROM public.hr_payslips WHERE payroll_run_id = _run_id LOOP
    v_remaining_deduction := COALESCE(v_payslip.loan_deduction, 0);
    IF v_remaining_deduction <= 0 THEN CONTINUE; END IF;

    FOR v_installment IN
      SELECT i.* FROM public.hr_loan_installments i
      JOIN public.hr_loans l ON l.id = i.loan_id
      WHERE l.employee_id = v_payslip.employee_id
        AND l.status = 'active'::loan_status
        AND i.status = 'pending'
      ORDER BY i.due_date ASC
    LOOP
      EXIT WHEN v_remaining_deduction <= 0;
      IF v_installment.amount <= v_remaining_deduction THEN
        UPDATE public.hr_loan_installments SET
          status = 'paid',
          paid_at = now(),
          paid_amount = v_installment.amount,
          payslip_id = v_payslip.id
        WHERE id = v_installment.id;
        UPDATE public.hr_loans SET
          paid_amount = paid_amount + v_installment.amount,
          remaining_amount = GREATEST(remaining_amount - v_installment.amount, 0),
          status = CASE WHEN remaining_amount - v_installment.amount <= 0 THEN 'completed'::loan_status ELSE status END
        WHERE id = v_installment.loan_id;
        v_remaining_deduction := v_remaining_deduction - v_installment.amount;
      ELSE
        EXIT;
      END IF;
    END LOOP;
  END LOOP;

  UPDATE public.hr_payroll_runs SET
    status = 'posted',
    journal_entry_id = v_entry_id,
    posted_at = now(),
    posted_by = auth.uid()
  WHERE id = _run_id;

  RETURN v_entry_id;
END;
$$;
