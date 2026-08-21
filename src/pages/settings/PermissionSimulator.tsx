import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListPageHeader } from "@/components/ListPageHeader";
import { CheckCircle2, XCircle, MinusCircle, PlayCircle, Info } from "lucide-react";

const ACTIONS = [
  { value: "view", label: "عرض" },
  { value: "create", label: "إضافة" },
  { value: "edit", label: "تعديل" },
  { value: "delete", label: "حذف" },
  { value: "approve", label: "اعتماد" },
  { value: "post", label: "ترحيل" },
  { value: "export", label: "تصدير" },
];

interface Step {
  step_order: number;
  layer: string;
  layer_label: string;
  source_name: string | null;
  result: string;
  is_decisive: boolean;
  note: string;
}

export default function PermissionSimulator() {
  const [userId, setUserId] = useState("");
  const [screenCode, setScreenCode] = useState("");
  const [action, setAction] = useState("view");
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [running, setRunning] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ["simulator-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: screens = [] } = useQuery({
    queryKey: ["simulator-screens"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("app_screens")
        .select("code, name, module")
        .eq("is_active", true)
        .order("module")
        .order("sort_order");
      if (error) throw error;
      return data as any[];
    },
  });

  const run = async () => {
    if (!userId || !screenCode) return;
    setRunning(true);
    const { data, error } = await (supabase as any).rpc("explain_screen_access", {
      _user_id: userId,
      _screen_code: screenCode,
      _action: action,
    });
    setRunning(false);
    if (error) {
      setSteps([]);
      return;
    }
    setSteps((data || []) as Step[]);
  };

  const decisive = steps?.find((s) => s.is_decisive);

  const icon = (result: string) =>
    result === "allow" ? (
      <CheckCircle2 className="h-4 w-4 text-primary" />
    ) : result === "deny" ? (
      <XCircle className="h-4 w-4 text-destructive" />
    ) : (
      <MinusCircle className="h-4 w-4 text-muted-foreground" />
    );

  return (
    <div className="space-y-4">
      <ListPageHeader
        title="مراجعة وصول المستخدم"
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "التحكم بالوصول" },
          { label: "مراجعة وصول المستخدم" },
        ]}
        showSearch={false}
      />

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          اختر مستخدماً وشاشة وإجراءً لمعرفة هل الوصول مسموح، ولماذا. ترتيب القرار:
          مسؤول النظام ← استثناء المستخدم (منح أو منع) ← المجموعات ← نوع المستخدم ← الرفض الافتراضي.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">اختبار وصول محدد</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4 md:items-end">
          <div className="space-y-2">
            <Label>المستخدم</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر مستخدماً" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>الشاشة</Label>
            <Select value={screenCode} onValueChange={setScreenCode}>
              <SelectTrigger>
                <SelectValue placeholder="اختر شاشة" />
              </SelectTrigger>
              <SelectContent>
                {screens.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>الإجراء</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIONS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={run} disabled={!userId || !screenCode || running} className="gap-2">
            <PlayCircle className="h-4 w-4" />
            {running ? "جاري الفحص..." : "مراجعة الوصول"}
          </Button>
        </CardContent>
      </Card>

      {steps && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              النتيجة النهائية:
              {decisive?.result === "allow" ? (
                <Badge className="bg-primary">مسموح</Badge>
              ) : (
                <Badge variant="destructive">ممنوع</Badge>
              )}
              {decisive?.source_name && (
                <span className="text-sm font-normal text-muted-foreground">
                  المصدر: {decisive.layer_label} ({decisive.source_name})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {steps.map((s) => (
              <div
                key={s.step_order}
                className={`flex items-start gap-3 rounded-[10px] border p-3 ${
                  s.is_decisive ? "border-primary bg-muted/40" : ""
                }`}
              >
                {icon(s.result)}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{s.layer_label}</span>
                    {s.source_name && <Badge variant="secondary">{s.source_name}</Badge>}
                    {s.is_decisive && <Badge variant="outline">القرار الحاسم</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{s.note}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
