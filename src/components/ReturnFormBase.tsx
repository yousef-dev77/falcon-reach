import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useBranch } from "@/contexts/BranchContext";

interface Line {
  product_id: string;
  quantity: number;
  unit_price: number;
  tax_id: string | null;
  tax_percent: number;
  line_total: number;
}

interface Props {
  type: "sales" | "purchase";
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}

export function ReturnFormBase({ type, open, onOpenChange, onSaved }: Props) {
  const { activeBranch } = useBranch();
  const [partyId, setPartyId] = useState("");
  const [originalInvoiceId, setOriginalInvoiceId] = useState<string>("");
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [warehouseId, setWarehouseId] = useState("");
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [taxes, setTaxes] = useState<any[]>([]);
  const [originalInvoices, setOriginalInvoices] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const partyTable = type === "sales" ? "customers" : "suppliers";
      const [{ data: p }, { data: pr }, { data: w }, { data: t }] = await Promise.all([
        supabase.from(partyTable).select("id, code, name").eq("is_active", true),
        supabase.from("products").select("id, code, name, selling_price, cost_price").eq("is_active", true),
        supabase.from("warehouses").select("id, code, name").eq("is_active", true),
        supabase.from("taxes").select("id, code, name, rate").eq("is_active", true),
      ]);
      setParties(p || []);
      setProducts(pr || []);
      setWarehouses(w || []);
      setTaxes(t || []);
    })();
  }, [open, type]);

  useEffect(() => {
    if (!partyId) { setOriginalInvoices([]); return; }
    (async () => {
      const table = type === "sales" ? "sales_invoices" : "purchase_invoices";
      const col = type === "sales" ? "customer_id" : "supplier_id";
      const { data } = await supabase.from(table)
        .select("id, invoice_number, invoice_date, total_amount")
        .eq(col, partyId).neq("status", "draft").order("invoice_date", { ascending: false });
      setOriginalInvoices(data || []);
    })();
  }, [partyId, type]);

  const addLine = () => setLines([...lines, { product_id: "", quantity: 1, unit_price: 0, tax_id: null, tax_percent: 0, line_total: 0 }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, patch: Partial<Line>) => {
    const newLines = [...lines];
    newLines[i] = { ...newLines[i], ...patch };
    const l = newLines[i];
    l.line_total = l.quantity * l.unit_price;
    setLines(newLines);
  };

  const subtotal = lines.reduce((s, l) => s + l.line_total, 0);
  const taxAmount = lines.reduce((s, l) => s + (l.line_total * l.tax_percent / 100), 0);
  const total = subtotal + taxAmount;

  const handleSave = async () => {
    if (!partyId) { toast.error("اختر العميل/المورد"); return; }
    if (lines.length === 0) { toast.error("أضف بنود"); return; }
    if (!activeBranch) { toast.error("لا يوجد فرع نشط"); return; }
    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const tableHeader = type === "sales" ? "sales_returns" : "purchase_returns";
      const tableLines = type === "sales" ? "sales_return_lines" : "purchase_return_lines";
      const partyCol = type === "sales" ? "customer_id" : "supplier_id";
      const prefix = type === "sales" ? "SR" : "PR";
      const returnNumber = `${prefix}-${activeBranch.code}-${Date.now().toString().slice(-6)}`;

      const headerData: any = {
        return_number: returnNumber,
        return_date: returnDate,
        [partyCol]: partyId,
        original_invoice_id: originalInvoiceId || null,
        branch_id: activeBranch.id,
        warehouse_id: warehouseId || null,
        reason,
        subtotal,
        tax_amount: taxAmount,
        total_amount: total,
        created_by: user.user?.id,
        status: "draft",
      };

      const { data: header, error: e1 } = await supabase.from(tableHeader).insert(headerData).select().single();
      if (e1) throw e1;

      const linesData = lines.map(l => ({
        return_id: header.id,
        product_id: l.product_id,
        quantity: l.quantity,
        unit_price: l.unit_price,
        tax_id: l.tax_id,
        tax_percent: l.tax_percent,
        line_total: l.line_total,
      }));
      const { error: e2 } = await supabase.from(tableLines).insert(linesData);
      if (e2) throw e2;

      toast.success(`تم إنشاء ${returnNumber}`);
      onOpenChange(false);
      setPartyId(""); setLines([]); setOriginalInvoiceId(""); setReason("");
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{type === "sales" ? "مرتجع مبيعات جديد" : "مرتجع مشتريات جديد"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label>{type === "sales" ? "العميل *" : "المورد *"}</Label>
            <Select value={partyId} onValueChange={setPartyId}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {parties.map(p => <SelectItem key={p.id} value={p.id}>{p.code} - {p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>الفاتورة الأصلية</Label>
            <Select value={originalInvoiceId} onValueChange={setOriginalInvoiceId}>
              <SelectTrigger><SelectValue placeholder="اختياري" /></SelectTrigger>
              <SelectContent>
                {originalInvoices.map(i => <SelectItem key={i.id} value={i.id}>{i.invoice_number}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>التاريخ</Label>
            <Input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
          </div>
          <div>
            <Label>المستودع</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-full">
            <Label>السبب</Label>
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="سبب المرتجع" />
          </div>
        </div>

        <div className="border rounded-lg mt-4">
          <div className="flex items-center justify-between p-3 border-b">
            <h3 className="font-semibold">البنود</h3>
            <Button size="sm" onClick={addLine}><Plus className="me-1 h-4 w-4" /> إضافة بند</Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الصنف</TableHead>
                <TableHead>الكمية</TableHead>
                <TableHead>السعر</TableHead>
                <TableHead>الضريبة</TableHead>
                <TableHead>الإجمالي</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Select value={l.product_id} onValueChange={v => {
                      const prod = products.find(p => p.id === v);
                      const price = type === "sales" ? prod?.selling_price : prod?.cost_price;
                      updateLine(i, { product_id: v, unit_price: Number(price) || 0 });
                    }}>
                      <SelectTrigger><SelectValue placeholder="اختر صنف" /></SelectTrigger>
                      <SelectContent>
                        {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Input type="number" value={l.quantity} onChange={e => updateLine(i, { quantity: parseFloat(e.target.value) || 0 })} /></TableCell>
                  <TableCell><Input type="number" value={l.unit_price} onChange={e => updateLine(i, { unit_price: parseFloat(e.target.value) || 0 })} /></TableCell>
                  <TableCell>
                    <Select value={l.tax_id || "none"} onValueChange={v => {
                      if (v === "none") { updateLine(i, { tax_id: null, tax_percent: 0 }); return; }
                      const tx = taxes.find(t => t.id === v);
                      updateLine(i, { tax_id: v, tax_percent: Number(tx?.rate) || 0 });
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">بدون</SelectItem>
                        {taxes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{l.line_total.toFixed(2)}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => removeLine(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end gap-6 pt-4 border-t">
          <div className="text-sm">المجموع: <span className="font-bold">{subtotal.toFixed(2)}</span></div>
          <div className="text-sm">الضريبة: <span className="font-bold">{taxAmount.toFixed(2)}</span></div>
          <div className="text-lg">الإجمالي: <span className="font-bold text-primary">{total.toFixed(2)}</span></div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ كمسودة"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
