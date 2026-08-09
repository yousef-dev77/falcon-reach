import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Single source of truth for access:
 *   user_type  ->  groups  ->  user override  ->  access policies (ReBAC)
 * Legacy tables (permissions / role_permissions / user_permissions) were removed.
 */

export interface UserRole {
  id: string;
  role: string;
  branch_id: string | null;
  is_global: boolean;
}

export interface UserBranchAssignment {
  id: string;
  branch_id: string;
  is_primary: boolean;
  branch?: { id: string; name: string; code: string };
}

interface EffectiveScreenRow {
  screen_code: string;
  screen_name: string;
  module: string;
  route: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
  can_post: boolean;
  can_export: boolean;
  scope: string;
}

export function usePermissions() {
  const { user } = useAuth();

  const { data: userRoles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      if (!user) return [] as UserRole[];
      const { data, error } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", user.id);
      if (error) throw error;
      return data as UserRole[];
    },
    enabled: !!user,
  });

  const { data: userBranches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ["user-branches", user?.id],
    queryFn: async () => {
      if (!user) return [] as UserBranchAssignment[];
      const { data, error } = await supabase
        .from("user_branch_assignments")
        .select(`*, branch:branches(id, name, code)`)
        .eq("user_id", user.id);
      if (error) throw error;
      return data as UserBranchAssignment[];
    },
    enabled: !!user,
  });

  const { data: screenPermissions = [], isLoading: screensLoading } = useQuery({
    queryKey: ["effective-screen-permissions", user?.id],
    queryFn: async () => {
      if (!user) return [] as EffectiveScreenRow[];
      const { data, error } = await (supabase as any).rpc(
        "get_effective_screen_permissions",
        { _user_id: user.id }
      );
      if (error) throw error;
      return (data || []) as EffectiveScreenRow[];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const isAdmin = userRoles.some((r) => r.role === "admin");
  const isGlobalUser = userRoles.some((r) => r.is_global);
  const primaryBranch = userBranches.find((b) => b.is_primary);

  const visibleScreens = screenPermissions.filter((p) => p.can_view);
  const allowedModules = new Set(visibleScreens.map((p) => p.module));

  /** true when the user has an explicit permission profile (type/group/override). */
  const hasConfiguredPermissions = visibleScreens.length > 0;

  const hasRole = (role: string) => userRoles.some((r) => r.role === role);

  /** Accepts a module key ("finance") or a screen code ("finance.accounts"). */
  const hasPermission = (moduleOrCode: string) => {
    if (isAdmin) return true;
    if (allowedModules.has(moduleOrCode)) return true;
    return visibleScreens.some((p) => p.screen_code === moduleOrCode);
  };

  const hasBranchAccess = (branchId: string) => {
    if (isAdmin && isGlobalUser) return true;
    return userBranches.some((b) => b.branch_id === branchId);
  };

  return {
    userRoles,
    userBranches,
    visibleScreens,
    allowedModules: Array.from(allowedModules),
    hasConfiguredPermissions,
    /** @deprecated use hasConfiguredPermissions */
    hasCustomPermissions: hasConfiguredPermissions,
    isAdmin,
    isGlobalUser,
    primaryBranch,
    hasRole,
    hasPermission,
    hasBranchAccess,
    isLoading: rolesLoading || branchesLoading || screensLoading,
  };
}

export function useAllUsers() {
  return useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          *,
          user_roles!user_roles_user_id_fkey(id, role, branch_id, is_global),
          user_branch_assignments(
            id,
            branch_id,
            is_primary,
            branch:branches(id, name, code)
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
