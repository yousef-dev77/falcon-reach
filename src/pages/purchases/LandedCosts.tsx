import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBranch } from "@/contexts/BranchContext";
import { ListPageHeader } from "@/components/ListPageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const statusLabels: Record<string, string> = { draft: "مسودة", posted: "مرحّل", cancelled: "ملغي" };
const costTypes = [
  { value: "shipping", label: "شحن" },
  { value: "customs", label: "جمارك" },
  { value: "insurance", label: "تأمين" },
  { value: "other", label: "أخرى" },
];

export default function LandedCosts() {
  const { user } = useAuth();
  const { activeBranch } = useBranch();
  const [rows, setRows] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ lc_date: new Date().toISOString().slice(0, 10), purchase_invoice_id: "", allocation_method: "by_value", notes: "" });
  const [lines, setLines] = useState<any[]>([{ cost_type: "shipping", description: "", amount: 0, expense_account_id: "", vendor_name: "" }]);

  const load = async () => {
    const [r, i, a] = await Promise.all([
      supabase.from("landed_costs").select("*, purchase_invoices(invoice_number)").order("lc_date", { ascending: false }),
      supabase.from("purchase_invoices").select("id,invoice_number,total_amount").neq("status", "draft"),
      supabase.from("accounts").select("id,code,name").eq("is_active", true).eq("allow_manual_entry", true),
    ]);
    setRows(r.data || []); setInvoices(i.data || []); setAccounts(a.data || []);
  };
  useEffect(() => { load(); }, []);

  const addLine = () => setLines([...lines, { cost_type: "shipping", description: "", amount: 0, expense_account_id: "", vendor_name: "" }]);
  const removeLine = (i: number) => setLines(lines.filter((_, x) => x !== i));
  const updateLine = (i: number, patch: any) => { const n = [...lines]; n[i] = { ...n[i], ...patch }; setLines(n); };
  const total = lines.reduce((s, l) => s + Number(l.amount || 0), 0);

  const save = async () => {
    if (!activeBranch || !form.purchase_invoice_id) return toast.error("اختر الفاتورة");
    const lc_number = `LC-${activeBranch.code}-${Date.now().toString().slice(-6)}`;
    const { data: h, error } = await supabase.from("landed_costs").insert({
      lc_number, lc_date: form.lc_date, purchase_invoice_id: form.purchase_invoice_id,
      allocation_method: form.allocation_method, total_cost: total, notes: form.notes,
      status: "draft", created_by: user!.id,
    }).select().single();
    if (error) return toast.error(error.message);
    await supabase.from("landed_cost_lines").insert(lines.map(l => ({ landed_cost_id: h.id, ...l, expense_account_id: l.expense_account_id || null })));
    toast.success("تم"); setOpen(false); setLines([{ cost_type: "shipping", description: "", amount: 0, expense_account_id: "", vendor_name: "" }]); load();
  };

  const post = async (id: string) => {
    const { error } = await supabase.rpc("post_landed_cost", { _lc_id: id });
    if (error) toast.error(error.message); else { toast.success("تم التوزيع على الأصناف"); load(); }
  };

  const filtered = rows.filter(r => !search || r.lc_number?.includes(search));

  return (
    <div className="space-y-4">
      <ListPageHeader title="التكاليف الإضافية (Landed Costs)" breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "المشتريات" }, { label: "التكاليف الإضافية" }]} searchValue={search} onSearchChange={setSearch} onAdd={() => setOpen(true)} onRefresh={load} />
      <div className="bg-card border rounded-lg">
        <Table>
          <TableHeader><TableRow><TableHead>الرقم</TableHead><TableHead>التاريخ</TableHead><TableHead>الفاتورة</TableHead><TableHead>طريقة التوزيع</TableHead><TableHead>الإجمالي</TableHead><TableHead>الحالة</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center">لا توجد تكاليف</TableCell></TableRow> :
              filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.lc_number}</TableCell>
                  <TableCell>{r.lc_date}</TableCell>
                  <TableCell>{r.purchase_invoices?.invoice_number}</TableCell>
                  <TableCell>{r.allocation_method === "by_value" ? "بالقيمة" : "بالكمية"}</TableCell>
                  <TableCell>{Number(r.total_cost).toFixed(2)}</TableCell>
                  <TableCell><Badge variant={r.status === "posted" ? "default" : "secondary"}>{statusLabels[r.status]}</Badge></TableCell>
                  <TableCell>{r.status === "draft" && <Button size="sm" onClick={() => post(r.id)}><CheckCircle className="h-4 w-4" /></Button>}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>تكلفة إضافية جديدة</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><Label>الفاتورة *</Label>
              <Select value={form.purchase_invoice_id} onValueChange={v => setForm({ ...form, purchase_invoice_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>{invoices.map(i => <SelectItem key={i.id} value={i.id}>{i.invoice_number}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>التاريخ</Label><Input type="date" value={form.lc_date} onChange={e => setForm({ ...form, lc_date: e.target.value })} /></div>
            <div><Label>طريقة التوزيع</Label>
              <Select value={form.allocation_method} onValueChange={v => setForm({ ...form, allocation_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="by_value">بالقيمة</SelectItem>
                  <SelectItem value="by_quantity">بالكمية</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-full"><Label>ملاحظات</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div className="border rounded-lg mt-3">
            <div className="flex justify-between p-3 border-b"><h3 className="font-semibold">بنود التكاليف</h3><Button size="sm" onClick={addLine}><Plus className="h-4 w-4 me-1" />إضافة</Button></div>
            <Table>
              <TableHeader><TableRow><TableHead>النوع</TableHead><TableHead>الوصف</TableHead><TableHead>المورد</TableHead><TableHead>الحساب</TableHead><TableHead>المبلغ</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {lines.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell><Select value={l.cost_type} onValueChange={v => updateLine(i, { cost_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{costTypes.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select></TableCell>
                    <TableCell><Input value={l.description} onChange={e => updateLine(i, { description: e.target.value })} /></TableCell>
                    <TableCell><Input value={l.vendor_name} onChange={e => updateLine(i, { vendor_name: e.target.value })} /></TableCell>
                    <TableCell><Select value={l.expense_account_id || "none"} onValueChange={v => updateLine(i, { expense_account_id: v === "none" ? "" : v })}><SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger><SelectContent><SelectItem value="none">بدون</SelectItem>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}</SelectContent></Select></TableCell>
                    <TableCell><Input type="number" value={l.amount} onChange={e => updateLine(i, { amount: +e.target.value })} /></TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => removeLine(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end pt-3 border-t"><div className="text-lg">إجمالي التكلفة: <b className="text-primary">{total.toFixed(2)}</b></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={save}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
