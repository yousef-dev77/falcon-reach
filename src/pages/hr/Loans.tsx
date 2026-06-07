import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Edit, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ListPageHeader } from "@/components/ListPageHeader";

export default function Loans() {
  const [data, setData] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const empty = { employee_id: "", total_amount: 0, installment_amount: 0, start_date: new Date().toISOString().slice(0, 10), reason: "" };
  const [form, setForm] = useState<any>(empty);

  const fetchData = async () => {
    setLoading(true);
    const [l, e] = await Promise.all([
      supabase.from("hr_loans").select("*, employee:hr_employees(full_name)").order("created_at", { ascending: false }),
      supabase.from("hr_employees").select("id, full_name").eq("is_active", true),
    ]);
    if (l.data) setData(l.data); if (e.data) setEmployees(e.data);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const save = async () => {
    if (!form.employee_id || !form.total_amount) return toast.error("املأ كل الحقول");
    const { count } = await supabase.from("hr_loans").select("id", { count: "exact", head: true });
    const payload = {
      ...form,
      total_amount: Number(form.total_amount),
      installment_amount: Number(form.installment_amount),
      remaining_amount: Number(form.total_amount),
      loan_number: `LOAN-${String((count || 0) + 1).padStart(5, "0")}`,
      status: "draft",
    };
    const r = await supabase.from("hr_loans").insert(payload);
    if (r.error) toast.error(r.error.message); else { toast.success("تم"); setOpen(false); fetchData(); setForm(empty); }
  };

  const activate = async (id: string) => {
    const r = await supabase.from("hr_loans").update({ status: "active", approved_at: new Date().toISOString() }).eq("id", id);
    if (r.error) toast.error(r.error.message); else { toast.success("تم تفعيل السلفة"); fetchData(); }
  };

  const statusBadge = (s: string) => {
    const m: any = { draft: ["مسودة", "secondary"], active: ["نشط", "default"], completed: ["مكتمل", "outline"], cancelled: ["ملغي", "destructive"] };
    const [l, v] = m[s] || [s, "secondary"];
    return <Badge variant={v as any}>{l}</Badge>;
  };

  return (
    <div>
      <ListPageHeader title="سلف الموظفين" breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "الموارد البشرية", href: "/hr" }, { label: "السلف" }]} onAdd={() => setOpen(true)} onRefresh={fetchData} showSearch={false} />
      <div className="bg-card border border-t-0 rounded-b-lg p-4">
        {loading ? <Loader2 className="animate-spin mx-auto" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>الرقم</TableHead><TableHead>الموظف</TableHead><TableHead>المبلغ</TableHead><TableHead>القسط</TableHead><TableHead>المسدد</TableHead><TableHead>المتبقي</TableHead><TableHead>الحالة</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.loan_number}</TableCell>
                  <TableCell>{r.employee?.full_name}</TableCell>
                  <TableCell>{Number(r.total_amount).toLocaleString()} ر.س</TableCell>
                  <TableCell>{Number(r.installment_amount).toLocaleString()}</TableCell>
                  <TableCell>{Number(r.paid_amount).toLocaleString()}</TableCell>
                  <TableCell className="font-bold">{Number(r.remaining_amount).toLocaleString()}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell>{r.status === "draft" && <Button variant="ghost" size="sm" onClick={() => activate(r.id)} className="text-green-600"><Check className="h-4 w-4 me-1" />اعتماد</Button>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>سلفة جديدة</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>الموظف *</Label>
              <Select value={form.employee_id} onValueChange={v => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>إجمالي مبلغ السلفة *</Label><Input type="number" value={form.total_amount} onChange={e => setForm({ ...form, total_amount: e.target.value })} /></div>
            <div><Label>قسط شهري *</Label><Input type="number" value={form.installment_amount} onChange={e => setForm({ ...form, installment_amount: e.target.value })} /></div>
            <div><Label>تاريخ البدء</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><Label>السبب</Label><Textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></div>
            <div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={save}>حفظ</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
