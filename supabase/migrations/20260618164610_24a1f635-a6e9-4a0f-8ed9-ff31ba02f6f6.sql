-- ============== Add new role ==============
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'employee_self_service';

-- ============== Performance Reviews ==============
CREATE TABLE IF NOT EXISTS public.hr_performance_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_name TEXT NOT NULL,
  cycle_type TEXT NOT NULL DEFAULT 'annual',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_performance_cycles TO authenticated;
GRANT ALL ON public.hr_performance_cycles TO service_role;
ALTER TABLE public.hr_performance_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_perf_cycles_select" ON public.hr_performance_cycles FOR SELECT TO authenticated USING (true);
CREATE POLICY "hr_perf_cycles_mutate" ON public.hr_performance_cycles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr_manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr_manager'));

CREATE TABLE IF NOT EXISTS public.hr_performance_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  weight NUMERIC NOT NULL DEFAULT 1 CHECK (weight > 0),
  max_score INTEGER NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_performance_criteria TO authenticated;
GRANT ALL ON public.hr_performance_criteria TO service_role;
ALTER TABLE public.hr_performance_criteria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_perf_crit_select" ON public.hr_performance_criteria FOR SELECT TO authenticated USING (true);
CREATE POLICY "hr_perf_crit_mutate" ON public.hr_performance_criteria FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr_manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr_manager'));

CREATE TABLE IF NOT EXISTS public.hr_performance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES public.hr_performance_cycles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES public.hr_employees(id),
  review_date DATE NOT NULL DEFAULT CURRENT_DATE,
  overall_score NUMERIC,
  overall_rating TEXT,
  strengths TEXT,
  weaknesses TEXT,
  development_plan TEXT,
  comments TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cycle_id, employee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_performance_reviews TO authenticated;
GRANT ALL ON public.hr_performance_reviews TO service_role;
ALTER TABLE public.hr_performance_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_perf_rev_select" ON public.hr_performance_reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "hr_perf_rev_mutate" ON public.hr_performance_reviews FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr_manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr_manager'));

