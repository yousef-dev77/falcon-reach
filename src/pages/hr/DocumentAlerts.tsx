import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, AlertTriangle, FileWarning, FileSignature } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ListPageHeader } from "@/components/ListPageHeader";
import { format, differenceInDays } from "date-fns";

const DOC_TYPES: Record<string, string> = {
  iqama: "إقامة", passport: "جواز سفر", license: "رخصة قيادة",
  health_card: "بطاقة صحية", id_card: "هوية وطنية", other: "أخرى",
};

export default function DocumentAlerts() {
  const [docs, setDocs] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [emps, setEmps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    const [d, c, e] = await Promise.all([
      supabase.rpc("get_expiring_documents", { _days_ahead: 90 }),
      supabase.from("hr_contracts").select("*").eq("status", "active").not("end_date", "is", null),
      supabase.from("hr_employees").select("id, full_name, employee_number").eq("is_active", true),
    ]);
    setDocs(d.data || []);
    const expiringContracts = (c.data || [])
      .map(ct => ({ ...ct, days: differenceInDays(new Date(ct.end_date), new Date()) }))
      .filter(ct => ct.days <= 90)
      .sort((a, b) => a.days - b.days);
    setContracts(expiringContracts);
    setEmps(e.data || []);
    setLoading(false);
  };
  useEffect(() => { fetch(); }, []);

  const sevBadge = (sev: string, days: number) => {
    if (sev === "expired" || days < 0) return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />منتهي ({Math.abs(days)} يوم)</Badge>;
    if (sev === "critical") return <Badge variant="destructive">حرج — {days} يوم</Badge>;
    if (sev === "warning") return <Badge variant="outline" className="border-amber-500 text-amber-700">تحذير — {days} يوم</Badge>;
    return <Badge variant="secondary">{days} يوم</Badge>;
  };

  return (
    <div className="space-y-4">
      <ListPageHeader
        title="تنبيهات الوثائق والعقود"
        breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "الموارد البشرية", href: "/hr" }, { label: "التنبيهات" }]}
        showAdd={false}
        showSearch={false}
        onRefresh={fetch}
      />
      {loading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div> : (
        <Tabs defaultValue="docs" className="px-4">
          <TabsList>
            <TabsTrigger value="docs" className="gap-2"><FileWarning className="h-4 w-4" />وثائق ({docs.length})</TabsTrigger>
            <TabsTrigger value="contracts" className="gap-2"><FileSignature className="h-4 w-4" />عقود ({contracts.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="docs">
            <Card>
              <CardHeader><CardTitle>وثائق مقاربة على الانتهاء (خلال 90 يوم)</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الموظف</TableHead>
                      <TableHead>نوع الوثيقة</TableHead>
                      <TableHead>الرقم</TableHead>
                      <TableHead>تاريخ الانتهاء</TableHead>
                      <TableHead>الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {docs.map((d: any) => (
                      <TableRow key={d.document_id}>
                        <TableCell className="font-medium">{d.employee_name} <span className="text-xs text-muted-foreground">({d.employee_number})</span></TableCell>
                        <TableCell>{DOC_TYPES[d.doc_type] || d.doc_type}</TableCell>
                        <TableCell className="font-mono">{d.doc_number || "-"}</TableCell>
                        <TableCell>{format(new Date(d.expiry_date), "yyyy/MM/dd")}</TableCell>
                        <TableCell>{sevBadge(d.severity, d.days_remaining)}</TableCell>
                      </TableRow>
                    ))}
                    {docs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا توجد وثائق قاربت على الانتهاء</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="contracts">
            <Card>
              <CardHeader><CardTitle>عقود مقاربة على الانتهاء</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم العقد</TableHead>
                      <TableHead>الموظف</TableHead>
                      <TableHead>تاريخ الانتهاء</TableHead>
                      <TableHead>الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts.map((c: any) => {
                      const emp = emps.find(e => e.id === c.employee_id);
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-mono">{c.contract_number}</TableCell>
                          <TableCell className="font-medium">{emp?.full_name || "-"}</TableCell>
                          <TableCell>{format(new Date(c.end_date), "yyyy/MM/dd")}</TableCell>
                          <TableCell>{sevBadge(c.days < 0 ? "expired" : c.days <= 30 ? "critical" : c.days <= 60 ? "warning" : "info", c.days)}</TableCell>
                        </TableRow>
                      );
                    })}
                    {contracts.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">لا توجد عقود قاربت على الانتهاء</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
