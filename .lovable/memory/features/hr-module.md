---
name: HR Module
description: Complete HR module — employees, attendance, leaves, salary structure, payroll runs with auto journal entries, end-of-service per Saudi labor law
type: feature
---
# Human Resources Module

## Tables (15)
- `hr_departments`, `hr_job_titles` — org structure
- `hr_employees` (+ `hr_employee_documents`) — full employee record, includes `external_id`/`external_source` for SIS/academic system integration
- `hr_leave_types`, `hr_leave_balances`, `hr_leave_requests` — leaves workflow (draft/submitted/approved/rejected)
- `hr_attendance` — daily check-in/out per employee
- `hr_salary_components` (+ `hr_employee_salary_structure`) — earnings/deductions, fixed or % of basic, linked to GL accounts
- `hr_loans` — installment-based with auto-deduction on payroll
- `hr_payroll_runs` (+ `hr_payslips`, `hr_payslip_lines`) — monthly run per branch
- `hr_end_of_service` — EOSB calculation

## Functions
- `calculate_payroll(_run_id)` — generates payslips: basic + earnings − deductions − GOSI − loans
- `post_payroll_run(_run_id)` — creates journal entry: DR Salary Expense + Employer GOSI / CR GOSI Payable, Loans, Salary Payable
- `calculate_eosb(_employee_id, _end_date)` — Saudi Labor Law Art. 84: 1/2 month for first 5 years + full month thereafter

## Settings keys
`default_salary_expense_account_id`, `default_salary_payable_account_id`, `default_gosi_payable_account_id`, `default_employee_loans_account_id`, `default_eosb_provision_account_id`, `gosi_employee_rate` (0.0975), `gosi_employer_rate` (0.1175)

## Roles
- New role `hr_manager` added to `app_role` enum
- Routes accessible to: `admin`, `branch_manager`, `hr_manager`

## Integration-ready
`hr_employees.external_id` (UNIQUE) + `external_source` are reserved for syncing teachers/staff from external SIS/academic systems via Edge Functions (future).

## Workflow
Setup accounts (Settings) → Departments → Job Titles → Salary Components → Employees → Salary Structure → Attendance/Leaves → Create Payroll Run → Calculate → Post (auto JE)
