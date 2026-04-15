import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Eye, Trash2, CheckCircle2, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ListPageHeader } from "@/components/ListPageHeader";
import { useBranch } from "@/contexts/BranchContext";

type InvoiceLine = {
  product_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
  line_total: number;
};

const statusLabels: Record<string, string> = {
  draft: "مسودة",
  confirmed: "مؤكدة",
  paid: "مدفوعة",
  partially_paid: "مدفوعة جزئياً",
  cancelled: "ملغاة",
};

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  confirmed: "default",
  paid: "default",
  partially_paid: "outline",
  cancelled: "destructive",
};

export default function PurchaseInvoices() {
  const { user } = useAuth();
  const { activeBranch } = useBranch();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<any>(null);
  const [viewLines, setViewLines] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    invoice_date: new Date().toISOString().split("T")[0],
    supplier_id: "",
    warehouse_id: "",
    notes: "",
  });
  const [lines, setLines] = useState<InvoiceLine[]>([
    { product_id: "", description: "", quantity: 1, unit_price: 0, discount_percent: 0, tax_percent: 0, line_total: 0 },
  ]);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [inv, sup, prod, wh] = await Promise.all([
      supabase.from("purchase_invoices").select("*, suppliers(name)").order("invoice_date", { ascending: false }),
      supabase.from("suppliers").select("*").eq("is_active", true).order("name"),
      supabase.from("products").select("*").eq("is_active", true).order("name"),
      supabase.from("warehouses").select("*").eq("is_active", true),
    ]);
    setInvoices(inv.data || []);
    setSuppliers(sup.data || []);
    setProducts(prod.data || []);
    setWarehouses(wh.data || []);
    setLoading(false);
  };

  const generateNumber = () => {
    const count = invoices.length + 1;
    return `PUR-${String(count).padStart(5, '0')}`;
  };

  const calcLineTotal = (line: InvoiceLine) => {
    const subtotal = line.quantity * line.unit_price;
    const discount = subtotal * (line.discount_percent / 100);
    const afterDiscount = subtotal - discount;
    const tax = afterDiscount * (line.tax_percent / 100);
    return afterDiscount + tax;
  };

  const updateLine = (index: number, field: string, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    
    if (field === "product_id") {
      const product = products.find((p: any) => p.id === value);
      if (product) {
        newLines[index].unit_price = product.cost_price || 0;
        newLines[index].description = product.name;
      }
    }
    
    newLines[index].line_total = calcLineTotal(newLines[index]);
    setLines(newLines);
  };

  const addLine = () => {
    setLines([...lines, { product_id: "", description: "", quantity: 1, unit_price: 0, discount_percent: 0, tax_percent: 0, line_total: 0 }]);
  };

  const removeLine = (i: number) => {
    if (lines.length > 1) setLines(lines.filter((_, idx) => idx !== i));
  };

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const discountTotal = lines.reduce((s, l) => s + (l.quantity * l.unit_price * l.discount_percent / 100), 0);
  const taxTotal = lines.reduce((s, l) => {
    const after = l.quantity * l.unit_price * (1 - l.discount_percent / 100);
    return s + after * l.tax_percent / 100;
  }, 0);
  const totalAmount = subtotal - discountTotal + taxTotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!formData.supplier_id) { toast.error("اختر المورد"); return; }
    const validLines = lines.filter(l => l.product_id && l.quantity > 0);
    if (validLines.length === 0) { toast.error("أضف منتج واحد على الأقل"); return; }

    const invoiceNumber = generateNumber();
    const { data: inv, error } = await supabase.from("purchase_invoices").insert({
      invoice_number: invoiceNumber,
      invoice_date: formData.invoice_date,
      supplier_id: formData.supplier_id,
      warehouse_id: formData.warehouse_id || null,
      branch_id: activeBranch?.id || null,
      subtotal,
      discount_amount: discountTotal,
      tax_amount: taxTotal,
      total_amount: totalAmount,
      status: "draft",
      notes: formData.notes || null,
      created_by: user.id,
    }).select().single();

    if (error) { toast.error("خطأ في إنشاء الفاتورة"); console.error(error); return; }

    const lineInserts = validLines.map(l => ({
      invoice_id: inv.id,
      product_id: l.product_id,
      description: l.description,
      quantity: l.quantity,
      unit_price: l.unit_price,
      discount_percent: l.discount_percent,
      tax_percent: l.tax_percent,
      line_total: calcLineTotal(l),
    }));

    await supabase.from("purchase_invoice_lines").insert(lineInserts);
    toast.success("تم إنشاء فاتورة المشتريات بنجاح");
    fetchAll();
    setIsDialogOpen(false);
  };

  const handleConfirm = async (id: string) => {
    const inv = invoices.find(i => i.id === id);
    if (!inv || inv.status !== "draft") return;

    try {
      const { createAutoJournalEntry } = await import("@/hooks/useAutoJournalEntry");
      const supplier = await supabase.from("suppliers").select("account_id").eq("id", inv.supplier_id).single();
      
      if (supplier.data?.account_id) {
        // Find an expense account
        const { data: expenseAccounts } = await supabase.from("accounts")
          .select("id").eq("account_type", "expense").eq("is_active", true).eq("allow_manual_entry", true).limit(1);
        
        if (expenseAccounts && expenseAccounts.length > 0) {
          await createAutoJournalEntry({
            entry_date: inv.invoice_date,
            description: `فاتورة مشتريات رقم ${inv.invoice_number}`,
            reference: inv.invoice_number,
            created_by: user!.id,
            branch_id: inv.branch_id,
            lines: [
              { account_id: expenseAccounts[0].id, debit_amount: inv.total_amount, credit_amount: 0, description: `فاتورة مشتريات - ${inv.invoice_number}` },
              { account_id: supplier.data.account_id, debit_amount: 0, credit_amount: inv.total_amount, description: `فاتورة مشتريات - ${inv.invoice_number}` },
            ],
          });
          toast.info("تم إنشاء القيد المحاسبي تلقائياً");
        }
      }
    } catch (e) {
      console.error(e);
      toast.warning("تم تأكيد الفاتورة لكن لم يتم إنشاء القيد تلقائياً");
    }

    const { error } = await supabase.from("purchase_invoices").update({ status: "confirmed", approved_by: user?.id }).eq("id", id);
    if (error) { toast.error("خطأ في تأكيد الفاتورة"); return; }
    toast.success("تم تأكيد الفاتورة وترحيلها");
    fetchAll();
  };

  const handleView = async (inv: any) => {
    setViewInvoice(inv);
    const { data } = await supabase.from("purchase_invoice_lines").select("*, products(name, code)").eq("invoice_id", inv.id);
    setViewLines(data || []);
    setIsViewOpen(true);
  };

  const handleDelete = async (id: string) => {
    const inv = invoices.find(i => i.id === id);
    if (inv?.status !== "draft") { toast.error("لا يمكن حذف فاتورة مؤكدة"); return; }
    if (!confirm("هل أنت متأكد من حذف الفاتورة؟")) return;
    await supabase.from("purchase_invoice_lines").delete().eq("invoice_id", id);
    await supabase.from("purchase_invoices").delete().eq("id", id);
    toast.success("تم حذف الفاتورة");
    fetchAll();
  };

  const openAdd = () => {
    setFormData({ invoice_date: new Date().toISOString().split("T")[0], supplier_id: "", warehouse_id: "", notes: "" });
    setLines([{ product_id: "", description: "", quantity: 1, unit_price: 0, discount_percent: 0, tax_percent: 0, line_total: 0 }]);
    setIsDialogOpen(true);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  const draftCount = invoices.filter(i => i.status === "draft").length;
  const confirmedCount = invoices.filter(i => i.status === "confirmed").length;
  const paidCount = invoices.filter(i => i.status === "paid" || i.status === "partially_paid").length;

  return (
    <div className="space-y-4">
      <ListPageHeader
        title="فواتير المشتريات"
        breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "نظام المشتريات" }, { label: "فواتير المشتريات" }]}
        onAdd={openAdd}
        addLabel="إنشاء فاتورة"
        onRefresh={fetchAll}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">إجمالي الفواتير</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{invoices.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">مسودات</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{draftCount}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">مؤكدة</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{confirmedCount}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">مدفوعة</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{paidCount}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>سجل الفواتير</CardTitle></CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">لا توجد فواتير مسجلة</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الفاتورة</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>المورد</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono">{inv.invoice_number}</TableCell>
                    <TableCell>{new Date(inv.invoice_date).toLocaleDateString('ar-SA')}</TableCell>
                    <TableCell>{inv.suppliers?.name}</TableCell>
                    <TableCell>{Number(inv.total_amount || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariants[inv.status] || "secondary"}>
                        {statusLabels[inv.status] || inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleView(inv)}><Eye className="h-4 w-4" /></Button>
                        {inv.status === "draft" && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => handleConfirm(inv.id)} title="تأكيد وترحيل">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(inv.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Invoice Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>إنشاء فاتورة مشتريات</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>التاريخ</Label>
                <Input type="date" value={formData.invoice_date} onChange={e => setFormData({...formData, invoice_date: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>المورد</Label>
                <Select value={formData.supplier_id} onValueChange={v => setFormData({...formData, supplier_id: v})}>
                  <SelectTrigger><SelectValue placeholder="اختر المورد" /></SelectTrigger>
                  <SelectContent>{suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>المستودع</Label>
                <Select value={formData.warehouse_id} onValueChange={v => setFormData({...formData, warehouse_id: v})}>
                  <SelectTrigger><SelectValue placeholder="اختر المستودع" /></SelectTrigger>
                  <SelectContent>{warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">بنود الفاتورة</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}><Plus className="h-4 w-4 ml-1" />إضافة بند</Button>
              </div>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المنتج</TableHead>
                      <TableHead className="w-20">الكمية</TableHead>
                      <TableHead className="w-24">السعر</TableHead>
                      <TableHead className="w-20">خصم %</TableHead>
                      <TableHead className="w-20">ضريبة %</TableHead>
                      <TableHead className="w-24">الإجمالي</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Select value={line.product_id || "none"} onValueChange={v => updateLine(i, "product_id", v === "none" ? "" : v)}>
                            <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">اختر منتج</SelectItem>
                              {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.code} - {p.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell><Input type="number" min="1" value={line.quantity} onChange={e => updateLine(i, "quantity", parseFloat(e.target.value) || 0)} /></TableCell>
                        <TableCell><Input type="number" min="0" step="0.01" value={line.unit_price} onChange={e => updateLine(i, "unit_price", parseFloat(e.target.value) || 0)} /></TableCell>
                        <TableCell><Input type="number" min="0" max="100" value={line.discount_percent} onChange={e => updateLine(i, "discount_percent", parseFloat(e.target.value) || 0)} /></TableCell>
                        <TableCell><Input type="number" min="0" max="100" value={line.tax_percent} onChange={e => updateLine(i, "tax_percent", parseFloat(e.target.value) || 0)} /></TableCell>
                        <TableCell className="font-bold">{calcLineTotal(line).toLocaleString()}</TableCell>
                        <TableCell><Button type="button" variant="ghost" size="icon" onClick={() => removeLine(i)} disabled={lines.length <= 1}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={5} className="text-left">الإجمالي</TableCell>
                      <TableCell>{totalAmount.toLocaleString()}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
              <Button type="submit">حفظ كمسودة</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Invoice Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>تفاصيل الفاتورة</DialogTitle>
              {viewInvoice?.status === "draft" && (
                <Button size="sm" onClick={() => { handleConfirm(viewInvoice.id); setIsViewOpen(false); }}>
                  <CheckCircle2 className="h-4 w-4 ml-2" />تأكيد وترحيل
                </Button>
              )}
            </div>
          </DialogHeader>
          {viewInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><Label className="text-muted-foreground">رقم الفاتورة</Label><p className="font-medium">{viewInvoice.invoice_number}</p></div>
                <div><Label className="text-muted-foreground">التاريخ</Label><p>{new Date(viewInvoice.invoice_date).toLocaleDateString('ar-SA')}</p></div>
                <div><Label className="text-muted-foreground">المورد</Label><p>{viewInvoice.suppliers?.name}</p></div>
                <div><Label className="text-muted-foreground">الحالة</Label><Badge variant={statusVariants[viewInvoice.status]}>{statusLabels[viewInvoice.status]}</Badge></div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المنتج</TableHead>
                    <TableHead>الكمية</TableHead>
                    <TableHead>السعر</TableHead>
                    <TableHead>خصم %</TableHead>
                    <TableHead>ضريبة %</TableHead>
                    <TableHead>الإجمالي</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewLines.map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.products?.name || l.description}</TableCell>
                      <TableCell>{l.quantity}</TableCell>
                      <TableCell>{Number(l.unit_price).toLocaleString()}</TableCell>
                      <TableCell>{l.discount_percent}%</TableCell>
                      <TableCell>{l.tax_percent}%</TableCell>
                      <TableCell className="font-bold">{Number(l.line_total).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={5}>الإجمالي</TableCell>
                    <TableCell>{Number(viewInvoice.total_amount || 0).toLocaleString()}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
