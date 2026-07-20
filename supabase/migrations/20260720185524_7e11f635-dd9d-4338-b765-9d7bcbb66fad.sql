
-- 1) Extend hr_loans
ALTER TABLE public.hr_loans
  ADD COLUMN IF NOT EXISTS disbursement_account_id uuid,
  ADD COLUMN IF NOT EXISTS disbursement_journal_entry_id uuid REFERENCES public.journal_entries(id),
  ADD COLUMN IF NOT EXISTS max_installment_pct numeric(5,2) NOT NULL DEFAULT 33.33;

-- 2) hr_loan_payments — manual repayments (early / partial / lump-sum)
CREATE TABLE IF NOT EXISTS public.hr_loan_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.hr_loans(id) ON DELETE CASCADE,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  payment_account_id uuid NOT NULL,
  journal_entry_id uuid REFERENCES public.journal_entries(id),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_loan_payments TO authenticated;
GRANT ALL ON public.hr_loan_payments TO service_role;
ALTER TABLE public.hr_loan_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loan payments hr manage" ON public.hr_loan_payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr_manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr_manager'));
CREATE POLICY "loan payments read own" ON public.hr_loan_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hr_loans l JOIN public.hr_employees e ON e.id=l.employee_id
                 WHERE l.id=hr_loan_payments.loan_id AND e.user_id=auth.uid()));
CREATE TRIGGER trg_upd_hr_loan_payments BEFORE UPDATE ON public.hr_loan_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_loan_payments_loan ON public.hr_loan_payments(loan_id);

-- 3) approve_loan: create disbursement JE + salary ratio check
CREATE OR REPLACE FUNCTION public.approve_loan(_loan_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  l record; emp record; _basic numeric;
  _loans_account uuid; _entry_id uuid; _entry_number text;
  _cash_account uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'branch_manager') OR public.has_role(auth.uid(),'hr_manager')) THEN
    RAISE EXCEPTION 'غير مصرح باعتماد القروض';
  END IF;

  SELECT * INTO l FROM public.hr_loans WHERE id = _loan_id FOR UPDATE;
  IF l IS NULL THEN RAISE EXCEPTION 'القرض غير موجود'; END IF;
  IF l.status NOT IN ('draft'::loan_status,'pending_approval'::loan_status) THEN
    RAISE EXCEPTION 'لا يمكن اعتماد القرض في حالته الحالية';
  END IF;

  -- Salary ratio validation
  SELECT * INTO emp FROM public.hr_employees WHERE id = l.employee_id;
  _basic := COALESCE(emp.basic_salary, 0);
  IF _basic > 0 AND l.installment_amount > (_basic * l.max_installment_pct / 100.0) THEN
    RAISE EXCEPTION 'القسط الشهري (%) يتجاوز الحد المسموح (% من الراتب الأساسي = %)',
      l.installment_amount, l.max_installment_pct || '%', ROUND(_basic * l.max_installment_pct / 100.0, 2);
  END IF;

  -- Disbursement JE (Dr Loans Receivable / Cr Cash-Bank) if disbursement account provided
  IF l.disbursement_account_id IS NOT NULL THEN
    SELECT setting_value::uuid INTO _loans_account
      FROM public.system_settings
      WHERE setting_key = CASE WHEN l.loan_type = 'advance' THEN 'default_salary_advances_account_id'
                               ELSE 'default_employee_loans_account_id' END;
    IF _loans_account IS NULL THEN
      SELECT setting_value::uuid INTO _loans_account FROM public.system_settings
        WHERE setting_key = 'default_employee_loans_account_id';
    END IF;
    IF _loans_account IS NULL THEN
      RAISE EXCEPTION 'يجب تحديد حساب ذمم القروض/السلف في الإعدادات';
    END IF;

    -- Resolve cash/bank account_id
    SELECT account_id INTO _cash_account FROM public.bank_accounts WHERE id = l.disbursement_account_id;
    IF _cash_account IS NULL THEN
      SELECT account_id INTO _cash_account FROM public.cash_boxes WHERE id = l.disbursement_account_id;
    END IF;
    IF _cash_account IS NULL THEN
      RAISE EXCEPTION 'حساب الصرف غير مربوط بحساب في الدليل المحاسبي';
    END IF;

    _entry_number := COALESCE(public.get_next_document_number(NULL, 'journal_entry'),
                              'JE-LN-' || to_char(now(),'YYYYMMDDHH24MISS'));
    INSERT INTO public.journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
    VALUES (_entry_number, l.start_date,
      CASE WHEN l.loan_type='advance' THEN 'صرف سلفة ' ELSE 'صرف قرض ' END || l.loan_number || ' — ' || emp.full_name,
      l.loan_number, auth.uid(), true)
    RETURNING id INTO _entry_id;

    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description) VALUES
      (_entry_id, _loans_account, l.total_amount, 0, 'ذمم '||emp.full_name),
      (_entry_id, _cash_account, 0, l.total_amount, 'صرف نقدي/بنكي');
  END IF;

  UPDATE public.hr_loans SET
    status = 'active'::loan_status,
    approved_by = auth.uid(), approved_at = now(),
    manager_approved_by = auth.uid(), manager_approved_at = now(),
    disbursement_journal_entry_id = _entry_id
  WHERE id = _loan_id;

  PERFORM public.generate_loan_schedule(_loan_id);
