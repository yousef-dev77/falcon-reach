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

const statusLabels: Record<string, string> = { draft: "مسودة", confirmed: "مؤكد", partially_delivered: "تسليم جزئي", delivered: "مُسلَّم", cancelled: "ملغي", closed: "مغلق" };

export default function SalesOrders() {
  const { user } = useAuth();
  const { activeBranch } = useBranch();
  const [rows, setRows] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [taxes, setTaxes] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ order_date: new Date().toISOString().slice(0, 10), delivery_date: "", customer_id: "", warehouse_id: "", quotation_id: "", notes: "" });
  const [lines, setLines] = useState<any[]>([{ product_id: "", quantity: 1, unit_price: 0, tax_id: null, tax_percent: 0, line_total: 0 }]);

  const load = async () => {
    const [r, c, p, w, t, q] = await Promise.all([
      supabase.from("sales_orders").select("*, customers(name)").order("order_date", { ascending: false }),
      supabase.from("customers").select("id,name").eq("is_active", true),
      supabase.from("products").select("id,name,selling_price").eq("is_active", true),
      supabase.from("warehouses").select("id,name").eq("is_active", true),
      supabase.from("taxes").select("id,name,rate").eq("is_active", true),
      supabase.from("quotations").select("id,quotation_number,customer_id").eq("status", "accepted"),
    ]);
    setRows(r.data || []); setCustomers(c.data || []); setProducts(p.data || []); setWarehouses(w.data || []); setTaxes(t.data || []); setQuotations(q.data || []);
  };
  useEffect(() => { load(); }, []);

  const loadFromQuotation = async (qid: string) => {
    const q = quotations.find(x => x.id === qid);
    if (!q) return;
    const { data } = await supabase.from("quotation_lines").select("*").eq("quotation_id", qid);
    setForm(f => ({ ...f, quotation_id: qid, customer_id: q.customer_id }));
    setLines((data || []).map(l => ({ product_id: l.product_id, quantity: Number(l.quantity), unit_price: Number(l.unit_price), tax_id: l.tax_id, tax_percent: Number(l.tax_percent), line_total: Number(l.line_total) })));
  };

  const addLine = () => setLines([...lines, { product_id: "", quantity: 1, unit_price: 0, tax_id: null, tax_percent: 0, line_total: 0 }]);
  const removeLine = (i: number) => setLines(lines.filter((_, x) => x !== i));
  const updateLine = (i: number, patch: any) => { const n = [...lines]; n[i] = { ...n[i], ...patch }; n[i].line_total = n[i].quantity * n[i].unit_price; setLines(n); };
  const subtotal = lines.reduce((s, l) => s + l.line_total, 0);
  const taxAmount = lines.reduce((s, l) => s + (l.line_total * l.tax_percent / 100), 0);
  const total = subtotal + taxAmount;

  const save = async () => {
    if (!activeBranch || !form.customer_id) return toast.error("بيانات ناقصة");
    const order_number = `SO-${activeBranch.code}-${Date.now().toString().slice(-6)}`;
    const { data: h, error } = await supabase.from("sales_orders").insert({
      order_number, order_date: form.order_date, delivery_date: form.delivery_date || null,
      customer_id: form.customer_id, quotation_id: form.quotation_id || null,
      branch_id: activeBranch.id, warehouse_id: form.warehouse_id || null,
      subtotal, tax_amount: taxAmount, total_amount: total, notes: form.notes,
      status: "draft", created_by: user!.id,
    }).select().single();
    if (error) return toast.error(error.message);
    await supabase.from("sales_order_lines").insert(lines.map(l => ({ order_id: h.id, ...l })));
    toast.success("تم"); setOpen(false); setLines([{ product_id: "", quantity: 1, unit_price: 0, tax_id: null, tax_percent: 0, line_total: 0 }]); load();
  };

  const confirm = async (id: string) => {
    await supabase.from("sales_orders").update({ status: "confirmed", confirmed_by: user!.id, confirmed_at: new Date().toISOString() }).eq("id", id);
    toast.success("تم تأكيد الأمر"); load();
  };

  const filtered = rows.filter(r => !search || r.order_number?.includes(search) || r.customers?.name?.includes(search));

  return (
    <div className="space-y-4">
      <ListPageHeader title="أوامر البيع" breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "المبيعات" }, { label: "أوامر البيع" }]} searchValue={search} onSearchChange={setSearch} onAdd={() => setOpen(true)} onRefresh={load} />
      <div className="bg-card border rounded-lg">
        <Table>
          <TableHeader><TableRow><TableHead>الرقم</TableHead><TableHead>التاريخ</TableHead><TableHead>العميل</TableHead><TableHead>الإجمالي</TableHead><TableHead>الحالة</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center">لا توجد أوامر</TableCell></TableRow> :
              filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.order_number}</TableCell>
                  <TableCell>{r.order_date}</TableCell>
                  <TableCell>{r.customers?.name}</TableCell>
                  <TableCell>{Number(r.total_amount).toFixed(2)}</TableCell>
                  <TableCell><Badge>{statusLabels[r.status]}</Badge></TableCell>
                  <TableCell>{r.status === "draft" && <Button size="sm" onClick={() => confirm(r.id)}><CheckCircle className="h-4 w-4" /></Button>}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>أمر بيع جديد</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><Label>عرض السعر (اختياري)</Label>
              <Select value={form.quotation_id} onValueChange={loadFromQuotation}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>{quotations.map(q => <SelectItem key={q.id} value={q.id}>{q.quotation_number}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>العميل *</Label>
              <Select value={form.customer_id} onValueChange={v => setForm({ ...form, customer_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>التاريخ</Label><Input type="date" value={form.order_date} onChange={e => setForm({ ...form, order_date: e.target.value })} /></div>
            <div><Label>تاريخ التسليم</Label><Input type="date" value={form.delivery_date} onChange={e => setForm({ ...form, delivery_date: e.target.value })} /></div>
            <div><Label>المستودع</Label>
              <Select value={form.warehouse_id} onValueChange={v => setForm({ ...form, warehouse_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="border rounded-lg mt-3">
            <div className="flex justify-between p-3 border-b"><h3 className="font-semibold">البنود</h3><Button size="sm" onClick={addLine}><Plus className="h-4 w-4 me-1" />إضافة</Button></div>
            <Table>
              <TableHeader><TableRow><TableHead>الصنف</TableHead><TableHead>الكمية</TableHead><TableHead>السعر</TableHead><TableHead>الضريبة</TableHead><TableHead>الإجمالي</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {lines.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell><Select value={l.product_id} onValueChange={v => { const p = products.find(x => x.id === v); updateLine(i, { product_id: v, unit_price: Number(p?.selling_price) || 0 }); }}><SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger><SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></TableCell>
                    <TableCell><Input type="number" value={l.quantity} onChange={e => updateLine(i, { quantity: +e.target.value })} /></TableCell>
                    <TableCell><Input type="number" value={l.unit_price} onChange={e => updateLine(i, { unit_price: +e.target.value })} /></TableCell>
                    <TableCell><Select value={l.tax_id || "none"} onValueChange={v => { if (v === "none") return updateLine(i, { tax_id: null, tax_percent: 0 }); const t = taxes.find(x => x.id === v); updateLine(i, { tax_id: v, tax_percent: Number(t?.rate) || 0 }); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">بدون</SelectItem>{taxes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></TableCell>
                    <TableCell>{l.line_total.toFixed(2)}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => removeLine(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end gap-6 pt-3 border-t">
            <div>المجموع: <b>{subtotal.toFixed(2)}</b></div>
            <div>الضريبة: <b>{taxAmount.toFixed(2)}</b></div>
            <div className="text-lg">الإجمالي: <b className="text-primary">{total.toFixed(2)}</b></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={save}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
