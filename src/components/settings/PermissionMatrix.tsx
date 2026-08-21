import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Save, Search, ShieldCheck, ShieldX } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MODULES } from "@/config/modules";

export type SubjectType = "user_type" | "group" | "user";

const ACTIONS = [
  { key: "can_view", label: "عرض" },
  { key: "can_create", label: "إضافة" },
  { key: "can_edit", label: "تعديل" },
  { key: "can_delete", label: "حذف" },
  { key: "can_approve", label: "اعتماد" },
  { key: "can_post", label: "ترحيل" },
  { key: "can_export", label: "تصدير" },
] as const;

const SCOPES = [
  { value: "all", label: "كل البيانات" },
  { value: "branch", label: "الفرع" },
  { value: "department", label: "القسم" },
  { value: "own", label: "سجلاته فقط" },
];

interface Screen {
  id: string;
  code: string;
  name: string;
  module: string;
  route: string;
  sort_order: number;
}

interface Row {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
  can_post: boolean;
  can_export: boolean;
  scope: string;
  deny_view: boolean;
  deny_create: boolean;
  deny_edit: boolean;
  deny_delete: boolean;
  deny_approve: boolean;
  deny_post: boolean;
  deny_export: boolean;
}

const EMPTY: Row = {
  can_view: false,
  can_create: false,
  can_edit: false,
  can_delete: false,
  can_approve: false,
  can_post: false,
  can_export: false,
  scope: "branch",
  deny_view: false,
  deny_create: false,
  deny_edit: false,
  deny_delete: false,
  deny_approve: false,
  deny_post: false,
  deny_export: false,
};

const moduleName = (key: string) =>
  MODULES.find((m) => m.key === key)?.name || key;