END $$;

-- 4) record_loan_payment: manual repayment (partial / full / early)
CREATE OR REPLACE FUNCTION public.record_loan_payment(
  _loan_id uuid, _amount numeric, _payment_account_id uuid,
  _payment_date date DEFAULT CURRENT_DATE, _notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  l record; emp record;
  _loans_account uuid; _cash_account uuid;
  _entry_id uuid; _entry_number text;
  _new_remaining numeric;
  _payment_id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr_manager')) THEN
    RAISE EXCEPTION 'غير مصرح بتسجيل سداد القروض';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'المبلغ يجب أن يكون أكبر من صفر'; END IF;

  SELECT * INTO l FROM public.hr_loans WHERE id = _loan_id FOR UPDATE;
  IF l IS NULL THEN RAISE EXCEPTION 'القرض غير موجود'; END IF;
  IF l.status <> 'active'::loan_status THEN RAISE EXCEPTION 'القرض غير نشط'; END IF;
  IF _amount > l.remaining_amount + 0.01 THEN
    RAISE EXCEPTION 'المبلغ (%) يتجاوز المتبقي (%)', _amount, l.remaining_amount;
  END IF;

  SELECT * INTO emp FROM public.hr_employees WHERE id = l.employee_id;

  SELECT setting_value::uuid INTO _loans_account FROM public.system_settings
    WHERE setting_key = CASE WHEN l.loan_type='advance' THEN 'default_salary_advances_account_id'
                             ELSE 'default_employee_loans_account_id' END;
  IF _loans_account IS NULL THEN
    SELECT setting_value::uuid INTO _loans_account FROM public.system_settings
      WHERE setting_key = 'default_employee_loans_account_id';
  END IF;
  IF _loans_account IS NULL THEN RAISE EXCEPTION 'يجب تحديد حساب ذمم القروض في الإعدادات'; END IF;

  SELECT account_id INTO _cash_account FROM public.bank_accounts WHERE id = _payment_account_id;
  IF _cash_account IS NULL THEN
    SELECT account_id INTO _cash_account FROM public.cash_boxes WHERE id = _payment_account_id;
  END IF;
  IF _cash_account IS NULL THEN RAISE EXCEPTION 'حساب الاستلام غير مربوط بحساب محاسبي'; END IF;

  -- JE: Dr Cash / Cr Loans Receivable
  _entry_number := COALESCE(public.get_next_document_number(NULL, 'journal_entry'),
                            'JE-LP-' || to_char(now(),'YYYYMMDDHH24MISS'));
  INSERT INTO public.journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES (_entry_number, _payment_date,
    'سداد قرض ' || l.loan_number || ' — ' || emp.full_name, l.loan_number, auth.uid(), true)
  RETURNING id INTO _entry_id;

  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description) VALUES
    (_entry_id, _cash_account, _amount, 0, 'استلام سداد'),
    (_entry_id, _loans_account, 0, _amount, 'تخفيض ذمم '||emp.full_name);

  INSERT INTO public.hr_loan_payments(loan_id, payment_date, amount, payment_account_id, journal_entry_id, notes, created_by)
  VALUES (_loan_id, _payment_date, _amount, _payment_account_id, _entry_id, _notes, auth.uid())
  RETURNING id INTO _payment_id;

  _new_remaining := l.remaining_amount - _amount;
  UPDATE public.hr_loans SET
    paid_amount = paid_amount + _amount,
    remaining_amount = _new_remaining,
    status = CASE WHEN _new_remaining <= 0.01 THEN 'completed'::loan_status ELSE status END
  WHERE id = _loan_id;

  RETURN _payment_id;
END $$;

