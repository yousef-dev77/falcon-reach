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

export default function GoodsReceipts() {
  const { user } = useAuth();
  const { activeBranch } = useBranch();
  const [rows, setRows] = useState<any[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [poLines, setPoLines] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ receipt_date: new Date().toISOString().slice(0, 10), supplier_id: "", purchase_order_id: "", warehouse_id: "", reference: "", notes: "" });
  const [lines, setLines] = useState<any[]>([]);

  const load = async () => {
    const [r, s, p, w, po] = await Promise.all([
      supabase.from("goods_receipts").select("*, suppliers(name)").order("receipt_date", { ascending: false }),
      supabase.from("suppliers").select("id,name").eq("is_active", true),
      supabase.from("products").select("id,name,cost_price").eq("is_active", true),
      supabase.from("warehouses").select("id,name").eq("is_active", true),
      supabase.from("purchase_orders").select("id,order_number,supplier_id,warehouse_id").in("status", ["confirmed", "partially_received"]),
    ]);
    setRows(r.data || []); setSuppliers(s.data || []); setProducts(p.data || []); setWarehouses(w.data || []); setPos(po.data || []);
  };
  useEffect(() => { load(); }, []);

  const loadFromPO = async (poId: string) => {
    const po = pos.find(x => x.id === poId);
    if (!po) return;
    const { data } = await supabase.from("purchase_order_lines").select("*").eq("order_id", poId);
    setPoLines(data || []);
    setForm(f => ({ ...f, purchase_order_id: poId, supplier_id: po.supplier_id, warehouse_id: po.warehouse_id || "" }));
    setLines((data || []).map(l => ({ po_line_id: l.id, product_id: l.product_id, quantity: Number(l.quantity) - Number(l.received_quantity), unit_cost: Number(l.unit_price), line_total: 0 })).filter(l => l.quantity > 0).map(l => ({ ...l, line_total: l.quantity * l.unit_cost })));
  };

  const addLine = () => setLines([...lines, { po_line_id: null, product_id: "", quantity: 1, unit_cost: 0, line_total: 0 }]);
  const removeLine = (i: number) => setLines(lines.filter((_, x) => x !== i));
  const updateLine = (i: number, patch: any) => { const n = [...lines]; n[i] = { ...n[i], ...patch }; n[i].line_total = n[i].quantity * n[i].unit_cost; setLines(n); };
  const total = lines.reduce((s, l) => s + l.line_total, 0);

  const save = async () => {
    if (!activeBranch || !form.supplier_id || !form.warehouse_id) return toast.error("بيانات ناقصة");
    const grn_number = `GRN-${activeBranch.code}-${Date.now().toString().slice(-6)}`;
    const { data: h, error } = await supabase.from("goods_receipts").insert({
      grn_number, receipt_date: form.receipt_date, supplier_id: form.supplier_id,
      purchase_order_id: form.purchase_order_id || null, branch_id: activeBranch.id,
      warehouse_id: form.warehouse_id, reference: form.reference, notes: form.notes,
      total_value: total, status: "draft", created_by: user!.id,
    }).select().single();
    if (error) return toast.error(error.message);
    await supabase.from("goods_receipt_lines").insert(lines.map(l => ({ grn_id: h.id, ...l })));
    toast.success("تم"); setOpen(false); setLines([]); load();
  };

  const post = async (id: string) => {
    const { error } = await supabase.rpc("post_goods_receipt", { _grn_id: id });
    if (error) toast.error(error.message); else { toast.success("تم الترحيل وزيادة المخزون"); load(); }
  };

  const filtered = rows.filter(r => !search || r.grn_number?.includes(search));

  return (
    <div className="space-y-4">
      <ListPageHeader title="إذونات استلام البضاعة" breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "المشتريات" }, { label: "إذونات الاستلام" }]} searchValue={search} onSearchChange={setSearch} onAdd={() => setOpen(true)} onRefresh={load} />
      <div className="bg-card border rounded-lg">
        <Table>
          <TableHeader><TableRow><TableHead>الرقم</TableHead><TableHead>التاريخ</TableHead><TableHead>المورد</TableHead><TableHead>القيمة</TableHead><TableHead>الحالة</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center">لا توجد إذونات</TableCell></TableRow> :
              filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.grn_number}</TableCell>
                  <TableCell>{r.receipt_date}</TableCell>
                  <TableCell>{r.suppliers?.name}</TableCell>
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
          <DialogHeader><DialogTitle>إذن استلام جديد</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><Label>أمر الشراء (اختياري)</Label>
              <Select value={form.purchase_order_id} onValueChange={loadFromPO}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>{pos.map(p => <SelectItem key={p.id} value={p.id}>{p.order_number}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>المورد *</Label>
              <Select value={form.supplier_id} onValueChange={v => setForm({ ...form, supplier_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>التاريخ</Label><Input type="date" value={form.receipt_date} onChange={e => setForm({ ...form, receipt_date: e.target.value })} /></div>
            <div><Label>المستودع *</Label>
              <Select value={form.warehouse_id} onValueChange={v => setForm({ ...form, warehouse_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>المرجع</Label><Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} /></div>
            <div className="col-span-2"><Label>ملاحظات</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
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
