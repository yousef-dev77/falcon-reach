# خطة بناء وحدة الموارد البشرية (HR)

## الهدف
وحدة HR متكاملة بمعايير نظام العمل السعودي، مرتبطة بالنظام المحاسبي بقيود تلقائية، ومتعددة الفروع، وجاهزة للربط لاحقاً مع نظام أكاديمي (للمعلمين).

---

## المرحلة 1: قاعدة البيانات (Migration واحدة شاملة)

### الجداول الجديدة

| الجدول | الغرض | حقول رئيسية |
|---|---|---|
| `hr_departments` | الأقسام | name, code, parent_id, branch_id, manager_id |
| `hr_job_titles` | المسميات الوظيفية | name, code, department_id |
| `hr_employees` | بيانات الموظفين | employee_number, full_name, national_id, nationality, gender, dob, hire_date, contract_type (permanent/temporary/part_time), contract_end_date, branch_id, department_id, job_title_id, basic_salary, bank_account_iban, gosi_number, **external_id** (للربط الخارجي), is_active |
| `hr_employee_documents` | مستندات (هوية، عقد، شهادات) | employee_id, doc_type, file_url, expiry_date |
| `hr_leave_types` | أنواع الإجازات | name (سنوية/مرضية/أمومة/بدون راتب), default_days, is_paid |
| `hr_leave_balances` | أرصدة الإجازات | employee_id, leave_type_id, year, entitled_days, used_days |
| `hr_leave_requests` | طلبات الإجازات | employee_id, leave_type_id, start_date, end_date, days, status (draft/approved/rejected), approved_by |
| `hr_attendance` | الحضور اليومي | employee_id, date, check_in, check_out, hours_worked, status (present/absent/late/leave) |
| `hr_salary_components` | مكونات الراتب | code, name, type (earning/deduction), calc_method (fixed/percent_of_basic), default_value, account_id (للحساب المحاسبي) |
| `hr_employee_salary_structure` | هيكل راتب الموظف | employee_id, component_id, amount/percent |
| `hr_loans` | السلف | employee_id, total_amount, installment_amount, start_date, remaining_amount, status |
| `hr_payroll_runs` | تشغيل الرواتب الشهري | run_number, year, month, branch_id, status (draft/calculated/posted), journal_entry_id, total_gross, total_net |
| `hr_payslips` | كشوف رواتب الموظفين | run_id, employee_id, basic, allowances, deductions, gosi, loans, net_salary, working_days, absent_days |
| `hr_payslip_lines` | تفاصيل بنود الكشف | payslip_id, component_id, amount |
| `hr_end_of_service` | نهاية الخدمة (EOSB) | employee_id, end_date, years_of_service, eosb_amount, journal_entry_id |

### دوال SQL (Functions)
- `calculate_payroll(_run_id)`: يحسب لكل موظف الراتب الأساسي + البدلات − الخصومات − GOSI (9%) − السلف
- `post_payroll_run(_run_id)`: 
  - يولد قيد محاسبي تلقائي:
    - **مدين**: مصاريف رواتب (Basic + Allowances)
    - **مدين**: حصة المنشأة من التأمينات (إن وُجدت)
    - **دائن**: ذمم موظفين (Net Salary)
    - **دائن**: التأمينات المستحقة (GOSI)
    - **دائن**: سلف الموظفين (لاسترداد قسط السلفة)
  - يحدّث حالة الـ payroll إلى `posted`
- `calculate_eosb(_employee_id, _end_date)`: مكافأة نهاية الخدمة حسب النظام السعودي (نصف شهر للسنوات الـ5 الأولى + شهر كامل لما بعدها)
- `approve_leave_request(_id)`: يخصم من الرصيد ويضيف سجلات حضور تلقائية بحالة `leave`

### Triggers
- منع تعديل/حذف Payroll Run المرحّل
- منع حذف موظف له payslips
- تحديث `remaining_amount` في السلف تلقائياً عند خصم قسط

### الصلاحيات
- إضافة `hr_manager` إلى `app_role`
- صلاحيات: `hr.view`, `hr.employees.manage`, `hr.payroll.run`, `hr.payroll.post`, `hr.leaves.approve`
- RLS: كل جدول ينفذ `has_branch_access` للفلترة على مستوى الفرع