-- 5) post_payroll_run: per-employee JE lines
CREATE OR REPLACE FUNCTION public.post_payroll_run(_run_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run RECORD; v_entry_id uuid; v_entry_number text;
  v_salary_expense uuid; v_salary_payable uuid; v_gosi_payable uuid; v_loans_account uuid; v_advances_account uuid;
  v_ps RECORD; v_loan RECORD; v_total_employer_gosi numeric := 0;
BEGIN
  SELECT * INTO v_run FROM public.hr_payroll_runs WHERE id = _run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'تشغيل الرواتب غير موجود'; END IF;
  IF v_run.status <> 'calculated' THEN RAISE EXCEPTION 'يجب حساب الرواتب أولاً'; END IF;
  IF v_run.branch_id IS NULL THEN RAISE EXCEPTION 'يجب اختيار فرع قبل الترحيل'; END IF;

  SELECT setting_value::uuid INTO v_salary_expense FROM public.system_settings WHERE setting_key='default_salary_expense_account_id';
  SELECT setting_value::uuid INTO v_salary_payable FROM public.system_settings WHERE setting_key='default_salary_payable_account_id';
  SELECT setting_value::uuid INTO v_gosi_payable   FROM public.system_settings WHERE setting_key='default_gosi_payable_account_id';
  SELECT setting_value::uuid INTO v_loans_account  FROM public.system_settings WHERE setting_key='default_employee_loans_account_id';
  SELECT setting_value::uuid INTO v_advances_account FROM public.system_settings WHERE setting_key='default_salary_advances_account_id';
  IF v_advances_account IS NULL THEN v_advances_account := v_loans_account; END IF;

  IF v_salary_expense IS NULL OR v_salary_payable IS NULL THEN
    RAISE EXCEPTION 'يجب تحديد حساب مصروف الرواتب وحساب ذمم الموظفين في الإعدادات';
  END IF;

  v_entry_number := COALESCE(public.get_next_document_number(v_run.branch_id, 'journal_entry'),
                             'JE-PAY-' || to_char(now(),'YYYYMMDDHH24MISS'));
  INSERT INTO public.journal_entries (entry_number, entry_date, description, reference, branch_id, created_by, is_posted)
  VALUES (v_entry_number, v_run.period_end,
    'قيد رواتب '||v_run.month||'/'||v_run.year, v_run.run_number, v_run.branch_id, auth.uid(), true)
  RETURNING id INTO v_entry_id;

  -- Aggregate salary expense (single Dr line — matches total_gross + employer_gosi)
  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
  VALUES (v_entry_id, v_salary_expense, v_run.total_gross, 0, 'إجمالي مصروف رواتب '||v_run.month||'/'||v_run.year);

  -- Per-employee: Cr Salary Payable (net), Cr Loans (deduction), and process loan installments
  FOR v_ps IN
    SELECT ps.*, e.full_name AS emp_name FROM public.hr_payslips ps
    JOIN public.hr_employees e ON e.id = ps.employee_id
    WHERE ps.payroll_run_id = _run_id
  LOOP
    IF v_ps.net_salary > 0 THEN
      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
      VALUES (v_entry_id, v_salary_payable, 0, v_ps.net_salary, 'صافي راتب — '||v_ps.emp_name);
    END IF;

    IF v_ps.loan_deduction > 0 THEN
      -- Split by loan_type for correct account
      FOR v_loan IN
        SELECT * FROM public.hr_loans
        WHERE employee_id = v_ps.employee_id AND status='active'::loan_status AND remaining_amount > 0
        ORDER BY loan_type, created_at
      LOOP
        DECLARE _ded numeric := LEAST(v_loan.installment_amount, v_loan.remaining_amount);
                _acct uuid := CASE WHEN v_loan.loan_type='advance' THEN v_advances_account ELSE v_loans_account END;
        BEGIN
          IF _ded <= 0 OR _acct IS NULL THEN CONTINUE; END IF;

          INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
          VALUES (v_entry_id, _acct, 0, _ded,
            CASE WHEN v_loan.loan_type='advance' THEN 'خصم سلفة ' ELSE 'خصم قسط قرض ' END || v_loan.loan_number || ' — ' || v_ps.emp_name);

          UPDATE public.hr_loans SET
            paid_amount = paid_amount + _ded,
            remaining_amount = GREATEST(v_loan.remaining_amount - _ded, 0),
            status = CASE WHEN v_loan.remaining_amount - _ded <= 0.01 THEN 'completed'::loan_status ELSE status END
          WHERE id = v_loan.id;

          -- Mark next pending installment paid
          UPDATE public.hr_loan_installments SET
            paid_amount = _ded, status='paid', paid_at=now(), payslip_id=v_ps.id
          WHERE id = (SELECT id FROM public.hr_loan_installments
                      WHERE loan_id=v_loan.id AND status='pending' ORDER BY installment_no LIMIT 1);
        END;
      END LOOP;
    END IF;

    -- Per-employee GOSI (employee side, Cr)
    IF v_ps.gosi_employee > 0 AND v_gosi_payable IS NOT NULL THEN
      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
      VALUES (v_entry_id, v_gosi_payable, 0, v_ps.gosi_employee, 'تأمينات حصة الموظف — '||v_ps.emp_name);
    END IF;

    v_total_employer_gosi := v_total_employer_gosi + COALESCE(v_ps.gosi_employer, 0);
  END LOOP;

  -- Employer GOSI: Dr expense + Cr payable (aggregated)
  IF v_total_employer_gosi > 0 THEN
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description) VALUES
      (v_entry_id, v_salary_expense, v_total_employer_gosi, 0, 'حصة المنشأة من التأمينات'),
      (v_entry_id, v_gosi_payable, 0, v_total_employer_gosi, 'تأمينات حصة المنشأة');
  END IF;

  UPDATE public.hr_payroll_runs SET
    status='posted', journal_entry_id=v_entry_id, posted_at=now(), posted_by=auth.uid()
  WHERE id = _run_id;

  RETURN v_entry_id;
