import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListPageHeader } from "@/components/ListPageHeader";
import { PermissionMatrix } from "@/components/settings/PermissionMatrix";
import { Info, ShieldAlert } from "lucide-react";

export default function UserOverrides() {
  const [params, setParams] = useSearchParams();
  const [userId, setUserId] = useState(params.get("user") || "");

  useEffect(() => {
    const q = params.get("user");
    if (q && q !== userId) setUserId(q);
  }, [params]);

  const { data: users = [] } = useQuery({
    queryKey: ["override-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");
      if (error) throw error;
      return data as any[];
    },
  });

  const selected = users.find((u) => u.id === userId);

  const onChange = (v: string) => {
    setUserId(v);
    setParams({ user: v });
  };

  return (
    <div className="space-y-4">
      <ListPageHeader
        title="استثناءات المستخدمين"
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "التحكم بالوصول" },
          { label: "استثناءات المستخدمين" },
        ]}
        showSearch={false}
      />

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          استخدم الاستثناء للحالات النادرة فقط: يمكنك منح المستخدم صلاحية إضافية أو منعه من إجراء
          يرثه من نوعه أو مجموعاته. <strong>المنع الفردي هو الأعلى أولوية.</strong>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4" />
            اختر المستخدم
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-md">
            <Label>المستخدم</Label>
            <Select value={userId} onValueChange={onChange}>
              <SelectTrigger>
                <SelectValue placeholder="اختر مستخدماً" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name} — {u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selected ? (
            <PermissionMatrix subjectType="user" subjectId={selected.id} />
          ) : (
            <p className="text-sm text-muted-foreground">
              اختر مستخدماً لعرض استثناءاته الخاصة.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
