import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useBranch } from "@/contexts/BranchContext";
import { usePermissions } from "@/hooks/usePermissions";

/**
 * يضمن أن المستخدم اختار فرعاً وسنة مالية قبل الدخول لأي صفحة.
 * يتجاوز الفحص لمستخدمي الكاشير فقط (لا يعتمدون على فترة محاسبية).
 */
export function SessionGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { activeBranch, activeFiscalPeriod, isLoading } = useBranch();
  const { userRoles, isLoading: rolesLoading } = usePermissions();

  const roles = userRoles.map(r => r.role);
  const isCashierOnly = roles.length > 0 && roles.every(r => r === "cashier");

  useEffect(() => {
    if (isLoading || rolesLoading) return;
    if (isCashierOnly) return; // Cashiers handled separately
    if (!activeBranch || !activeFiscalPeriod) {
      navigate("/session", { replace: true });
    }
  }, [activeBranch, activeFiscalPeriod, isLoading, rolesLoading, isCashierOnly, navigate]);

  if (isLoading || rolesLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!isCashierOnly && (!activeBranch || !activeFiscalPeriod)) {
    return null;
  }

  return <>{children}</>;
}
