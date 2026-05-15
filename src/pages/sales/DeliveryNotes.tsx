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

export default function DeliveryNotes() {
  const { user } = useAuth();
  const { activeBranch } = useBranch();
  const [rows, setRows] = useState<any[]>([]);
  const [sos, setSos] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ delivery_date: new Date().toISOString().slice(0, 10), customer_id: "", sales_order_id: "", warehouse_id: "", reference: "", notes: "" });
  const [lines, setLines] = useState<any[]>([]);

  const load = async () => {
    const [r, c, p, w, so] = await Promise.all([
      supabase.from("delivery_notes").select("*, customers(name)").order("delivery_date", { ascending: false }),
      supabase.from("customers").select("id,name").eq("is_active", true),
      supabase.from("products").select("id,name,cost_price").eq("is_active", true),
      supabase.from("warehouses").select("id,name").eq("is_active", true),
      supabase.from("sales_orders").select("id,order_number,customer_id,warehouse_id").in("status", ["confirmed", "partially_delivered"]),
    ]);
    setRows(r.data || []); setCustomers(c.data || []); setProducts(p.data || []); setWarehouses(w.data || []); setSos(so.data || []);
  };
  useEffect(() => { load(); }, []);

  const loadFromSO = async (soId: string) => {
    const so = sos.find(x => x.id === soId);
    if (!so) return;
    const { data } = await supabase.from("sales_order_lines").select("*").eq("order_id", soId);
    setForm(f => ({ ...f, sales_order_id: soId, customer_id: so.customer_id, warehouse_id: so.warehouse_id || "" }));
    setLines((data || []).map(l => {
      const remaining = Number(l.quantity) - Number(l.delivered_quantity);
      return { so_line_id: l.id, product_id: l.product_id, quantity: remaining, unit_cost: 0, line_total: 0 };
    }).filter(l => l.quantity > 0));
  };

  const addLine = () => setLines([...lines, { so_line_id: null, product_id: "", quantity: 1, unit_cost: 0, line_total: 0 }]);
  const removeLine = (i: number) => setLines(lines.filter((_, x) => x !== i));
  const updateLine = (i: number, patch: any) => { const n = [...lines]; n[i] = { ...n[i], ...patch }; n[i].line_total = n[i].quantity * n[i].unit_cost; setLines(n); };
  const total = lines.reduce((s, l) => s + l.line_total, 0);

  const save = async () => {
    if (!activeBranch || !form.customer_id || !form.warehouse_id) return toast.error("بيانات ناقصة");
    const dn_number = `DN-${activeBranch.code}-${Date.now().toString().slice(-6)}`;
    const { data: h, error } = await supabase.from("delivery_notes").insert({
      dn_number, delivery_date: form.delivery_date, customer_id: form.customer_id,
      sales_order_id: form.sales_order_id || null, branch_id: activeBranch.id,
      warehouse_id: form.warehouse_id, reference: form.reference, notes: form.notes,
      total_value: total, status: "draft", created_by: user!.id,
    }).select().single();
    if (error) return toast.error(error.message);
    await supabase.from("delivery_note_lines").insert(lines.map(l => ({ dn_id: h.id, ...l })));
    toast.success("تم"); setOpen(false); setLines([]); load();
  };

  const post = async (id: string) => {
    const { error } = await supabase.rpc("post_delivery_note", { _dn_id: id });
    if (error) toast.error(error.message); else { toast.success("تم الترحيل وخصم المخزون"); load(); }
  };

  const filtered = rows.filter(r => !search || r.dn_number?.includes(search));

  return (
    <div className="space-y-4">
      <ListPageHeader title="إذونات التسليم" breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "المبيعات" }, { label: "إذونات التسليم" }]} searchValue={search} onSearchChange={setSearch} onAdd={() => setOpen(true)} onRefresh={load} />
      <div className="bg-card border rounded-lg">
        <Table>
          <TableHeader><TableRow><TableHead>الرقم</TableHead><TableHead>التاريخ</TableHead><TableHead>العميل</TableHead><TableHead>القيمة</TableHead><TableHead>الحالة</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center">لا توجد إذونات</TableCell></TableRow> :
              filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.dn_number}</TableCell>
                  <TableCell>{r.delivery_date}</TableCell>
                  <TableCell>{r.customers?.name}</TableCell>
                  <TableCell>{Number(r.total_value).toFixed(2)}</TableCell>
                  <TableCell><Badge variant={r.status === "posted" ? "default" : "secondary"}>{statusLabels[r.status]}</Badge></TableCell>
                  <TableCell>{r.status === "draft" && <Button size="sm" onClick={() => post(r.id)}><CheckCircle className="h-4 w-4" /></Button>}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>إذن تسليم جديد</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><Label>أمر البيع (اختياري)</Label>
              <Select value={form.sales_order_id} onValueChange={loadFromSO}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>{sos.map(s => <SelectItem key={s.id} value={s.id}>{s.order_number}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>العميل *</Label>
              <Select value={form.customer_id} onValueChange={v => setForm({ ...form, customer_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>التاريخ</Label><Input type="date" value={form.delivery_date} onChange={e => setForm({ ...form, delivery_date: e.target.value })} /></div>
            <div><Label>المستودع *</Label>
              <Select value={form.warehouse_id} onValueChange={v => setForm({ ...form, warehouse_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="border rounded-lg mt-3">
            <div className="flex justify-between p-3 border-b"><h3 className="font-semibold">البنود</h3><Button size="sm" onClick={addLine}><Plus className="h-4 w-4 me-1" />إضافة</Button></div>
            <Table>
              <TableHeader><TableRow><TableHead>الصنف</TableHead><TableHead>الكمية</TableHead><TableHead>التكلفة</TableHead><TableHead>الإجمالي</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {lines.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell><Select value={l.product_id} onValueChange={v => { const p = products.find(x => x.id === v); updateLine(i, { product_id: v, unit_cost: Number(p?.cost_price) || 0 }); }}><SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger><SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></TableCell>
                    <TableCell><Input type="number" value={l.quantity} onChange={e => updateLine(i, { quantity: +e.target.value })} /></TableCell>
                    <TableCell><Input type="number" value={l.unit_cost} onChange={e => updateLine(i, { unit_cost: +e.target.value })} /></TableCell>
                    <TableCell>{l.line_total.toFixed(2)}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => removeLine(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end pt-3 border-t"><div className="text-lg">الإجمالي: <b className="text-primary">{total.toFixed(2)}</b></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={save}>حفظ كمسودة</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
