import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";

const Index = () => {
  const { userRoles, isLoading } = usePermissions();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    const roles = userRoles.map((r) => r.role);
    // Cashier-only users go straight to POS sessions
    if (roles.length > 0 && roles.every((r) => r === "cashier")) {
      navigate("/pos/sessions", { replace: true });
      return;
    }
    // Everyone else lands on the App Launcher (Odoo-style)
    navigate("/apps", { replace: true });
  }, [userRoles, isLoading, navigate]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
};

export default Index;
