import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";

interface AdminRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  requiredPermission?: string;
}

export function AdminRoute({ children, allowedRoles = ['admin'], requiredPermission }: AdminRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { userRoles, hasPermission, hasCustomPermissions, isLoading: permissionsLoading } = usePermissions();
  const { permissions: screenPermissions, canRoute, isLoading: screenLoading } = useScreenPermissions();
  const navigate = useNavigate();
  const location = useLocation();

  const isLoading = authLoading || permissionsLoading || screenLoading;
  
  const inferredPermission =
    requiredPermission ||
    (location.pathname.startsWith('/finance') ? 'finance' :
    location.pathname.startsWith('/inventory') ? 'inventory' :
    location.pathname.startsWith('/sales') ? 'sales' :
    location.pathname.startsWith('/purchases') ? 'purchases' :
    location.pathname.startsWith('/hr') ? 'hr' :
    location.pathname.startsWith('/pos') ? 'pos' :
    location.pathname.startsWith('/settings') ? 'settings' : undefined);

  const routePermission = screenPermissions.find((p) =>
    location.pathname === p.route || location.pathname.startsWith(`${p.route}/`)
  );
  const isAdmin = userRoles.some((r) => r.role === "admin");
  const hasAccess = isAdmin || (routePermission
    ? canRoute(routePermission.route)
    : inferredPermission
      ? hasPermission(inferredPermission) || (!hasCustomPermissions && userRoles.some(r => allowedRoles.includes(r.role)))
      : userRoles.some(r => allowedRoles.includes(r.role)));

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
