import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";

interface AdminRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export function AdminRoute({ children, allowedRoles = ['admin'] }: AdminRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { userRoles, isLoading: permissionsLoading } = usePermissions();
  const navigate = useNavigate();

  const isLoading = authLoading || permissionsLoading;
  
  const hasAccess = userRoles.some(r => allowedRoles.includes(r.role));

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    } else if (!isLoading && user && !hasAccess) {
      navigate("/");
    }
  }, [user, isLoading, hasAccess, navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!user || !hasAccess) {
    return null;
  }

  return <>{children}</>;
}
