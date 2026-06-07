
-- DEPARTMENTS
CREATE TABLE public.hr_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT,
  parent_id UUID REFERENCES public.hr_departments(id),
  branch_id UUID REFERENCES public.branches(id),
  manager_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_departments TO authenticated;
GRANT ALL ON public.hr_departments TO service_role;
ALTER TABLE public.hr_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR depts viewable by branch" ON public.hr_departments FOR SELECT TO authenticated
  USING (branch_id IS NULL OR public.has_branch_access(auth.uid(), branch_id));
CREATE POLICY "HR depts manageable" ON public.hr_departments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'));

-- JOB TITLES
CREATE TABLE public.hr_job_titles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT,
  department_id UUID REFERENCES public.hr_departments(id),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_job_titles TO authenticated;
GRANT ALL ON public.hr_job_titles TO service_role;
ALTER TABLE public.hr_job_titles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR jobs readable" ON public.hr_job_titles FOR SELECT TO authenticated USING (true);
CREATE POLICY "HR jobs manageable" ON public.hr_job_titles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'));

-- EMPLOYEES
CREATE TYPE public.employee_contract_type AS ENUM ('permanent','temporary','part_time','contractor');
CREATE TYPE public.employee_gender AS ENUM ('male','female');

CREATE TABLE public.hr_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  full_name_en TEXT,
  national_id TEXT,
  nationality TEXT DEFAULT 'SA',
  gender public.employee_gender,
  date_of_birth DATE,
  phone TEXT,
  email TEXT,
  address TEXT,
  hire_date DATE NOT NULL,
  end_date DATE,
  contract_type public.employee_contract_type NOT NULL DEFAULT 'permanent',
  contract_end_date DATE,
  branch_id UUID REFERENCES public.branches(id),
  department_id UUID REFERENCES public.hr_departments(id),
  job_title_id UUID REFERENCES public.hr_job_titles(id),
  manager_id UUID REFERENCES public.hr_employees(id),
  basic_salary NUMERIC(15,2) NOT NULL DEFAULT 0,
  bank_name TEXT,
  bank_iban TEXT,
  gosi_number TEXT,
  is_subject_to_gosi BOOLEAN NOT NULL DEFAULT true,
  user_id UUID,
  external_id TEXT UNIQUE,
  external_source TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
CREATE INDEX idx_hr_employees_branch ON public.hr_employees(branch_id);
CREATE INDEX idx_hr_employees_dept ON public.hr_employees(department_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_employees TO authenticated;
GRANT ALL ON public.hr_employees TO service_role;
ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees viewable" ON public.hr_employees FOR SELECT TO authenticated
  USING (branch_id IS NULL OR public.has_branch_access(auth.uid(), branch_id));
CREATE POLICY "Employees manageable" ON public.hr_employees FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'));

-- EMPLOYEE DOCUMENTS
CREATE TABLE public.hr_employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  doc_number TEXT,
  file_url TEXT,
  issue_date DATE,
  expiry_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_employee_documents TO authenticated;
GRANT ALL ON public.hr_employee_documents TO service_role;
ALTER TABLE public.hr_employee_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "EmpDocs HR" ON public.hr_employee_documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'));

-- LEAVE TYPES
CREATE TABLE public.hr_leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  default_days_per_year NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_paid BOOLEAN NOT NULL DEFAULT true,
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_leave_types TO authenticated;
GRANT ALL ON public.hr_leave_types TO service_role;
ALTER TABLE public.hr_leave_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "LeaveTypes read" ON public.hr_leave_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "LeaveTypes manage" ON public.hr_leave_types FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'));

-- LEAVE BALANCES
CREATE TABLE public.hr_leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES public.hr_leave_types(id),
  year INTEGER NOT NULL,
  entitled_days NUMERIC(5,2) NOT NULL DEFAULT 0,
  used_days NUMERIC(5,2) NOT NULL DEFAULT 0,
  carried_over_days NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, leave_type_id, year)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_leave_balances TO authenticated;
GRANT ALL ON public.hr_leave_balances TO service_role;
ALTER TABLE public.hr_leave_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "LeaveBal HR" ON public.hr_leave_balances FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'));

