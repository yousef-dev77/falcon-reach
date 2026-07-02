import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MODULES, getModule } from "@/config/modules";
import { toast } from "sonner";

export function useInstalledModules() {
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("installed_modules" as any).select("module_key");
    if (!error && data) {
      const set = new Set<string>((data as any[]).map((r) => r.module_key));
      // always-available modules
      MODULES.filter((m) => m.installable === false).forEach((m) => set.add(m.key));
      setInstalled(set);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const install = async (key: string) => {
    const mod = getModule(key);
    if (!mod) return;
    const keys = new Set<string>([key, ...(mod.dependsOn ?? [])]);
    const rows = Array.from(keys).map((k) => ({ module_key: k }));
    const { error } = await supabase.from("installed_modules" as any).upsert(rows, { onConflict: "module_key" });
    if (error) { toast.error("تعذّر تثبيت النظام: " + error.message); return; }
    toast.success(`تم تثبيت ${mod.name}`);
    await load();
  };

  const uninstall = async (key: string) => {
    const mod = getModule(key);
    if (!mod || mod.installable === false) return;
    const { error } = await supabase.from("installed_modules" as any).delete().eq("module_key", key);
    if (error) { toast.error("تعذّر الإلغاء: " + error.message); return; }
    toast.success(`تم إلغاء تثبيت ${mod.name}`);
    await load();
  };

  return { installed, loading, install, uninstall, reload: load };
}
