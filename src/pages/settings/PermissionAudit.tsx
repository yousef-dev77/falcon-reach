import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListPageHeader } from "@/components/ListPageHeader";
import { Info } from "lucide-react";

const subjectLabel: Record<string, string> = {
  user_type: "نوع مستخدم",
  group: "مجموعة",
  user: "مستخدم",
};

const actionLabel: Record<string, string> = {
  insert: "منح / إضافة",
  update: "تعديل",
  delete: "إزالة",
};

const fmt = (d: string) => new Date(d).toLocaleString("ar", { hour12: false });

const grantedActions = (state: any) => {
  if (!state) return [];
  const map: Record<string, string> = {
    can_view: "عرض",
    can_create: "إضافة",
    can_edit: "تعديل",
    can_delete: "حذف",
    can_approve: "اعتماد",
    can_post: "ترحيل",
    can_export: "تصدير",
  };
  return Object.entries(map)
    .filter(([k]) => state[k])
    .map(([, v]) => v);
};

export default function PermissionAudit() {
  const { data: permLogs = [] } = useQuery({
    queryKey: ["permission-change-logs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("permission_change_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: policyLogs = [] } = useQuery({
    queryKey: ["policy-change-logs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("policy_change_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data as any[];
    },
  });

  return (
    <div className="space-y-4">
      <ListPageHeader
        title="سجل تغييرات الصلاحيات"
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "التحكم بالوصول" },
          { label: "سجل تغييرات الصلاحيات" },
        ]}
        showSearch={false}
      />

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          سجل للقراءة فقط يوضح كل منح أو إزالة صلاحية: على من، وأي شاشة، ومتى. يساعد في المراجعة
          والتدقيق.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="permissions">
        <TabsList>
          <TabsTrigger value="permissions">صلاحيات الشاشات ({permLogs.length})</TabsTrigger>
          <TabsTrigger value="policies">سياسات الوصول ({policyLogs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="permissions" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">آخر 300 تغيير</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الجهة</TableHead>
                    <TableHead>الشاشة</TableHead>
                    <TableHead>نوع التغيير</TableHead>
                    <TableHead>الصلاحيات بعد التغيير</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permLogs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {fmt(l.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{subjectLabel[l.subject_type]}</Badge>
                          <span>{l.subject_label || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell>{l.screen_name || l.screen_code || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={l.action_type === "delete" ? "destructive" : "secondary"}>
                          {actionLabel[l.action_type] || l.action_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {grantedActions(l.after_state).join("، ") || "لا شيء"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {permLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        لا توجد تغييرات مسجلة بعد
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">تغييرات السياسات</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>السياسة</TableHead>
                    <TableHead>نوع التغيير</TableHead>
                    <TableHead>الأثر</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policyLogs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {fmt(l.created_at)}
                      </TableCell>
                      <TableCell>{l.policy_name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={l.action_type === "delete" ? "destructive" : "secondary"}>
                          {actionLabel[l.action_type] || l.action_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {l.after_state?.effect === "deny" ? (
                          <Badge variant="destructive">منع</Badge>
                        ) : l.after_state?.effect === "allow" ? (
                          <Badge className="bg-primary">سماح</Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {policyLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        لا توجد تغييرات مسجلة بعد
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
