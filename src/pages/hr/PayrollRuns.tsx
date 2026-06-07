import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calculator, FileCheck, Eye, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ListPageHeader } from "@/components/ListPageHeader";
import { useNavigate } from "react-router-dom";

export default function PayrollRuns() {
  const navigate = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const now = new Date();
  const [form, setForm] = useState({ year: now.getFullYear(), month: now.getMonth() + 1, branch_id: "" });

  const fetchData = async () => {
    setLoading(true);
    const [r, b] = await Promise.all([
      supabase.from("hr_payroll_runs").select("*, branch:branches(name)").order("year", { ascending: false }).order("month", { ascending: false }),
      supabase.from("branches").select("id, name").eq("is_active", true),
    ]);
    if (r.data) setData(r.data); if (b.data) setBranches(b.data);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const create = async () => {
    const { year, month, branch_id } = form;
    const start = new Date(year, month - 1, 1).toISOString().slice(0, 10);
    const end = new Date(year, month, 0).toISOString().slice(0, 10);
    const { count } = await supabase.from("hr_payroll_runs").select("id", { count: "exact", head: true });
    const payload = {
      run_number: `PAY-${year}${String(month).padStart(2, "0")}-${String((count || 0) + 1).padStart(3, "0")}`,
      year, month, period_start: start, period_end: end,
      branch_id: branch_id || null, status: "draft" as const,
    };
    const r = await supabase.from("hr_payroll_runs").insert(payload);
    if (r.error) toast.error(r.error.message); else { toast.success("تم إنشاء تشغيل الرواتب"); setOpen(false); fetchData(); }
  };

  const calculate = async (id: string) => {
    setProcessing(id);
    const r = await supabase.rpc("calculate_payroll", { _run_id: id });
    if (r.error) toast.error(r.error.message); else toast.success(`تم حساب ${r.data} موظف`);
    setProcessing(null); fetchData();
  };

  const post = async (id: string) => {
    if (!confirm("ترحيل الرواتب يولّد قيد محاسبي ولا يمكن التراجع. متابعة؟")) return;
    setProcessing(id);
    const r = await supabase.rpc("post_payroll_run", { _run_id: id });
    if (r.error) toast.error(r.error.message); else toast.success("تم الترحيل وإنشاء القيد المحاسبي");
    setProcessing(null); fetchData();
  };

  const statusBadge = (s: string) => {
    const m: any = { draft: ["مسودة", "secondary"], calculated: ["محسوب", "default"], posted: ["مرحّل", "default"], cancelled: ["ملغي", "destructive"] };
    const [l, v] = m[s] || [s, "secondary"];
    return <Badge variant={v as any}>{l}</Badge>;
  };

  return (
    <div>
      <ListPageHeader title="تشغيل الرواتب" breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "الموارد البشرية", href: "/hr" }, { label: "الرواتب" }]} onAdd={() => setOpen(true)} onRefresh={fetchData} showSearch={false} addLabel="تشغيل رواتب جديد" />
      <div className="bg-card border border-t-0 rounded-b-lg p-4">
        {loading ? <Loader2 className="animate-spin mx-auto" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>الرقم</TableHead><TableHead>الفترة</TableHead><TableHead>الفرع</TableHead><TableHead>الموظفين</TableHead><TableHead>الإجمالي</TableHead><TableHead>الصافي</TableHead><TableHead>الحالة</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.run_number}</TableCell>
                  <TableCell>{r.month}/{r.year}</TableCell>
                  <TableCell>{r.branch?.name || "كل الفروع"}</TableCell>
                  <TableCell>{r.employees_count}</TableCell>
                  <TableCell>{Number(r.total_gross).toLocaleString()} ر.س</TableCell>
                  <TableCell className="font-bold">{Number(r.total_net).toLocaleString()} ر.س</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/hr/payroll/${r.id}`)}><Eye className="h-4 w-4" /></Button>
                      {r.status === "draft" && <Button variant="ghost" size="sm" onClick={() => calculate(r.id)} disabled={processing === r.id}>{processing === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4 me-1" />}حساب</Button>}
                      {r.status === "calculated" && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => calculate(r.id)}><Calculator className="h-4 w-4 me-1" />إعادة حساب</Button>
                          <Button variant="default" size="sm" onClick={() => post(r.id)} disabled={processing === r.id}><FileCheck className="h-4 w-4 me-1" />ترحيل</Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {data.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">لا توجد تشغيلات</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>تشغيل رواتب جديد</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>السنة</Label><Input type="number" value={form.year} onChange={e => setForm({ ...form, year: Number(e.target.value) })} /></div>
              <div><Label>الشهر</Label>
                <Select value={String(form.month)} onValueChange={v => setForm({ ...form, month: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Array.from({ length: 12 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>الفرع</Label>
              <Select value={form.branch_id || "all"} onValueChange={v => setForm({ ...form, branch_id: v === "all" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">كل الفروع</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={create}>إنشاء</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
