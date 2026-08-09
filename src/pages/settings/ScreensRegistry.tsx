import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ListPageHeader } from "@/components/ListPageHeader";
import { MODULES } from "@/config/modules";
import { Info, Search, MonitorSmartphone } from "lucide-react";

interface Screen {
  id: string;
  code: string;
  name: string;
  module: string;
  route: string;
  is_active: boolean;
  sort_order: number;
}

const moduleName = (key: string) => MODULES.find((m) => m.key === key)?.name || key;

export default function ScreensRegistry() {
  const [search, setSearch] = useState("");

  const { data: screens = [], isLoading } = useQuery({
    queryKey: ["app-screens-registry"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("app_screens")
        .select("*")
        .order("module")
        .order("sort_order");
      if (error) throw error;
      return data as Screen[];
    },
  });

  const grouped = useMemo(() => {
    const term = search.trim();
    const list = term
      ? screens.filter(
          (s) => s.name.includes(term) || s.code.includes(term) || s.route.includes(term)
        )
      : screens;
    return list.reduce<Record<string, Screen[]>>((acc, s) => {
      (acc[s.module] ||= []).push(s);
      return acc;
    }, {});
  }, [screens, search]);

  return (
    <div className="space-y-4">
      <ListPageHeader
        title="شاشات النظام"
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "التحكم بالوصول" },
          { label: "شاشات النظام" },
        ]}
        showSearch={false}
      />

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          هذا هو سجل الشاشات المرجعي — كل صلاحية في النظام تُمنح على شاشة من هذه القائمة. عدد
          الشاشات: <strong>{screens.length}</strong>
        </AlertDescription>
      </Alert>

      <div className="relative max-w-md">
        <Search className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو الكود أو المسار..."
          className="pe-9"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">جاري التحميل...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(grouped).map(([module, list]) => (
            <Card key={module}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <MonitorSmartphone className="h-4 w-4" />
                    {moduleName(module)}
                  </span>
                  <Badge variant="secondary">{list.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {list.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded-[10px] px-2 py-1.5 text-sm hover:bg-muted/50"
                  >
                    <span>{s.name}</span>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-muted-foreground">{s.code}</code>
                      {!s.is_active && <Badge variant="outline">معطلة</Badge>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
