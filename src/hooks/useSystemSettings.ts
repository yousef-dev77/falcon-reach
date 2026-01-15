import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SystemSetting {
  id: string;
  setting_key: string;
  setting_value: string | null;
  setting_type: string;
  category: string;
  description: string | null;
}

export function useSystemSettings(category?: string) {
  return useQuery({
    queryKey: ["system-settings", category],
    queryFn: async () => {
      let query = supabase.from("system_settings").select("*");
      
      if (category) {
        query = query.eq("category", category);
      }
      
      const { data, error } = await query.order("setting_key");
      if (error) throw error;
      return data as SystemSetting[];
    },
  });
}

export function useSystemSetting(key: string) {
  return useQuery({
    queryKey: ["system-setting", key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .eq("setting_key", key)
        .maybeSingle();
      if (error) throw error;
      return data as SystemSetting | null;
    },
  });
}

export function useUpdateSystemSetting() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string | null }) => {
      const { error } = await supabase
        .from("system_settings")
        .update({ setting_value: value })
        .eq("setting_key", key);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      queryClient.invalidateQueries({ queryKey: ["system-setting"] });
    },
  });
}

// Hook للحصول على الحسابات القابلة للترحيل فقط (حسابات فرعية نهائية)
export function usePostableAccounts() {
  return useQuery({
    queryKey: ["postable-accounts"],
    queryFn: async () => {
      // جلب جميع الحسابات النشطة التي تسمح بالإدخال اليدوي
      const { data: allAccounts, error } = await supabase
        .from("accounts")
        .select("id, code, name, account_type, parent_id, level, allow_manual_entry, is_active, is_frozen")
        .eq("is_active", true)
        .eq("allow_manual_entry", true)
        .eq("is_frozen", false)
        .order("code");
      
      if (error) throw error;
      
      // فلترة الحسابات لإظهار فقط الحسابات التي ليس لها فروع
      const accountIds = new Set(allAccounts?.map(a => a.id) || []);
      const parentIds = new Set(allAccounts?.filter(a => a.parent_id).map(a => a.parent_id) || []);
      
      // الحسابات القابلة للترحيل هي التي ليست آباء لحسابات أخرى
      const postableAccounts = allAccounts?.filter(account => !parentIds.has(account.id)) || [];
      
      return postableAccounts;
    },
  });
}