CREATE TABLE IF NOT EXISTS public.hr_review_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.hr_performance_reviews(id) ON DELETE CASCADE,
  criteria_id UUID NOT NULL REFERENCES public.hr_performance_criteria(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_review_ratings TO authenticated;
GRANT ALL ON public.hr_review_ratings TO service_role;
ALTER TABLE public.hr_review_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_rev_rat_select" ON public.hr_review_ratings FOR SELECT TO authenticated USING (true);
CREATE POLICY "hr_rev_rat_mutate" ON public.hr_review_ratings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr_manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr_manager'));

-- ============== Training ==============
CREATE TABLE IF NOT EXISTS public.hr_training_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  trainer_name TEXT,
  trainer_type TEXT DEFAULT 'internal',
  duration_hours NUMERIC,
  cost_per_attendee NUMERIC DEFAULT 0,
  max_attendees INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_training_programs TO authenticated;
GRANT ALL ON public.hr_training_programs TO service_role;
ALTER TABLE public.hr_training_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_train_prog_select" ON public.hr_training_programs FOR SELECT TO authenticated USING (true);
CREATE POLICY "hr_train_prog_mutate" ON public.hr_training_programs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr_manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr_manager'));

CREATE TABLE IF NOT EXISTS public.hr_training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.hr_training_programs(id) ON DELETE CASCADE,
  session_code TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  branch_id UUID REFERENCES public.branches(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_training_sessions TO authenticated;
GRANT ALL ON public.hr_training_sessions TO service_role;
ALTER TABLE public.hr_training_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_train_sess_select" ON public.hr_training_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "hr_train_sess_mutate" ON public.hr_training_sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr_manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr_manager'));

CREATE TABLE IF NOT EXISTS public.hr_training_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.hr_training_sessions(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  attendance_status TEXT NOT NULL DEFAULT 'enrolled',
  score NUMERIC,
  certificate_issued BOOLEAN NOT NULL DEFAULT false,
  certificate_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, employee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_training_attendees TO authenticated;
GRANT ALL ON public.hr_training_attendees TO service_role;
ALTER TABLE public.hr_training_attendees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_train_att_select" ON public.hr_training_attendees FOR SELECT TO authenticated USING (true);
CREATE POLICY "hr_train_att_mutate" ON public.hr_training_attendees FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr_manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr_manager'));

-- ============== Contracts ==============
CREATE TABLE IF NOT EXISTS public.hr_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number TEXT NOT NULL UNIQUE,
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  contract_type TEXT NOT NULL DEFAULT 'indefinite',
  start_date DATE NOT NULL,
  end_date DATE,
  basic_salary NUMERIC NOT NULL DEFAULT 0,
  housing_allowance NUMERIC DEFAULT 0,
  transportation_allowance NUMERIC DEFAULT 0,
  other_allowances NUMERIC DEFAULT 0,
  working_hours_per_week NUMERIC DEFAULT 48,
  annual_leave_days INTEGER DEFAULT 21,
  probation_months INTEGER DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'draft',
  terms TEXT,
  file_url TEXT,
  signed_date DATE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_contracts TO authenticated;
GRANT ALL ON public.hr_contracts TO service_role;
ALTER TABLE public.hr_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_contracts_select" ON public.hr_contracts FOR SELECT TO authenticated USING (true);
CREATE POLICY "hr_contracts_mutate" ON public.hr_contracts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr_manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr_manager'));

-- ============== Helper Functions ==============

CREATE OR REPLACE FUNCTION public.get_expiring_documents(_days_ahead INTEGER DEFAULT 90)
RETURNS TABLE(
  document_id UUID, employee_id UUID, employee_name TEXT, employee_number TEXT,
  branch_id UUID, doc_type TEXT, doc_number TEXT, expiry_date DATE,
  days_remaining INTEGER, severity TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.id, e.id, e.full_name, e.employee_number, e.branch_id,
    d.doc_type, d.doc_number, d.expiry_date,
    (d.expiry_date - CURRENT_DATE)::INTEGER,
    CASE 
      WHEN d.expiry_date < CURRENT_DATE THEN 'expired'
      WHEN d.expiry_date - CURRENT_DATE <= 30 THEN 'critical'
      WHEN d.expiry_date - CURRENT_DATE <= 60 THEN 'warning'
      ELSE 'info'
    END
  FROM public.hr_employee_documents d
  JOIN public.hr_employees e ON e.id = d.employee_id
  WHERE d.expiry_date IS NOT NULL
    AND d.expiry_date - CURRENT_DATE <= _days_ahead
    AND e.is_active = true
  ORDER BY d.expiry_date ASC;
$$;

CREATE OR REPLACE FUNCTION public.hr_dashboard_kpis(_branch_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total_emp INT; v_new_emp INT; v_dept INT;
  v_today_attendance INT; v_on_leave INT; v_pending_leaves INT;
  v_active_loans INT; v_total_loan_balance NUMERIC;
  v_current_payroll NUMERIC; v_last_payroll NUMERIC;
  v_expiring_docs INT; v_expiring_contracts INT;
BEGIN
  SELECT COUNT(*) INTO v_total_emp FROM public.hr_employees 
    WHERE is_active = true AND (_branch_id IS NULL OR branch_id = _branch_id);
  SELECT COUNT(*) INTO v_new_emp FROM public.hr_employees 
    WHERE is_active = true AND hire_date >= CURRENT_DATE - INTERVAL '30 days'
    AND (_branch_id IS NULL OR branch_id = _branch_id);
  SELECT COUNT(*) INTO v_dept FROM public.hr_departments WHERE is_active = true;
  SELECT COUNT(*) INTO v_today_attendance FROM public.hr_attendance a
    JOIN public.hr_employees e ON e.id = a.employee_id
    WHERE a.attendance_date = CURRENT_DATE AND a.status = 'present'
    AND (_branch_id IS NULL OR e.branch_id = _branch_id);
  SELECT COUNT(*) INTO v_on_leave FROM public.hr_leave_requests lr
    JOIN public.hr_employees e ON e.id = lr.employee_id
    WHERE lr.status = 'approved' AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date
    AND (_branch_id IS NULL OR e.branch_id = _branch_id);
  SELECT COUNT(*) INTO v_pending_leaves FROM public.hr_leave_requests lr
    JOIN public.hr_employees e ON e.id = lr.employee_id
    WHERE lr.status = 'submitted'
    AND (_branch_id IS NULL OR e.branch_id = _branch_id);
  SELECT COUNT(*), COALESCE(SUM(remaining_amount), 0) INTO v_active_loans, v_total_loan_balance 
    FROM public.hr_loans l JOIN public.hr_employees e ON e.id = l.employee_id
    WHERE l.status = 'active' AND (_branch_id IS NULL OR e.branch_id = _branch_id);
  SELECT COALESCE(total_net, 0) INTO v_current_payroll FROM public.hr_payroll_runs
    WHERE year = EXTRACT(YEAR FROM CURRENT_DATE)::INT 
    AND month = EXTRACT(MONTH FROM CURRENT_DATE)::INT
    AND (_branch_id IS NULL OR branch_id = _branch_id)
    ORDER BY created_at DESC LIMIT 1;
  SELECT COALESCE(total_net, 0) INTO v_last_payroll FROM public.hr_payroll_runs
    WHERE (year * 100 + month) < (EXTRACT(YEAR FROM CURRENT_DATE)::INT * 100 + EXTRACT(MONTH FROM CURRENT_DATE)::INT)
    AND (_branch_id IS NULL OR branch_id = _branch_id)
    ORDER BY year DESC, month DESC LIMIT 1;
  SELECT COUNT(*) INTO v_expiring_docs FROM public.hr_employee_documents d
    JOIN public.hr_employees e ON e.id = d.employee_id
    WHERE d.expiry_date IS NOT NULL AND d.expiry_date - CURRENT_DATE <= 60
    AND e.is_active = true
    AND (_branch_id IS NULL OR e.branch_id = _branch_id);
  SELECT COUNT(*) INTO v_expiring_contracts FROM public.hr_contracts c
    JOIN public.hr_employees e ON e.id = c.employee_id
    WHERE c.status = 'active' AND c.end_date IS NOT NULL
    AND c.end_date - CURRENT_DATE <= 60
    AND (_branch_id IS NULL OR e.branch_id = _branch_id);
  
  RETURN jsonb_build_object(
    'total_employees', v_total_emp,
    'new_employees_30d', v_new_emp,
    'departments', v_dept,
    'present_today', v_today_attendance,
    'on_leave_today', v_on_leave,
    'pending_leaves', v_pending_leaves,
    'active_loans', v_active_loans,
    'total_loan_balance', v_total_loan_balance,
    'current_month_payroll', v_current_payroll,
    'last_month_payroll', v_last_payroll,
    'expiring_documents', v_expiring_docs,
    'expiring_contracts', v_expiring_contracts
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.next_contract_number()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_year TEXT := to_char(CURRENT_DATE, 'YYYY');
  v_seq INT;
BEGIN
  SELECT COALESCE(MAX(CAST(substring(contract_number FROM '\d+$') AS INT)), 0) + 1
    INTO v_seq FROM public.hr_contracts
    WHERE contract_number LIKE 'CON-' || v_year || '-%';
  RETURN 'CON-' || v_year || '-' || lpad(v_seq::TEXT, 4, '0');
END;
$$;

CREATE TRIGGER trg_hr_perf_cycles_upd BEFORE UPDATE ON public.hr_performance_cycles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_hr_perf_crit_upd BEFORE UPDATE ON public.hr_performance_criteria FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_hr_perf_rev_upd BEFORE UPDATE ON public.hr_performance_reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_hr_train_prog_upd BEFORE UPDATE ON public.hr_training_programs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_hr_train_sess_upd BEFORE UPDATE ON public.hr_training_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_hr_contracts_upd BEFORE UPDATE ON public.hr_contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.hr_performance_criteria (name, description, weight, max_score) VALUES
  ('جودة العمل', 'دقة وإتقان المهام الموكلة', 2, 5),
  ('الالتزام بالمواعيد', 'الحضور والانصراف وتسليم المهام في وقتها', 1.5, 5),
  ('روح الفريق', 'التعاون مع الزملاء والمشاركة الإيجابية', 1, 5),
  ('المبادرة والإبداع', 'تقديم أفكار جديدة وحلول مبتكرة', 1, 5),
  ('القدرة على التعلم', 'سرعة اكتساب المهارات الجديدة', 1, 5)
ON CONFLICT DO NOTHING;