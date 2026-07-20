import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Check, X, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ListPageHeader } from "@/components/ListPageHeader";
import { LoanScheduleDialog } from "@/components/hr/LoanScheduleDialog";

export default function SalaryAdvances() {
  const [data, setData] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [scheduleFor, setScheduleFor] = useState<any>(null);
  const empty = { employee_id: "", total_amount: 0, months_count: 1, start_date: new Date().toISOString().slice(0, 10), reason: "", disbursement_account_id: "" };
  const [form, setForm] = useState<any>(empty);

  const fetchData = async () => {
    setLoading(true);
    const [l, e, banks, cash] = await Promise.all([
      (supabase.from("hr_loans") as any).select("*, employee:hr_employees(full_name)").eq("loan_type", "advance").order("created_at", { ascending: false }),
      supabase.from("hr_employees").select("id, full_name, basic_salary").eq("is_active", true),
      supabase.from("bank_accounts").select("id, name").eq("is_active", true),
      supabase.from("cash_boxes").select("id, name").eq("is_active", true),
    ]);
    if (l.data) setData(l.data); if (e.data) setEmployees(e.data);
    setAccounts([...(banks.data || []).map((b:any)=>({...b, kind:"بنك"})), ...(cash.data || []).map((c:any)=>({...c, kind:"صندوق"}))]);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const save = async () => {
    if (!form.employee_id || !form.total_amount || !form.months_count) return toast.error("املأ كل الحقول");
    const months = Math.max(1, Number(form.months_count));
    const total = Number(form.total_amount);
    const installment = Math.round((total / months) * 100) / 100;
    const { count } = await supabase.from("hr_loans").select("id", { count: "exact", head: true });
    const payload: any = {
      employee_id: form.employee_id,
      total_amount: total,
      installment_amount: installment,
      months_count: months,
      remaining_amount: total,
      start_date: form.start_date,
      reason: form.reason,
      loan_type: "advance",
      loan_number: `ADV-${String((count || 0) + 1).padStart(5, "0")}`,
      status: "draft",
      disbursement_account_id: form.disbursement_account_id || null,
    };
    const r = await (supabase.from("hr_loans") as any).insert(payload);
    if (r.error) toast.error(r.error.message); else { toast.success("تم"); setOpen(false); fetchData(); setForm(empty); }
  };

  const approve = async (id: string) => {
    const r = await (supabase as any).rpc("approve_loan", { _loan_id: id });
    if (r.error) toast.error(r.error.message); else { toast.success("تم اعتماد السلفة وإنشاء جدول السداد"); fetchData(); }
  };
  const reject = async (id: string) => {
    const reason = prompt("سبب الرفض؟") || "";
    const r = await (supabase as any).rpc("reject_loan", { _loan_id: id, _reason: reason });
    if (r.error) toast.error(r.error.message); else { toast.success("تم الرفض"); fetchData(); }
  };

  const statusBadge = (s: string) => {
    const m: any = { draft: ["مسودة", "secondary"], pending_approval: ["بانتظار الاعتماد", "outline"], active: ["نشطة", "default"], completed: ["مكتملة", "outline"], cancelled: ["ملغاة/مرفوضة", "destructive"] };
    const [l, v] = m[s] || [s, "secondary"];
    return <Badge variant={v as any}>{l}</Badge>;
  };

  return (
    <div>
      <ListPageHeader title="سلف الرواتب" breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "الموارد البشرية", href: "/hr" }, { label: "سلف الرواتب" }]} onAdd={() => setOpen(true)} onRefresh={fetchData} showSearch={false} />
      <div className="bg-card border border-t-0 rounded-b-lg p-4">
        <p className="text-xs text-muted-foreground mb-3">سلفة قصيرة الأجل تُخصم من راتب الشهر أو على أشهر قليلة. لا تحتاج موافقة إدارية رسمية — يعتمدها المحاسب مباشرة.</p>
        {loading ? <Loader2 className="animate-spin mx-auto" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>الرقم</TableHead><TableHead>الموظف</TableHead><TableHead>المبلغ</TableHead><TableHead>الأشهر</TableHead><TableHead>القسط</TableHead><TableHead>المسدد</TableHead><TableHead>المتبقي</TableHead><TableHead>الحالة</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.loan_number}</TableCell>
                  <TableCell>{r.employee?.full_name}</TableCell>
                  <TableCell>{Number(r.total_amount).toLocaleString()} ر.س</TableCell>
                  <TableCell>{r.months_count || "—"}</TableCell>
                  <TableCell>{Number(r.installment_amount).toLocaleString()}</TableCell>
                  <TableCell>{Number(r.paid_amount).toLocaleString()}</TableCell>
                  <TableCell className="font-bold">{Number(r.remaining_amount).toLocaleString()}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell className="flex gap-1">
                    {r.status === "draft" && <>
                      <Button variant="ghost" size="sm" onClick={() => approve(r.id)} className="text-green-600"><Check className="h-4 w-4 me-1" />اعتماد</Button>
                      <Button variant="ghost" size="sm" onClick={() => reject(r.id)} className="text-destructive"><X className="h-4 w-4" /></Button>
                    </>}
                    {r.status !== "draft" && <Button variant="ghost" size="sm" onClick={() => setScheduleFor(r)}><Eye className="h-4 w-4 me-1" />الجدول</Button>}
                  </TableCell>
                </TableRow>
              ))}
              {data.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-4">لا توجد سلف</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>سلفة راتب جديدة</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>الموظف *</Label>
              <Select value={form.employee_id} onValueChange={v => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>مبلغ السلفة *</Label><Input type="number" value={form.total_amount} onChange={e => setForm({ ...form, total_amount: e.target.value })} /></div>
            <div><Label>عدد أشهر الخصم *</Label><Input type="number" min={1} max={6} value={form.months_count} onChange={e => setForm({ ...form, months_count: e.target.value })} /><p className="text-xs text-muted-foreground mt-1">السلفة عادةً 1–6 أشهر. القسط = المبلغ ÷ الأشهر.</p></div>
            <div><Label>تاريخ البدء</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><Label>حساب الصرف (بنك/صندوق) *</Label>
              <Select value={form.disbursement_account_id} onValueChange={v => setForm({ ...form, disbursement_account_id: v })}>
                <SelectTrigger><SelectValue placeholder="من أين تُصرف السلفة؟" /></SelectTrigger>
                <SelectContent>{accounts.map((a:any) => <SelectItem key={a.id} value={a.id}>{a.kind}: {a.name}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">عند الاعتماد يُنشأ قيد: مدين ذمم السلف / دائن هذا الحساب.</p>
            </div>
            <div><Label>السبب</Label><Textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></div>
            <div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={save}>حفظ (مسودة)</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <LoanScheduleDialog loan={scheduleFor} onClose={() => setScheduleFor(null)} />
    </div>
  );
}
