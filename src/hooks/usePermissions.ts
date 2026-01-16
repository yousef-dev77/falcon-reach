import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Permission {
  id: string;
  code: string;
  name: string;
  description: string | null;
  module: string;
}

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
  branch?: {
    id: string;
    name: string;
    code: string;
  };
}

export function usePermissions() {
  const { user } = useAuth();

  const { data: permissions = [], isLoading: permissionsLoading } = useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .order('module', { ascending: true });
      
      if (error) throw error;
      return data as Permission[];
    },
  });

  const { data: userRoles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['user-roles', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data as UserRole[];
    },
    enabled: !!user,
  });

  const { data: userBranches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ['user-branches', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_branch_assignments')
        .select(`
          *,
          branch:branches(id, name, code)
        `)
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data as UserBranchAssignment[];
    },
    enabled: !!user,
  });

  const isAdmin = userRoles.some(r => r.role === 'admin');
  const isGlobalUser = userRoles.some(r => r.is_global);
  const primaryBranch = userBranches.find(b => b.is_primary);

  const hasRole = (role: string) => {
    return userRoles.some(r => r.role === role);
  };

  const hasBranchAccess = (branchId: string) => {
    if (isAdmin && isGlobalUser) return true;
    return userBranches.some(b => b.branch_id === branchId);
  };

  const permissionsByModule = permissions.reduce((acc, perm) => {
    if (!acc[perm.module]) {
      acc[perm.module] = [];
    }
    acc[perm.module].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  return {
    permissions,
    permissionsByModule,
    userRoles,
    userBranches,
    isAdmin,
    isGlobalUser,
    primaryBranch,
    hasRole,
    hasBranchAccess,
    isLoading: permissionsLoading || rolesLoading || branchesLoading,
  };
}

export function useAllUsers() {
  return useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          user_roles!user_roles_user_id_fkey(
            id,
            role,
            branch_id,
            is_global
          ),
          user_branch_assignments(
            id,
            branch_id,
            is_primary,
            branch:branches(id, name, code)
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
}

export function useRolePermissions() {
  return useQuery({
    queryKey: ['role-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_permissions')
        .select(`
          *,
          permission:permissions(*)
        `);
      
      if (error) throw error;
      return data;
    },
  });
}