-- LEAVE REQUESTS
CREATE TYPE public.leave_request_status AS ENUM ('draft','submitted','approved','rejected','cancelled');
CREATE TABLE public.hr_leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT NOT NULL UNIQUE,
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id),
  leave_type_id UUID NOT NULL REFERENCES public.hr_leave_types(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count NUMERIC(5,2) NOT NULL,
  reason TEXT,
  status public.leave_request_status NOT NULL DEFAULT 'draft',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_leave_requests TO authenticated;
GRANT ALL ON public.hr_leave_requests TO service_role;
ALTER TABLE public.hr_leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "LeaveReq HR" ON public.hr_leave_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'));

-- ATTENDANCE
CREATE TYPE public.attendance_status AS ENUM ('present','absent','late','leave','holiday','weekend');
CREATE TABLE public.hr_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  check_in TIME,
  check_out TIME,
  hours_worked NUMERIC(5,2) DEFAULT 0,
  status public.attendance_status NOT NULL DEFAULT 'present',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, attendance_date)
);
CREATE INDEX idx_hr_attendance_date ON public.hr_attendance(attendance_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_attendance TO authenticated;
GRANT ALL ON public.hr_attendance TO service_role;
ALTER TABLE public.hr_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Attendance HR" ON public.hr_attendance FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'));

-- SALARY COMPONENTS
CREATE TYPE public.salary_component_type AS ENUM ('earning','deduction');
CREATE TYPE public.salary_calc_method AS ENUM ('fixed','percent_of_basic');
CREATE TABLE public.hr_salary_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  component_type public.salary_component_type NOT NULL,
  calc_method public.salary_calc_method NOT NULL DEFAULT 'fixed',
  default_value NUMERIC(15,4) NOT NULL DEFAULT 0,
  account_id UUID REFERENCES public.accounts(id),
  is_taxable BOOLEAN NOT NULL DEFAULT false,
  is_gosi_subject BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_salary_components TO authenticated;
GRANT ALL ON public.hr_salary_components TO service_role;
ALTER TABLE public.hr_salary_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SalComp read" ON public.hr_salary_components FOR SELECT TO authenticated USING (true);
CREATE POLICY "SalComp manage" ON public.hr_salary_components FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'));

-- EMPLOYEE SALARY STRUCTURE
CREATE TABLE public.hr_employee_salary_structure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES public.hr_salary_components(id),
  amount NUMERIC(15,4) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, component_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_employee_salary_structure TO authenticated;
GRANT ALL ON public.hr_employee_salary_structure TO service_role;
ALTER TABLE public.hr_employee_salary_structure ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SalStruct HR" ON public.hr_employee_salary_structure FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'));

-- LOANS
CREATE TYPE public.loan_status AS ENUM ('draft','active','completed','cancelled');
CREATE TABLE public.hr_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_number TEXT NOT NULL UNIQUE,
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id),
  total_amount NUMERIC(15,2) NOT NULL,
  installment_amount NUMERIC(15,2) NOT NULL,
  paid_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  remaining_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE,
  status public.loan_status NOT NULL DEFAULT 'draft',
  reason TEXT,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_loans TO authenticated;
GRANT ALL ON public.hr_loans TO service_role;
ALTER TABLE public.hr_loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Loans HR" ON public.hr_loans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'));

-- PAYROLL RUNS
CREATE TYPE public.payroll_status AS ENUM ('draft','calculated','posted','cancelled');
CREATE TABLE public.hr_payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_number TEXT NOT NULL UNIQUE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  branch_id UUID REFERENCES public.branches(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status public.payroll_status NOT NULL DEFAULT 'draft',
  total_gross NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_gosi NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_loans NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_net NUMERIC(15,2) NOT NULL DEFAULT 0,
  employees_count INTEGER NOT NULL DEFAULT 0,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  posted_at TIMESTAMPTZ,
  posted_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_payroll_runs TO authenticated;
GRANT ALL ON public.hr_payroll_runs TO service_role;
ALTER TABLE public.hr_payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "PayrollRuns view" ON public.hr_payroll_runs FOR SELECT TO authenticated
  USING (branch_id IS NULL OR public.has_branch_access(auth.uid(), branch_id));
CREATE POLICY "PayrollRuns manage" ON public.hr_payroll_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'));

-- PAYSLIPS
CREATE TABLE public.hr_payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID NOT NULL REFERENCES public.hr_payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id),
  basic_salary NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_earnings NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(15,2) NOT NULL DEFAULT 0,
  gosi_employee NUMERIC(15,2) NOT NULL DEFAULT 0,
  gosi_employer NUMERIC(15,2) NOT NULL DEFAULT 0,
  loan_deduction NUMERIC(15,2) NOT NULL DEFAULT 0,
  gross_salary NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_salary NUMERIC(15,2) NOT NULL DEFAULT 0,
  working_days INTEGER NOT NULL DEFAULT 30,
  absent_days INTEGER NOT NULL DEFAULT 0,
  leave_days INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payroll_run_id, employee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_payslips TO authenticated;