export function PermissionMatrix({
  subjectType,
  subjectId,
}: {
  subjectType: SubjectType;
  subjectId: string;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [state, setState] = useState<Record<string, Row>>({});
  const [saving, setSaving] = useState(false);

  const { data: screens = [] } = useQuery({
    queryKey: ["app-screens"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("app_screens")
        .select("*")
        .eq("is_active", true)
        .order("module")
        .order("sort_order");
      if (error) throw error;
      return data as Screen[];
    },
  });

  const { data: existing = [] } = useQuery({
    queryKey: ["screen-permissions", subjectType, subjectId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("screen_permissions")
        .select("*")
        .eq("subject_type", subjectType)
        .eq("subject_id", subjectId);
      if (error) throw error;
      return data as (Row & { screen_id: string })[];
    },
    enabled: !!subjectId,
  });

  useEffect(() => {
    const next: Record<string, Row> = {};
    for (const s of screens) next[s.id] = { ...EMPTY };
    for (const row of existing) {
      next[row.screen_id] = {
        can_view: row.can_view,
        can_create: row.can_create,
        can_edit: row.can_edit,
        can_delete: row.can_delete,
        can_approve: row.can_approve,
        can_post: row.can_post,
        can_export: row.can_export,
        scope: row.scope,
        deny_view: row.deny_view,
        deny_create: row.deny_create,
        deny_edit: row.deny_edit,
        deny_delete: row.deny_delete,
        deny_approve: row.deny_approve,
        deny_post: row.deny_post,
        deny_export: row.deny_export,
      };
    }
    setState(next);
  }, [screens, existing]);

  const grouped = useMemo(() => {
    const term = search.trim();
    const filtered = term
      ? screens.filter((s) => s.name.includes(term) || s.code.includes(term))
      : screens;
    return filtered.reduce<Record<string, Screen[]>>((acc, s) => {
      (acc[s.module] ||= []).push(s);
      return acc;
    }, {});
  }, [screens, search]);

  const toggle = (screenId: string, key: keyof Row) =>
    setState((prev) => {
      const row = prev[screenId] || { ...EMPTY };
      const value = !row[key as keyof Row];
      const updated: Row = { ...row, [key]: value } as Row;
      // أي إجراء آخر يتطلب صلاحية العرض
      if (key !== "can_view" && value) updated.can_view = true;
      if (key === "can_view" && !value) {
        ACTIONS.forEach((a) => ((updated as any)[a.key] = false));
      }
      return { ...prev, [screenId]: updated };
    });

  const setModule = (module: string, grant: boolean) =>
    setState((prev) => {
      const next = { ...prev };
      (grouped[module] || []).forEach((s) => {
        next[s.id] = grant
          ? {
              ...(next[s.id] || EMPTY),
              can_view: true,
              can_create: true,
              can_edit: true,
              can_delete: true,
              can_approve: true,
              can_post: true,
              can_export: true,
            }
          : { ...(next[s.id] || EMPTY), ...EMPTY };
      });
      return next;
    });

  const setScope = (screenId: string, scope: string) =>
    setState((prev) => ({ ...prev, [screenId]: { ...(prev[screenId] || EMPTY), scope } }));

  const setException = (screenId: string, action: string, value: string) =>
    setState((prev) => {
      const row = { ...(prev[screenId] || EMPTY) };
      const allowKey = `can_${action}` as keyof Row;
      const denyKey = `deny_${action}` as keyof Row;
      (row as any)[allowKey] = value === "allow";
      (row as any)[denyKey] = value === "deny";
      if (action !== "view" && value === "allow") row.can_view = true;
      return { ...prev, [screenId]: row };
    });

  const handleSave = async () => {
    setSaving(true);
    try {
      const rows = screens
        .map((s) => ({ screen_id: s.id, ...(state[s.id] || EMPTY) }))
        .filter((r) => ACTIONS.some((a) => (r as any)[a.key] || (r as any)[a.key.replace("can_", "deny_")]));

      const { error: delError } = await (supabase as any)
        .from("screen_permissions")
        .delete()
        .eq("subject_type", subjectType)
        .eq("subject_id", subjectId);
      if (delError) throw delError;

      if (rows.length > 0) {
        const { error } = await (supabase as any).from("screen_permissions").insert(
          rows.map((r) => ({ ...r, subject_type: subjectType, subject_id: subjectId }))
        );
        if (error) throw error;
      }

      await queryClient.invalidateQueries({ queryKey: ["screen-permissions", subjectType, subjectId] });
      await queryClient.invalidateQueries({ queryKey: ["effective-screen-permissions"] });
      toast({ title: "تم الحفظ", description: `تم تحديث صلاحيات ${rows.length} شاشة` });
    } catch (e: any) {
      toast({ title: "خطأ في الحفظ", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const grantedCount = screens.filter((s) => state[s.id]?.can_view).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث عن شاشة..."
            className="pe-9"
          />
        </div>
        <Badge variant="secondary">{grantedCount} شاشة مسموحة</Badge>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "جاري الحفظ..." : "حفظ الصلاحيات"}
        </Button>
      </div>

      {subjectType === "user" && (
        <p className="text-sm text-muted-foreground">
          لكل إجراء اختر: موروث (لا تغيير)، سماح إضافي، أو منع استثنائي. المنع الاستثنائي يتجاوز النوع والمجموعات.
        </p>
      )}
      <div className="space-y-6 max-h-[60vh] overflow-y-auto pe-1">
        {Object.entries(grouped).map(([module, list]) => (
          <div key={module} className="rounded-[10px] border">
            <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2">
              <span className="font-semibold">{moduleName(module)}</span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="gap-1" onClick={() => setModule(module, true)}>
                  <ShieldCheck className="h-4 w-4" /> منح الكل
                </Button>
                <Button variant="ghost" size="sm" className="gap-1" onClick={() => setModule(module, false)}>
                  <ShieldX className="h-4 w-4" /> إزالة الكل
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="p-2 text-start font-medium">الشاشة</th>
                    {ACTIONS.map((a) => (
                      <th key={a.key} className="p-2 font-medium w-16">{a.label}</th>
                    ))}
                    <th className="p-2 font-medium w-40">نطاق البيانات</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((s) => {
                    const row = state[s.id] || EMPTY;
                    return (
                      <tr key={s.id} className="border-t hover:bg-muted/30">
                        <td className="p-2">{s.name}</td>
                        {ACTIONS.map((a) => (
                          <td key={a.key} className="p-2 text-center">
                            {subjectType === "user" ? (
                              <Select
                                value={(row as any)[a.key.replace("can_", "deny_")] ? "deny" : (row as any)[a.key] ? "allow" : "inherit"}
                                onValueChange={(value) => setException(s.id, a.key.replace("can_", ""), value)}
                              >
                                <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="inherit">موروث</SelectItem>
                                  <SelectItem value="allow">سماح</SelectItem>
                                  <SelectItem value="deny">منع</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Checkbox
                                checked={Boolean((row as any)[a.key])}
                                onCheckedChange={() => toggle(s.id, a.key as keyof Row)}
                              />
                            )}
                          </td>
                        ))}
                        <td className="p-2">
                          <Select value={row.scope} onValueChange={(v) => setScope(s.id, v)}>
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SCOPES.map((sc) => (
                                <SelectItem key={sc.value} value={sc.value}>{sc.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
