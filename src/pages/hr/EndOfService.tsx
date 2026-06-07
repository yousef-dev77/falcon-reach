import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calculator, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ListPageHeader } from "@/components/ListPageHeader";

export default function EndOfService() {
  const [data, setData] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ employee_id: "", end_date: new Date().toISOString().slice(0, 10), end_reason: "", eosb_amount: 0, vacation_balance_amount: 0, other_dues: 0, deductions: 0 });

  const fetchData = async () => {
    setLoading(true);
    const [e, em] = await Promise.all([
      supabase.from("hr_end_of_service").select("*, employee:hr_employees(full_name, hire_date, basic_salary)").order("created_at", { ascending: false }),
      supabase.from("hr_employees").select("id, full_name, hire_date, basic_salary").eq("is_active", true),
    ]);
    if (e.data) setData(e.data); if (em.data) setEmployees(em.data);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const calcEosb = async () => {
    if (!form.employee_id || !form.end_date) return toast.error("اختر الموظف والتاريخ");
    const r = await supabase.rpc("calculate_eosb", { _employee_id: form.employee_id, _end_date: form.end_date });
    if (r.error) toast.error(r.error.message); else { setForm({ ...form, eosb_amount: r.data }); toast.success(`المكافأة المحسوبة: ${r.data} ر.س`); }
  };

  const save = async () => {
    if (!form.employee_id) return toast.error("اختر الموظف");
    const emp = employees.find(e => e.id === form.employee_id);
    const years = emp ? ((new Date(form.end_date).getTime() - new Date(emp.hire_date).getTime()) / (365.25 * 86400000)) : 0;
    const net = Number(form.eosb_amount) + Number(form.vacation_balance_amount) + Number(form.other_dues) - Number(form.deductions);
    const { count } = await supabase.from("hr_end_of_service").select("id", { count: "exact", head: true });
    const payload = {
      ...form,
      document_number: `EOS-${String((count || 0) + 1).padStart(5, "0")}`,
      years_of_service: Number(years.toFixed(2)),
      last_basic_salary: emp?.basic_salary || 0,
      eosb_amount: Number(form.eosb_amount),
      vacation_balance_amount: Number(form.vacation_balance_amount),
      other_dues: Number(form.other_dues),
      deductions: Number(form.deductions),
      net_amount: net,
      status: "draft",
    };
    const r = await supabase.from("hr_end_of_service").insert(payload);
    if (r.error) toast.error(r.error.message); else { toast.success("تم"); setOpen(false); fetchData(); setForm({ employee_id: "", end_date: new Date().toISOString().slice(0, 10), end_reason: "", eosb_amount: 0, vacation_balance_amount: 0, other_dues: 0, deductions: 0 }); }
  };

  return (
    <div>
      <ListPageHeader title="نهاية الخدمة" breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "الموارد البشرية", href: "/hr" }, { label: "نهاية الخدمة" }]} onAdd={() => setOpen(true)} onRefresh={fetchData} showSearch={false} addLabel="حساب مكافأة جديدة" />
      <div className="bg-card border border-t-0 rounded-b-lg p-4">
        {loading ? <Loader2 className="animate-spin mx-auto" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>الرقم</TableHead><TableHead>الموظف</TableHead><TableHead>تاريخ الانتهاء</TableHead><TableHead>سنوات الخدمة</TableHead><TableHead>المكافأة</TableHead><TableHead>الصافي</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.document_number}</TableCell>
                  <TableCell>{r.employee?.full_name}</TableCell>
                  <TableCell>{r.end_date}</TableCell>
                  <TableCell>{Number(r.years_of_service).toFixed(2)}</TableCell>
                  <TableCell>{Number(r.eosb_amount).toLocaleString()} ر.س</TableCell>
                  <TableCell className="font-bold text-green-600">{Number(r.net_amount).toLocaleString()} ر.س</TableCell>
                  <TableCell><Badge>{r.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>حساب مكافأة نهاية الخدمة</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>الموظف *</Label>
              <Select value={form.employee_id} onValueChange={v => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>تاريخ نهاية الخدمة</Label><Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
            <div><Label>سبب نهاية الخدمة</Label><Input value={form.end_reason} onChange={e => setForm({ ...form, end_reason: e.target.value })} placeholder="استقالة / فصل / تقاعد..." /></div>
            <Button onClick={calcEosb} variant="outline" className="w-full"><Calculator className="h-4 w-4 me-2" />احسب المكافأة وفق نظام العمل</Button>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>مكافأة نهاية الخدمة</Label><Input type="number" value={form.eosb_amount} onChange={e => setForm({ ...form, eosb_amount: e.target.value })} /></div>
              <div><Label>رصيد الإجازات</Label><Input type="number" value={form.vacation_balance_amount} onChange={e => setForm({ ...form, vacation_balance_amount: e.target.value })} /></div>
              <div><Label>مستحقات أخرى</Label><Input type="number" value={form.other_dues} onChange={e => setForm({ ...form, other_dues: e.target.value })} /></div>
              <div><Label>خصومات</Label><Input type="number" value={form.deductions} onChange={e => setForm({ ...form, deductions: e.target.value })} /></div>
            </div>
            <div className="bg-muted p-3 rounded text-center">
              <div className="text-sm">الصافي</div>
              <div className="text-2xl font-bold text-green-600">{(Number(form.eosb_amount) + Number(form.vacation_balance_amount) + Number(form.other_dues) - Number(form.deductions)).toLocaleString()} ر.س</div>
            </div>
            <div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={save}>حفظ</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
