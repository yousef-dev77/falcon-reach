
-- 1) Seed missing HR/payroll account settings so they appear in Settings > Finance
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, category, description) VALUES
  ('default_salary_expense_account_id', NULL, 'account', 'finance', 'حساب مصروف الرواتب الافتراضي'),
  ('default_salary_payable_account_id', NULL, 'account', 'finance', 'حساب ذمم الموظفين الدائنة (رواتب مستحقة)'),
  ('default_gosi_payable_account_id',   NULL, 'account', 'finance', 'حساب التأمينات الاجتماعية المستحقة (GOSI)'),
  ('default_employee_loans_account_id', NULL, 'account', 'finance', 'حساب سلف الموظفين'),
  ('gosi_employee_rate', '0.0975', 'number', 'finance', 'نسبة اشتراك الموظف في التأمينات'),
  ('gosi_employer_rate', '0.1175', 'number', 'finance', 'نسبة اشتراك صاحب العمل في التأمينات')
ON CONFLICT (setting_key) DO NOTHING;

-- 2) Allow employees to manage their OWN leave requests from the self-service portal
DROP POLICY IF EXISTS "Employees can view own leave requests" ON public.hr_leave_requests;
CREATE POLICY "Employees can view own leave requests" ON public.hr_leave_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.hr_employees e WHERE e.id = hr_leave_requests.employee_id AND e.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Employees can create own leave requests" ON public.hr_leave_requests;
CREATE POLICY "Employees can create own leave requests" ON public.hr_leave_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.hr_employees e WHERE e.id = hr_leave_requests.employee_id AND e.user_id = auth.uid())
    AND status IN ('draft','submitted')
  );

DROP POLICY IF EXISTS "Employees can cancel own draft leave requests" ON public.hr_leave_requests;
CREATE POLICY "Employees can cancel own draft leave requests" ON public.hr_leave_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.hr_employees e WHERE e.id = hr_leave_requests.employee_id AND e.user_id = auth.uid())
    AND status IN ('draft','submitted')
  )
  WITH CHECK (status IN ('cancelled','submitted','draft'));

-- 3) Allow employees to view their own self-service data
DROP POLICY IF EXISTS "Employees view own payslips" ON public.hr_payslips;
CREATE POLICY "Employees view own payslips" ON public.hr_payslips FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hr_employees e WHERE e.id = hr_payslips.employee_id AND e.user_id = auth.uid()));

DROP POLICY IF EXISTS "Employees view own attendance" ON public.hr_attendance;
CREATE POLICY "Employees view own attendance" ON public.hr_attendance FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hr_employees e WHERE e.id = hr_attendance.employee_id AND e.user_id = auth.uid()));

DROP POLICY IF EXISTS "Employees view own leave balances" ON public.hr_leave_balances;
CREATE POLICY "Employees view own leave balances" ON public.hr_leave_balances FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hr_employees e WHERE e.id = hr_leave_balances.employee_id AND e.user_id = auth.uid()));

DROP POLICY IF EXISTS "Employees view own documents" ON public.hr_employee_documents;
CREATE POLICY "Employees view own documents" ON public.hr_employee_documents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hr_employees e WHERE e.id = hr_employee_documents.employee_id AND e.user_id = auth.uid()));

DROP POLICY IF EXISTS "Employees view own loans" ON public.hr_loans;
CREATE POLICY "Employees view own loans" ON public.hr_loans FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hr_employees e WHERE e.id = hr_loans.employee_id AND e.user_id = auth.uid()));

DROP POLICY IF EXISTS "Employees view own record" ON public.hr_employees;
CREATE POLICY "Employees view own record" ON public.hr_employees FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 4) Safe branch deletion: if branch is referenced anywhere, raise a clear Arabic message instead of FK error
CREATE OR REPLACE FUNCTION public.prevent_delete_branch_in_use()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n INT;
BEGIN
  SELECT COUNT(*) INTO _n FROM public.journal_entries WHERE branch_id = OLD.id;
  IF _n > 0 THEN RAISE EXCEPTION 'لا يمكن حذف الفرع: مرتبط بـ % قيد محاسبي. عطّله بدلاً من حذفه.', _n; END IF;
  SELECT COUNT(*) INTO _n FROM public.user_branch_assignments WHERE branch_id = OLD.id;
  IF _n > 0 THEN RAISE EXCEPTION 'لا يمكن حذف الفرع: مرتبط بـ % مستخدم. أزل المستخدمين أولاً.', _n; END IF;
  SELECT COUNT(*) INTO _n FROM public.sales_invoices WHERE branch_id = OLD.id;
  IF _n > 0 THEN RAISE EXCEPTION 'لا يمكن حذف الفرع: يحتوي على فواتير مبيعات.'; END IF;
  SELECT COUNT(*) INTO _n FROM public.purchase_invoices WHERE branch_id = OLD.id;
  IF _n > 0 THEN RAISE EXCEPTION 'لا يمكن حذف الفرع: يحتوي على فواتير مشتريات.'; END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS trg_prevent_delete_branch_in_use ON public.branches;
CREATE TRIGGER trg_prevent_delete_branch_in_use BEFORE DELETE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_branch_in_use();