### GRANTS (إلزامية)
كل جدول جديد يحصل على:
```sql
GRANT SELECT,INSERT,UPDATE,DELETE ON public.<table> TO authenticated;
GRANT ALL ON public.<table> TO service_role;
```

---

## المرحلة 2: الواجهات (Frontend)

### الشاشات الجديدة تحت `/hr/*`
1. **Dashboard HR** (`/hr`) — كروت إحصائية (إجمالي الموظفين، إجازات اليوم، رواتب الشهر)
2. **الموظفين** (`/hr/employees`) — قائمة + Form بعدة tabs (شخصي/عقد/راتب/مستندات)
3. **الأقسام** (`/hr/departments`) — شجرة هرمية
4. **المسميات الوظيفية** (`/hr/job-titles`)
5. **الحضور** (`/hr/attendance`) — جدول يومي + استيراد Excel
6. **أنواع الإجازات** (`/hr/leave-types`)
7. **طلبات الإجازات** (`/hr/leave-requests`) — workflow موافقة
8. **أرصدة الإجازات** (`/hr/leave-balances`)
9. **السلف والمكافآت** (`/hr/loans`)
10. **مكونات الراتب** (`/hr/salary-components`) — مع ربط بحساب محاسبي
11. **هيكل رواتب الموظف** — tab داخل شاشة الموظف
12. **تشغيل الرواتب** (`/hr/payroll/runs`) — قائمة + شاشة تشغيل (اختر الشهر → احسب → راجع → رحّل)
13. **كشف راتب** (`/hr/payroll/payslip/:id`) — قابل للطباعة PDF
14. **نهاية الخدمة** (`/hr/end-of-service`) — حساب EOSB وإصدار القيد
15. **تقارير HR** (`/hr/reports`) — كشف رواتب شهري، تكلفة الموظفين بالفرع/القسم، تقرير الإجازات

### تحديثات على ملفات قائمة
- `AppSidebar.tsx`: إضافة قسم **الموارد البشرية** بأيقونة `Users` مع كل الروابط
- `App.tsx`: تسجيل المسارات وحماية بـ `AdminRoute` للأدوار `[admin, branch_manager, hr_manager]`
- `usePermissions.ts`: تجاهل التغييرات (يكفي الدور الجديد)

---

## المرحلة 3: التكامل المحاسبي

- إضافة حقول في **General Settings**:
  - `default_salary_expense_account_id` (مصروف رواتب)
  - `default_salary_payable_account_id` (ذمم موظفين دائنة)
  - `default_gosi_payable_account_id` (التأمينات المستحقة)
  - `default_employee_loans_account_id` (سلف الموظفين)
  - `default_eosb_provision_account_id` (مخصص نهاية الخدمة)
- زر "صرف الرواتب" داخل Payroll Run يفتح **سند دفع** جاهز للموظفين

---

## المرحلة 4: التحضير للربط الخارجي (Integration-ready)
- إضافة عمود `external_id TEXT UNIQUE` في `hr_employees` (للمعلمين القادمين من النظام الأكاديمي)
- إضافة عمود `external_source TEXT` (مثال: `sis_v1`)
- (لاحقاً عند الربط الفعلي) Edge Function: `POST /hr-sync-employee`

---

## ترتيب التنفيذ
1. **الآن**: Migration واحدة شاملة (كل الجداول + الدوال + RLS + Grants + الدور الجديد + إعدادات الحسابات)
2. بعد الموافقة على الـ Migration: بناء الشاشات تباعاً (Employees → Departments → Attendance → Leaves → Salary Components → Payroll → EOSB → Reports)
3. تحديث Sidebar + Routes + Permissions
4. حفظ Memory جديدة: `mem://features/hr-module`

---

## ملاحظات
- **الحجم**: ~15 جدول + 4 دوال + 15 شاشة → سيتم على عدة جولات (لن تكتمل كلها في رد واحد)
- **معايير سعودية**: GOSI 9% موظف + 9% منشأة (سعودي)، EOSB حسب المادة 84 من نظام العمل
- **متعدد الفروع**: كل البيانات مفلترة بـ `branch_id` تلقائياً عبر `BranchContext` الموجود
