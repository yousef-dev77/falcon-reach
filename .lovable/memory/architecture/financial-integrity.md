---
name: Financial Integrity & Concurrency
description: Row locks, negative-balance prevention, and Idempotency keys for financial operations
type: feature
---
- كل الترحيل/الاعتماد يتم داخل دوال قاعدة بيانات (معاملة واحدة) لا في العميل.
- الدوال الحساسة تقفل السجل (`SELECT ... FOR UPDATE`) وتتحقق من الحالة بعد القفل: post_delivery_note, pay_pos_order, approve_loan, post_payroll_run, post_hr_voucher, record_loan_payment, confirm_* , get_next_document_number.
- منع الرصيد السالب: قفل صف الصنف (`products ... FOR UPDATE`) قبل حساب الرصيد من `inventory_movements` ثم الخصم.
- Idempotency: جدول `public.idempotency_keys` + `claim_idempotency_key(scope,key,hash)` / `complete_idempotency_key(scope,key,result)`. مستخدم في سندات الصرف (scope: supplier_payment) — يُنشئ العميل مفتاح UUID لكل نموذج ويُعاد توليده عند فتح النافذة.
- أرقام المستندات لها فهارس فريدة (delivery_notes, pos_orders, hr_payment_vouchers, payments, collections) كطبقة حماية ثانية ضد التكرار.
- الرصيد لا يُخزن كحقل واحد: يُحتسب دائماً من سجل الحركات (inventory_movements / journal_entry_lines).
