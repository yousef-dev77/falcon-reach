---
name: Fiscal Year Reopen & Session Selection
description: Admin can reopen closed fiscal years with reason; login requires picking branch + fiscal year; closed periods enable Read-Only mode
type: feature
---

## Reopening a closed fiscal year
- Only `admin` (checked via `has_role`) can call `public.reopen_fiscal_period(_period_id, _reason)`.
- Reason text is required (min 5 chars). Action logged in `fiscal_period_reopen_logs` and `year_end_closings.status = 'reopened'` with `reopened_at`, `reopened_by`, `reopen_reason`.
- `public.reclose_fiscal_period(_period_id)` re-closes after corrections.
- UI: "إعادة فتح" button visible only for admins on completed closings in `src/pages/finance/YearEndClosing.tsx`.

## Session Selection
- After login, user is redirected to `/session` (`SessionSelector.tsx`) to pick branch + fiscal period.
- Cashier-only users skip this and go straight to `/pos/sessions` with their primary branch.
- State stored in `sessionStorage` (`falcon_active_branch`, `falcon_active_period`) via `BranchContext`.
- `SessionGuard` (inside `DashboardLayout`) redirects to `/session` if branch or period not chosen.
- Header shows current period with a clickable badge to switch session.

## Read-Only Mode
- `useBranch().isReadOnly` is true when `activeFiscalPeriod.is_closed`.
- `ReadOnlyBanner` shows amber sticky bar at top of layout.
- Pages should disable mutation buttons when `isReadOnly` is true.
