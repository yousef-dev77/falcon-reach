import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ListPageHeader } from "@/components/ListPageHeader";

export default function LeaveRequests() {
  const [data, setData] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ employee_id: "", leave_type_id: "", start_date: "", end_date: "", reason: "" });

  const fetchData = async () => {
    setLoading(true);
    const [r, e, t] = await Promise.all([
      supabase.from("hr_leave_requests").select("*, employee:hr_employees(full_name), type:hr_leave_types(name)").order("created_at", { ascending: false }),
      supabase.from("hr_employees").select("id, full_name").eq("is_active", true),
      supabase.from("hr_leave_types").select("id, name").eq("is_active", true),
    ]);
    if (r.data) setData(r.data); if (e.data) setEmployees(e.data); if (t.data) setTypes(t.data);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const calcDays = (s: string, e: string) => {
    if (!s || !e) return 0;
    return Math.max(0, Math.ceil((new Date(e).getTime() - new Date(s).getTime()) / 86400000) + 1);
  };

  const save = async () => {
    if (!form.employee_id || !form.leave_type_id || !form.start_date || !form.end_date) return toast.error("املأ كل الحقول");
    const days = calcDays(form.start_date, form.end_date);
    const { count } = await supabase.from("hr_leave_requests").select("id", { count: "exact", head: true });
    const payload = { ...form, days_count: days, request_number: `LR-${String((count || 0) + 1).padStart(5, "0")}`, status: "submitted" as const };
    const r = await supabase.from("hr_leave_requests").insert(payload);
    if (r.error) toast.error(r.error.message); else { toast.success("تم تقديم الطلب"); setOpen(false); fetchData(); setForm({ employee_id: "", leave_type_id: "", start_date: "", end_date: "", reason: "" }); }
  };

  const approve = async (id: string) => {
    const r = await supabase.from("hr_leave_requests").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", id);
    if (r.error) toast.error(r.error.message); else { toast.success("تم الاعتماد"); fetchData(); }
  };
  const reject = async (id: string) => {
    const reason = prompt("سبب الرفض؟") || "بدون سبب";
    const r = await supabase.from("hr_leave_requests").update({ status: "rejected", rejection_reason: reason }).eq("id", id);
    if (r.error) toast.error(r.error.message); else { toast.success("تم الرفض"); fetchData(); }
  };

  const statusBadge = (s: string) => {
    const map: any = { draft: ["مسودة", "secondary"], submitted: ["مقدّم", "default"], approved: ["معتمد", "default"], rejected: ["مرفوض", "destructive"], cancelled: ["ملغي", "secondary"] };
    const [label, variant] = map[s] || [s, "secondary"];
    return <Badge variant={variant as any}>{label}</Badge>;
  };

  return (
    <div>
      <ListPageHeader title="طلبات الإجازات" breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "الموارد البشرية", href: "/hr" }, { label: "طلبات الإجازات" }]} onAdd={() => setOpen(true)} onRefresh={fetchData} showSearch={false} addLabel="طلب إجازة جديد" />
      <div className="bg-card border border-t-0 rounded-b-lg p-4">
        {loading ? <Loader2 className="animate-spin mx-auto" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>الرقم</TableHead><TableHead>الموظف</TableHead><TableHead>النوع</TableHead><TableHead>من</TableHead><TableHead>إلى</TableHead><TableHead>الأيام</TableHead><TableHead>الحالة</TableHead><TableHead>السبب</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.request_number}</TableCell>
                  <TableCell>{r.employee?.full_name}</TableCell>
                  <TableCell>{r.type?.name}</TableCell>
                  <TableCell>{r.start_date}</TableCell>
                  <TableCell>{r.end_date}</TableCell>
                  <TableCell>{r.days_count}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell className="max-w-xs truncate">{r.reason}</TableCell>
                  <TableCell>
                    {r.status === "submitted" && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => approve(r.id)} className="text-green-600"><Check className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => reject(r.id)} className="text-destructive"><X className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {data.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">لا توجد طلبات</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>طلب إجازة جديد</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>الموظف *</Label>
              <Select value={form.employee_id} onValueChange={v => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر موظف" /></SelectTrigger>
                <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>نوع الإجازة *</Label>
              <Select value={form.leave_type_id} onValueChange={v => setForm({ ...form, leave_type_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر نوع" /></SelectTrigger>
                <SelectContent>{types.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>من *</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><Label>إلى *</Label><Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div className="text-sm text-muted-foreground">عدد الأيام: <strong>{calcDays(form.start_date, form.end_date)}</strong></div>
            <div><Label>السبب</Label><Textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></div>
            <div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={save}>تقديم الطلب</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