END $$;

-- 6) employee_statement: consolidated statement for one employee over a period
CREATE OR REPLACE FUNCTION public.employee_statement(
  _employee_id uuid, _from date, _to date
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp record; v_payslips jsonb; v_loans jsonb; v_loan_payments jsonb; v_leaves jsonb;
  v_total_earnings numeric; v_total_deductions numeric; v_total_net numeric;
  v_total_loans_disbursed numeric; v_total_loans_paid numeric; v_total_loans_remaining numeric;
BEGIN
  SELECT id, employee_number, full_name, basic_salary, hire_date, branch_id
    INTO v_emp FROM public.hr_employees WHERE id=_employee_id;
  IF v_emp IS NULL THEN RAISE EXCEPTION 'الموظف غير موجود'; END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)),'[]'::jsonb),
         COALESCE(SUM(t.gross_salary),0), COALESCE(SUM(t.total_deductions+t.gosi_employee+t.loan_deduction),0),
         COALESCE(SUM(t.net_salary),0)
    INTO v_payslips, v_total_earnings, v_total_deductions, v_total_net
    FROM (SELECT ps.*, pr.run_number, pr.month, pr.year FROM public.hr_payslips ps
          JOIN public.hr_payroll_runs pr ON pr.id=ps.payroll_run_id
          WHERE ps.employee_id=_employee_id AND pr.period_end BETWEEN _from AND _to
          ORDER BY pr.year, pr.month) t;

  SELECT COALESCE(jsonb_agg(row_to_json(l)),'[]'::jsonb),
         COALESCE(SUM(l.total_amount),0), COALESCE(SUM(l.paid_amount),0), COALESCE(SUM(l.remaining_amount),0)
    INTO v_loans, v_total_loans_disbursed, v_total_loans_paid, v_total_loans_remaining
    FROM public.hr_loans l WHERE l.employee_id=_employee_id AND l.start_date <= _to;

  SELECT COALESCE(jsonb_agg(row_to_json(p)),'[]'::jsonb) INTO v_loan_payments
    FROM (SELECT lp.*, l.loan_number FROM public.hr_loan_payments lp
          JOIN public.hr_loans l ON l.id=lp.loan_id
          WHERE l.employee_id=_employee_id AND lp.payment_date BETWEEN _from AND _to
          ORDER BY lp.payment_date) p;

  SELECT COALESCE(jsonb_agg(row_to_json(lr)),'[]'::jsonb) INTO v_leaves
    FROM (SELECT lr.*, lt.name AS leave_type_name FROM public.hr_leave_requests lr
          JOIN public.hr_leave_types lt ON lt.id=lr.leave_type_id
          WHERE lr.employee_id=_employee_id AND lr.start_date BETWEEN _from AND _to
          ORDER BY lr.start_date) lr;

  RETURN jsonb_build_object(
    'employee', row_to_json(v_emp),
    'period', jsonb_build_object('from',_from,'to',_to),
    'summary', jsonb_build_object(
      'total_earnings', v_total_earnings,
      'total_deductions', v_total_deductions,
      'total_net', v_total_net,
      'loans_disbursed', v_total_loans_disbursed,
      'loans_paid', v_total_loans_paid,
      'loans_remaining', v_total_loans_remaining
    ),
    'payslips', v_payslips,
    'loans', v_loans,
    'loan_payments', v_loan_payments,
    'leaves', v_leaves
  );
END $$;

-- 7) Ensure setting keys exist
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES
  ('default_salary_advances_account_id', NULL, 'حساب ذمم سلف الموظفين (قصيرة الأجل)'),
  ('default_employee_loans_account_id', NULL, 'حساب ذمم قروض الموظفين (طويلة الأجل)')
ON CONFLICT (setting_key) DO NOTHING;
