import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";

const Index = () => {
  const { user } = useAuth();
  const { userRoles, isLoading } = usePermissions();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    const roles = userRoles.map(r => r.role);
    // Cashier-only users go straight to POS sessions
    if (roles.length > 0 && roles.every(r => r === "cashier")) {
      navigate("/pos/sessions", { replace: true });
    }
  }, [userRoles, isLoading, navigate]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">مرحباً بك في نظام فالكون ERP</h1>
        <p className="text-muted-foreground">
          مرحباً {user?.email}، يمكنك الآن البدء في استخدام النظام
        </p>
      </div>
    </div>
  );
};

export default Index;
