
# خطة: إدارة السنوات المالية وجلسة المستخدم

## 1) إعادة فتح السنة المالية المقفلة (للمسؤول فقط)

### قاعدة البيانات (Migration)
- إضافة أعمدة إلى `year_end_closings`:
  - `reopened_at timestamptz`
  - `reopened_by uuid references auth.users`
  - `reopen_reason text`
  - `status` يُحدّث إلى `reopened`
- جدول جديد `fiscal_period_reopen_logs` لسجل كل عمليات الفتح/الإقفال (تتبع كامل) — مع GRANT + RLS (admin فقط للقراءة).
- دالة `reopen_fiscal_period(period_id uuid, reason text)` (SECURITY DEFINER):
  - تتحقق أن المنفّذ يحمل دور `admin` عبر `has_role`.
  - تُحدّث `fiscal_periods.is_closed = false`.
  - تُحدّث آخر سجل إقفال للسنة إلى `reopened`.
  - تسجّل في `fiscal_period_reopen_logs`.
- دالة `reclose_fiscal_period(period_id uuid)` لإعادة الإقفال بعد التعديلات (admin فقط) — تعيد حساب الإيرادات/المصروفات وتُحدّث `year_end_closings`.

### الواجهة
- في `src/pages/finance/YearEndClosing.tsx`:
  - زر **"إعادة فتح"** يظهر فقط لـ `admin` بجانب الإقفالات بحالة `completed`.
  - Dialog يطلب سبب الفتح (إلزامي) + تأكيد.
  - بطاقة تنبيه أصفر عند وجود سنة معاد فتحها.
- صفحة فرعية `ReopenHistory` (أو تبويب) تعرض `fiscal_period_reopen_logs`.

## 2) اختيار الفرع والسنة المالية عند تسجيل الدخول

### قاعدة البيانات
- لا تغييرات على الجداول (الفترات والفروع موجودة).
- استخدام `sessionStorage` كما هو متّبع في `BranchContext`.

### السياق والواجهة
- تعديل `src/contexts/BranchContext.tsx` ليصبح `SessionContext` يحمل:
  - `activeBranch`, `activeFiscalPeriod`, `isReadOnlyMode` (مشتق من حالة السنة)
- صفحة جديدة `src/pages/SessionSelector.tsx`:
  - بعد نجاح تسجيل الدخول → إعادة توجيه إليها إذا لم تُحدَّد الجلسة.
  - يعرض: قائمة الفروع المتاحة للمستخدم (من `user_branch_assignments`، أو الكل للـ admin)، وقائمة السنوات المالية مع badge (مفتوحة/مقفلة).
  - السنة المقفلة قابلة للاختيار لكن تُفعّل **وضع الاستعراض (Read-Only)**.
  - زر "دخول" يحفظ القيم في sessionStorage.
- تعديل `src/App.tsx`:
  - Route حارس: إذا `!activeBranch || !activeFiscalPeriod` → redirect إلى `/session`.
  - استثناءات: `/auth`, `/session`, مستخدمو الكاشير (يذهبون مباشرة لـ POS بفرعهم الأساسي).
- تعديل `BranchSelector` ليتحول إلى `SessionSwitcher` في الـ Topbar: يعرض الفرع + السنة + زر تبديل (يعيد للـ `/session`).

### وضع الاستعراض (Read-Only)
- Hook جديد `useReadOnlyMode()`:
  - يُرجع `true` إذا `activeFiscalPeriod.is_closed = true`.
- في كل صفحات الإدخال (Journal Entries, Invoices, Vouchers, Payroll …): يُمرَّر `disabled` على أزرار الحفظ/الإضافة + Banner أحمر علوي:
  - "أنت في وضع الاستعراض — السنة المالية مقفلة"
- في `DashboardLayout.tsx`: عرض الـ Banner عند تفعيل الوضع.

## 3) تدفق المستخدم

```text
Login → SessionSelector (اختيار فرع + سنة)
          │
          ├─ سنة مفتوحة → النظام كامل (قراءة/كتابة)
          └─ سنة مقفلة → وضع الاستعراض (قراءة فقط) + Banner
                          │
                          └─ admin يمكنه فتح السنة من شاشة الإقفال السنوي
                              ثم تبديل الجلسة لاستئناف التعديل
```

## ملفات ستُنشأ/تُعدّل

**ينُشأ:**
- `supabase/migrations/...reopen_fiscal_period.sql`
- `src/pages/SessionSelector.tsx`
- `src/contexts/SessionContext.tsx` (أو تطوير BranchContext)
- `src/hooks/useReadOnlyMode.ts`
- `src/components/ReadOnlyBanner.tsx`

**يُعدّل:**
- `src/App.tsx` (حارس الجلسة + الراوت الجديد)
- `src/components/DashboardLayout.tsx` (الـ Banner)
- `src/components/BranchSelector.tsx` → `SessionSwitcher`
- `src/pages/finance/YearEndClosing.tsx` (زر إعادة الفتح + سجلّ)
- `src/pages/Index.tsx` (التحقق من الجلسة)
- `src/hooks/usePermissions.ts` (لا تغيير جوهري)

## ملاحظات تقنية
- `is_global` admin → يرى كل الفروع والسنوات.
- Branch manager → فرعه فقط + كل السنوات.
- Cashier → يتجاوز اختيار السنة (POS لا يعتمد على فترة).
- كل عمليات الفتح/الإقفال مسجّلة في `audit_logs` + `fiscal_period_reopen_logs`.