GRANT ALL ON public.hr_payslips TO service_role;
ALTER TABLE public.hr_payslips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Payslips HR" ON public.hr_payslips FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'));

CREATE TABLE public.hr_payslip_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payslip_id UUID NOT NULL REFERENCES public.hr_payslips(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES public.hr_salary_components(id),
  component_type public.salary_component_type NOT NULL,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_payslip_lines TO authenticated;
GRANT ALL ON public.hr_payslip_lines TO service_role;
ALTER TABLE public.hr_payslip_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "PayslipLines HR" ON public.hr_payslip_lines FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'));

-- END OF SERVICE
CREATE TABLE public.hr_end_of_service (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number TEXT NOT NULL UNIQUE,
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id),
  end_date DATE NOT NULL,
  end_reason TEXT,
  years_of_service NUMERIC(5,2) NOT NULL DEFAULT 0,
  last_basic_salary NUMERIC(15,2) NOT NULL DEFAULT 0,
  eosb_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  vacation_balance_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  other_dues NUMERIC(15,2) NOT NULL DEFAULT 0,
  deductions NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  status public.payroll_status NOT NULL DEFAULT 'draft',
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  posted_at TIMESTAMPTZ,
  posted_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_end_of_service TO authenticated;
GRANT ALL ON public.hr_end_of_service TO service_role;
ALTER TABLE public.hr_end_of_service ENABLE ROW LEVEL SECURITY;
CREATE POLICY "EOS HR" ON public.hr_end_of_service FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'));

-- SYSTEM SETTINGS
INSERT INTO public.system_settings (setting_key, setting_value, description) VALUES
  ('default_salary_expense_account_id', NULL, 'حساب مصروف الرواتب الافتراضي'),
  ('default_salary_payable_account_id', NULL, 'حساب ذمم الموظفين الدائنة'),
  ('default_gosi_payable_account_id', NULL, 'حساب التأمينات الاجتماعية المستحقة'),
  ('default_employee_loans_account_id', NULL, 'حساب سلف الموظفين'),
  ('default_eosb_provision_account_id', NULL, 'حساب مخصص نهاية الخدمة'),
  ('gosi_employee_rate', '0.0975', 'نسبة اشتراك الموظف في التأمينات (9.75%)'),
  ('gosi_employer_rate', '0.1175', 'نسبة اشتراك المنشأة في التأمينات (11.75%)')
ON CONFLICT (setting_key) DO NOTHING;

-- TRIGGERS
CREATE TRIGGER trg_hr_departments_updated BEFORE UPDATE ON public.hr_departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_hr_job_titles_updated BEFORE UPDATE ON public.hr_job_titles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_hr_employees_updated BEFORE UPDATE ON public.hr_employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_hr_employee_docs_updated BEFORE UPDATE ON public.hr_employee_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_hr_leave_types_updated BEFORE UPDATE ON public.hr_leave_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_hr_leave_balances_updated BEFORE UPDATE ON public.hr_leave_balances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_hr_leave_requests_updated BEFORE UPDATE ON public.hr_leave_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_hr_attendance_updated BEFORE UPDATE ON public.hr_attendance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_hr_salary_components_updated BEFORE UPDATE ON public.hr_salary_components FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_hr_emp_salary_struct_updated BEFORE UPDATE ON public.hr_employee_salary_structure FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_hr_loans_updated BEFORE UPDATE ON public.hr_loans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_hr_payroll_runs_updated BEFORE UPDATE ON public.hr_payroll_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_hr_payslips_updated BEFORE UPDATE ON public.hr_payslips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_hr_eos_updated BEFORE UPDATE ON public.hr_end_of_service FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PROTECTION
CREATE OR REPLACE FUNCTION public.prevent_modify_posted_payroll()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'posted' THEN RAISE EXCEPTION 'لا يمكن حذف رواتب مرحّلة'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'posted' AND NEW.status <> 'cancelled' THEN
    IF NEW.total_net <> OLD.total_net OR NEW.period_start <> OLD.period_start THEN
      RAISE EXCEPTION 'لا يمكن تعديل رواتب مرحّلة';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_prevent_modify_posted_payroll
  BEFORE UPDATE OR DELETE ON public.hr_payroll_runs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_modify_posted_payroll();

-- FUNCTION: EOSB calc
CREATE OR REPLACE FUNCTION public.calculate_eosb(_employee_id UUID, _end_date DATE)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _emp RECORD; _years NUMERIC; _eosb NUMERIC := 0;
BEGIN
  SELECT * INTO _emp FROM public.hr_employees WHERE id = _employee_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'الموظف غير موجود'; END IF;
  _years := EXTRACT(YEAR FROM AGE(_end_date, _emp.hire_date)) +
            EXTRACT(MONTH FROM AGE(_end_date, _emp.hire_date))/12.0 +
            EXTRACT(DAY FROM AGE(_end_date, _emp.hire_date))/365.0;
  IF _years <= 5 THEN
    _eosb := (_emp.basic_salary / 2) * _years;
  ELSE
    _eosb := (_emp.basic_salary / 2) * 5 + _emp.basic_salary * (_years - 5);
  END IF;
  RETURN ROUND(_eosb, 2);
END; $$;

-- FUNCTION: calculate payroll
CREATE OR REPLACE FUNCTION public.calculate_payroll(_run_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run RECORD; v_emp RECORD; v_struct RECORD; v_payslip_id UUID;
  v_total_earnings NUMERIC; v_total_deductions NUMERIC; v_basic NUMERIC;
  v_gross NUMERIC; v_gosi_emp NUMERIC; v_gosi_employer NUMERIC;
  v_loan_total NUMERIC; v_net NUMERIC;
  v_absent_days INTEGER; v_leave_days INTEGER; v_count INTEGER := 0;
  v_run_total_gross NUMERIC := 0; v_run_total_deductions NUMERIC := 0;
  v_run_total_gosi NUMERIC := 0; v_run_total_loans NUMERIC := 0; v_run_total_net NUMERIC := 0;
  v_gosi_emp_rate NUMERIC; v_gosi_employer_rate NUMERIC; v_amt NUMERIC;
BEGIN
  SELECT * INTO v_run FROM public.hr_payroll_runs WHERE id = _run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'تشغيل الرواتب غير موجود'; END IF;
  IF v_run.status NOT IN ('draft','calculated') THEN RAISE EXCEPTION 'لا يمكن إعادة حساب رواتب مرحّلة'; END IF;
  
  SELECT COALESCE(setting_value::numeric, 0.0975) INTO v_gosi_emp_rate
    FROM public.system_settings WHERE setting_key = 'gosi_employee_rate';
  SELECT COALESCE(setting_value::numeric, 0.1175) INTO v_gosi_employer_rate
    FROM public.system_settings WHERE setting_key = 'gosi_employer_rate';
  
  DELETE FROM public.hr_payslips WHERE payroll_run_id = _run_id;
  
  FOR v_emp IN
    SELECT * FROM public.hr_employees
    WHERE is_active = true
      AND (v_run.branch_id IS NULL OR branch_id = v_run.branch_id)
      AND hire_date <= v_run.period_end
      AND (end_date IS NULL OR end_date >= v_run.period_start)
  LOOP
    v_basic := COALESCE(v_emp.basic_salary, 0);
    v_total_earnings := 0;
    v_total_deductions := 0;
    
    SELECT 
      COUNT(*) FILTER (WHERE status = 'absent'),
      COUNT(*) FILTER (WHERE status = 'leave')
    INTO v_absent_days, v_leave_days
    FROM public.hr_attendance
    WHERE employee_id = v_emp.id
      AND attendance_date BETWEEN v_run.period_start AND v_run.period_end;
    
    INSERT INTO public.hr_payslips (payroll_run_id, employee_id, basic_salary, working_days, absent_days, leave_days)
    VALUES (_run_id, v_emp.id, v_basic, 30, COALESCE(v_absent_days,0), COALESCE(v_leave_days,0))
    RETURNING id INTO v_payslip_id;
    
    FOR v_struct IN
      SELECT s.*, c.component_type, c.calc_method
      FROM public.hr_employee_salary_structure s
      JOIN public.hr_salary_components c ON c.id = s.component_id
      WHERE s.employee_id = v_emp.id AND s.is_active = true AND c.is_active = true
    LOOP
      IF v_struct.calc_method = 'percent_of_basic' THEN
        v_amt := ROUND(v_basic * v_struct.amount / 100, 2);
      ELSE
        v_amt := v_struct.amount;
      END IF;
      INSERT INTO public.hr_payslip_lines (payslip_id, component_id, component_type, amount)
      VALUES (v_payslip_id, v_struct.component_id, v_struct.component_type, v_amt);
      IF v_struct.component_type = 'earning' THEN
        v_total_earnings := v_total_earnings + v_amt;
      ELSE
        v_total_deductions := v_total_deductions + v_amt;
      END IF;
    END LOOP;
    
    v_gross := v_basic + v_total_earnings;
    
    IF v_emp.is_subject_to_gosi AND v_emp.nationality = 'SA' THEN
      v_gosi_emp := ROUND(v_basic * v_gosi_emp_rate, 2);
      v_gosi_employer := ROUND(v_basic * v_gosi_employer_rate, 2);
    ELSE
      v_gosi_emp := 0; v_gosi_employer := 0;
    END IF;
    
    SELECT COALESCE(SUM(installment_amount), 0) INTO v_loan_total
    FROM public.hr_loans
    WHERE employee_id = v_emp.id AND status = 'active' AND remaining_amount > 0;
    
    v_net := v_gross - v_total_deductions - v_gosi_emp - v_loan_total;
    
    UPDATE public.hr_payslips SET
      total_earnings = v_total_earnings,
      total_deductions = v_total_deductions,
      gosi_employee = v_gosi_emp,
      gosi_employer = v_gosi_employer,
      loan_deduction = v_loan_total,
      gross_salary = v_gross,
      net_salary = v_net
    WHERE id = v_payslip_id;
    
    v_run_total_gross := v_run_total_gross + v_gross;
    v_run_total_deductions := v_run_total_deductions + v_total_deductions;
    v_run_total_gosi := v_run_total_gosi + v_gosi_emp + v_gosi_employer;
    v_run_total_loans := v_run_total_loans + v_loan_total;
    v_run_total_net := v_run_total_net + v_net;
    v_count := v_count + 1;
  END LOOP;
  
  UPDATE public.hr_payroll_runs SET
    status = 'calculated', total_gross = v_run_total_gross,
    total_deductions = v_run_total_deductions, total_gosi = v_run_total_gosi,
    total_loans = v_run_total_loans, total_net = v_run_total_net,
    employees_count = v_count
  WHERE id = _run_id;
  
  RETURN v_count;
END; $$;

-- FUNCTION: post payroll
CREATE OR REPLACE FUNCTION public.post_payroll_run(_run_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run RECORD; v_entry_id UUID; v_entry_number TEXT;
  v_salary_expense UUID; v_salary_payable UUID; v_gosi_payable UUID; v_loans_account UUID;
  v_loan RECORD; v_employer_gosi NUMERIC; v_employee_gosi NUMERIC;
BEGIN
  SELECT * INTO v_run FROM public.hr_payroll_runs WHERE id = _run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'تشغيل الرواتب غير موجود'; END IF;
  IF v_run.status <> 'calculated' THEN RAISE EXCEPTION 'يجب حساب الرواتب أولاً'; END IF;
  
  SELECT setting_value::uuid INTO v_salary_expense FROM public.system_settings WHERE setting_key = 'default_salary_expense_account_id';
  SELECT setting_value::uuid INTO v_salary_payable FROM public.system_settings WHERE setting_key = 'default_salary_payable_account_id';
  SELECT setting_value::uuid INTO v_gosi_payable FROM public.system_settings WHERE setting_key = 'default_gosi_payable_account_id';
  SELECT setting_value::uuid INTO v_loans_account FROM public.system_settings WHERE setting_key = 'default_employee_loans_account_id';
  
  IF v_salary_expense IS NULL OR v_salary_payable IS NULL THEN
    RAISE EXCEPTION 'يجب تحديد حساب مصروف الرواتب وحساب ذمم الموظفين في الإعدادات';
  END IF;
  
  v_entry_number := COALESCE(
    public.get_next_document_number(v_run.branch_id, 'journal_entry'),
    'JE-PAY-' || to_char(now(),'YYYYMMDDHH24MISS')
  );
  
  INSERT INTO public.journal_entries (entry_number, entry_date, description, reference, branch_id, created_by, is_posted)
  VALUES (v_entry_number, v_run.period_end,
    'قيد رواتب شهر ' || v_run.month || '/' || v_run.year,
    v_run.run_number, v_run.branch_id, auth.uid(), true)
  RETURNING id INTO v_entry_id;
  
  SELECT COALESCE(SUM(gosi_employer), 0), COALESCE(SUM(gosi_employee), 0)
    INTO v_employer_gosi, v_employee_gosi
    FROM public.hr_payslips WHERE payroll_run_id = _run_id;
  
  -- DR: salary expense (gross)
  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
  VALUES (v_entry_id, v_salary_expense, v_run.total_gross, 0, 'مصروف رواتب');
  
  -- DR: employer GOSI expense
  IF v_employer_gosi > 0 THEN
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
    VALUES (v_entry_id, v_salary_expense, v_employer_gosi, 0, 'حصة المنشأة من التأمينات');
  END IF;
  
  -- CR: GOSI payable (employee + employer)
  IF (v_employer_gosi + v_employee_gosi) > 0 AND v_gosi_payable IS NOT NULL THEN
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
    VALUES (v_entry_id, v_gosi_payable, 0, v_employer_gosi + v_employee_gosi, 'التأمينات الاجتماعية المستحقة');
  END IF;
  
  -- CR: Loans recovered
  IF v_run.total_loans > 0 AND v_loans_account IS NOT NULL THEN
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
    VALUES (v_entry_id, v_loans_account, 0, v_run.total_loans, 'استرداد سلف موظفين');
    
    FOR v_loan IN
      SELECT l.id, l.installment_amount, l.remaining_amount FROM public.hr_loans l
      JOIN public.hr_payslips ps ON ps.employee_id = l.employee_id AND ps.payroll_run_id = _run_id
      WHERE l.status = 'active' AND l.remaining_amount > 0 AND ps.loan_deduction > 0
    LOOP
      UPDATE public.hr_loans SET
        paid_amount = paid_amount + LEAST(v_loan.installment_amount, v_loan.remaining_amount),
        remaining_amount = GREATEST(v_loan.remaining_amount - v_loan.installment_amount, 0),
        status = CASE WHEN v_loan.remaining_amount - v_loan.installment_amount <= 0 THEN 'completed'::loan_status ELSE status END
      WHERE id = v_loan.id;
    END LOOP;
  END IF;
  
  -- CR: Net salary payable
  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
  VALUES (v_entry_id, v_salary_payable, 0, v_run.total_net, 'ذمم الموظفين الدائنة');
  
  UPDATE public.hr_payroll_runs SET
    status = 'posted', journal_entry_id = v_entry_id,
    posted_at = now(), posted_by = auth.uid()
  WHERE id = _run_id;
  
  RETURN v_entry_id;
END; $$;

-- SEED leave types
INSERT INTO public.hr_leave_types (name, code, default_days_per_year, is_paid, requires_approval) VALUES
  ('إجازة سنوية', 'ANNUAL', 21, true, true),
  ('إجازة مرضية', 'SICK', 30, true, true),
  ('إجازة أمومة', 'MATERNITY', 70, true, true),
  ('إجازة بدون راتب', 'UNPAID', 0, false, true),
  ('إجازة طارئة', 'EMERGENCY', 5, true, true)
ON CONFLICT (code) DO NOTHING;

-- SEED salary components
INSERT INTO public.hr_salary_components (code, name, component_type, calc_method, default_value, is_gosi_subject, sort_order) VALUES
  ('HOUSING', 'بدل سكن', 'earning', 'percent_of_basic', 25, true, 10),
  ('TRANSPORT', 'بدل نقل', 'earning', 'percent_of_basic', 10, false, 20),
  ('PHONE', 'بدل اتصالات', 'earning', 'fixed', 200, false, 30),
  ('OVERTIME', 'بدل إضافي', 'earning', 'fixed', 0, false, 40),
  ('PENALTY', 'خصم جزاءات', 'deduction', 'fixed', 0, false, 100),
  ('ABSENCE', 'خصم غياب', 'deduction', 'fixed', 0, false, 110)
ON CONFLICT (code) DO NOTHING;
