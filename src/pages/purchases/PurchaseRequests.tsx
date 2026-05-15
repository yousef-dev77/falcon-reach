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
import { Plus, Trash2, CheckCircle, Send } from "lucide-react";
import { toast } from "sonner";

const statusLabels: Record<string, string> = { draft: "مسودة", submitted: "مرسل", approved: "معتمد", rejected: "مرفوض", closed: "مغلق" };

export default function PurchaseRequests() {
  const { user } = useAuth();
  const { activeBranch } = useBranch();
  const [rows, setRows] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ request_date: new Date().toISOString().slice(0, 10), required_date: "", warehouse_id: "", department: "", notes: "" });
  const [lines, setLines] = useState<any[]>([{ product_id: "", quantity: 1, estimated_price: 0 }]);

  const load = async () => {
    const { data } = await supabase.from("purchase_requests").select("*").order("request_date", { ascending: false });
    setRows(data || []);
    const [p, w] = await Promise.all([
      supabase.from("products").select("id,code,name").eq("is_active", true),
      supabase.from("warehouses").select("id,code,name").eq("is_active", true),
    ]);
    setProducts(p.data || []); setWarehouses(w.data || []);
  };
  useEffect(() => { load(); }, []);

  const addLine = () => setLines([...lines, { product_id: "", quantity: 1, estimated_price: 0 }]);
  const removeLine = (i: number) => setLines(lines.filter((_, x) => x !== i));
  const updateLine = (i: number, patch: any) => { const n = [...lines]; n[i] = { ...n[i], ...patch }; setLines(n); };

  const save = async () => {
    if (!activeBranch) return toast.error("لا يوجد فرع نشط");
    if (lines.some(l => !l.product_id)) return toast.error("اختر الأصناف");
    const request_number = `PR-${activeBranch.code}-${Date.now().toString().slice(-6)}`;
    const { data: h, error } = await supabase.from("purchase_requests").insert({
      request_number, request_date: form.request_date, required_date: form.required_date || null,
      branch_id: activeBranch.id, warehouse_id: form.warehouse_id || null,
      department: form.department, notes: form.notes, status: "draft", created_by: user!.id,
    }).select().single();
    if (error) return toast.error(error.message);
    const linesData = lines.map(l => ({ request_id: h.id, product_id: l.product_id, quantity: l.quantity, estimated_price: l.estimated_price }));
    await supabase.from("purchase_request_lines").insert(linesData);
    toast.success("تم الحفظ"); setOpen(false); setLines([{ product_id: "", quantity: 1, estimated_price: 0 }]); load();
  };

  const setStatus = async (id: string, status: "draft" | "submitted" | "approved" | "rejected" | "closed") => {
    const patch: any = { status };
    if (status === "approved") { patch.approved_by = user!.id; patch.approved_at = new Date().toISOString(); }
    const { error } = await supabase.from("purchase_requests").update(patch).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("تم"); load(); }
  };

  const filtered = rows.filter(r => !search || r.request_number?.includes(search));

  return (
    <div className="space-y-4">
      <ListPageHeader title="طلبات الشراء" breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "المشتريات" }, { label: "طلبات الشراء" }]} searchValue={search} onSearchChange={setSearch} onAdd={() => setOpen(true)} onRefresh={load} />
      <div className="bg-card border rounded-lg">
        <Table>
          <TableHeader><TableRow><TableHead>الرقم</TableHead><TableHead>التاريخ</TableHead><TableHead>القسم</TableHead><TableHead>الحالة</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center">لا توجد طلبات</TableCell></TableRow> :
              filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.request_number}</TableCell>
                  <TableCell>{r.request_date}</TableCell>
                  <TableCell>{r.department || "-"}</TableCell>
                  <TableCell><Badge variant={r.status === "approved" ? "default" : "secondary"}>{statusLabels[r.status]}</Badge></TableCell>
                  <TableCell className="flex gap-1">
                    {r.status === "draft" && <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "submitted")}><Send className="h-4 w-4" /></Button>}
                    {r.status === "submitted" && <Button size="sm" onClick={() => setStatus(r.id, "approved")}><CheckCircle className="h-4 w-4" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>طلب شراء جديد</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><Label>التاريخ</Label><Input type="date" value={form.request_date} onChange={e => setForm({ ...form, request_date: e.target.value })} /></div>
            <div><Label>تاريخ الحاجة</Label><Input type="date" value={form.required_date} onChange={e => setForm({ ...form, required_date: e.target.value })} /></div>
            <div><Label>المستودع</Label>
              <Select value={form.warehouse_id} onValueChange={v => setForm({ ...form, warehouse_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>القسم</Label><Input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} /></div>
            <div className="col-span-full"><Label>ملاحظات</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div className="border rounded-lg mt-3">
            <div className="flex justify-between p-3 border-b"><h3 className="font-semibold">البنود</h3><Button size="sm" onClick={addLine}><Plus className="h-4 w-4 me-1" />إضافة</Button></div>
            <Table>
              <TableHeader><TableRow><TableHead>الصنف</TableHead><TableHead>الكمية</TableHead><TableHead>السعر التقديري</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {lines.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Select value={l.product_id} onValueChange={v => updateLine(i, { product_id: v })}>
                        <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                        <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Input type="number" value={l.quantity} onChange={e => updateLine(i, { quantity: +e.target.value })} /></TableCell>
                    <TableCell><Input type="number" value={l.estimated_price} onChange={e => updateLine(i, { estimated_price: +e.target.value })} /></TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => removeLine(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={save}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
