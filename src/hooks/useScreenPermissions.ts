import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ScreenAction = "view" | "create" | "edit" | "delete" | "approve" | "post" | "export";
export type AccessScope = "all" | "branch" | "department" | "own";

export interface EffectiveScreenPermission {
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
  scope: AccessScope;
}

const ACTION_KEY: Record<ScreenAction, keyof EffectiveScreenPermission> = {
  view: "can_view",
  create: "can_create",
  edit: "can_edit",
  delete: "can_delete",
  approve: "can_approve",
  post: "can_post",
  export: "can_export",
};

/** RBAC + ReBAC effective permissions for the signed-in user, per screen. */
export function useScreenPermissions() {
  const { user } = useAuth();

  const { data = [], isLoading } = useQuery({
    queryKey: ["effective-screen-permissions", user?.id],
    queryFn: async () => {
      if (!user) return [] as EffectiveScreenPermission[];
      const { data, error } = await (supabase as any).rpc("get_effective_screen_permissions", {
        _user_id: user.id,
      });
      if (error) throw error;
      return (data || []) as EffectiveScreenPermission[];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const byCode = new Map(data.map((p) => [p.screen_code, p]));
  const byRoute = new Map(data.map((p) => [p.route, p]));

  const can = (screenCode: string, action: ScreenAction = "view") => {
    const row = byCode.get(screenCode);
    if (!row) return false;
    return Boolean(row[ACTION_KEY[action]]);
  };

  const canRoute = (route: string, action: ScreenAction = "view") => {
    const row = byRoute.get(route);
    if (!row) return false;
    return Boolean(row[ACTION_KEY[action]]);
  };

  const scopeOf = (screenCode: string): AccessScope =>
    byCode.get(screenCode)?.scope ?? "own";

  const visibleScreens = data.filter((p) => p.can_view);

  return { permissions: data, visibleScreens, can, canRoute, scopeOf, isLoading };
}
