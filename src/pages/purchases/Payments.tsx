import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, Trash2, Link2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { ListPageHeader } from "@/components/ListPageHeader";
import { InvoiceAllocationTable, AllocationRow, InvoiceItem } from "@/components/InvoiceAllocationTable";

const paymentMethodLabels: Record<string, string> = {
  cash: "نقدي",
  bank_transfer: "تحويل بنكي",
  check: "شيك",
  credit_card: "بطاقة ائتمان",
};

export default function Payments() {
  const { user } = useAuth();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [formData, setFormData] = useState({
    payment_number: "",
    payment_date: new Date().toISOString().split('T')[0],
    supplier_id: "",
    amount: "",
    payment_method: "cash" as "cash" | "bank_transfer" | "check" | "credit_card",
    cash_box_id: "",
    bank_account_id: "",
    notes: ""
  });
  const queryClient = useQueryClient();

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, suppliers(name), payment_allocations(id, allocated_amount, invoice_id, purchase_invoices(invoice_number))")
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    }
  });

  const { data: cashBoxes = [] } = useQuery({
    queryKey: ["cash_boxes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cash_boxes").select("*").eq("is_active", true);
      if (error) throw error;
      return data;
    }
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts").select("*").eq("is_active", true);
      if (error) throw error;
      return data;
    }
  });

  const { data: supplierInvoices = [] } = useQuery({
    queryKey: ["supplier_unpaid_invoices", formData.supplier_id],
    enabled: !!formData.supplier_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_invoices")
        .select("id, invoice_number, invoice_date, total_amount, paid_amount, status")
        .eq("supplier_id", formData.supplier_id)
        .neq("status", "draft")
        .neq("status", "cancelled")
        .order("invoice_date", { ascending: true });
      if (error) throw error;
      return (data || [])
        .map(inv => ({
          id: inv.id,
          invoice_number: inv.invoice_number,
          invoice_date: inv.invoice_date,
          total_amount: Number(inv.total_amount) || 0,
          paid_amount: Number(inv.paid_amount) || 0,
          remaining: (Number(inv.total_amount) || 0) - (Number(inv.paid_amount) || 0),
        }))
        .filter(inv => inv.remaining > 0.01) as InvoiceItem[];
    }
  });

  const generateNumber = () => {
    const count = payments.length + 1;
    return `PAY-${String(count).padStart(5, '0')}`;
  };

  const getSupplierAccount = async (supplierId: string) => {
    const { data } = await supabase.from("suppliers").select("account_id").eq("id", supplierId).single();
    return data?.account_id || null;
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: newPay, error } = await supabase
        .from("payments")
        .insert([{ ...data.payment, created_by: user?.id }])
        .select().single();
      if (error) throw error;

      if (data.allocations.length > 0) {
        const allocRows = data.allocations.map((a: AllocationRow) => ({
          payment_id: newPay.id,
          invoice_id: a.invoice_id,
          allocated_amount: a.allocated_amount,
        }));
        const { error: allocError } = await supabase.from("payment_allocations").insert(allocRows);
        if (allocError) throw allocError;
      }

      try {
        const { createAutoJournalEntry, getLinkedAccount, getJournalTypeForAccount } = await import("@/hooks/useAutoJournalEntry");
        const cashOrBankAccountId = await getLinkedAccount(data.payment.bank_account_id, data.payment.cash_box_id);
        const supplierAccount = await getSupplierAccount(data.payment.supplier_id);
        const journalTypeId = await getJournalTypeForAccount(data.payment.bank_account_id, data.payment.cash_box_id);

        if (cashOrBankAccountId && supplierAccount) {
          await createAutoJournalEntry({
            entry_date: data.payment.payment_date,
            description: `سند صرف رقم ${data.payment.payment_number}`,
            reference: data.payment.payment_number,
            created_by: user!.id,
            journal_type_id: journalTypeId || undefined,
            lines: [
              { account_id: supplierAccount, debit_amount: data.payment.amount, credit_amount: 0, description: `دفع لمورد - ${data.payment.payment_number}` },
              { account_id: cashOrBankAccountId, debit_amount: 0, credit_amount: data.payment.amount, description: `دفع لمورد - ${data.payment.payment_number}` },
            ],
          });
        } else {
          toast.warning("تم الحفظ لكن لم يُنشأ القيد - تأكد من ربط حساب المورد والصندوق/البنك");
        }
      } catch (err: any) {
        console.error("Failed to create auto journal entry:", err);
        toast.warning(`تم حفظ السند لكن فشل القيد: ${err.message || ""}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_invoices"] });
      toast.success("تم إنشاء سند الصرف وترحيله بنجاح");
      closeDialog();
    },
    onError: (err: any) => toast.error(err.message || "حدث خطأ، حاول مرة أخرى")
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast.success("تم حذف سند الصرف");
      setDeletingId(null);
    },
    onError: (err: any) => toast.error(err.message || "لا يمكن حذف هذا السند")
  });

  const closeDialog = () => {
    setIsAddOpen(false);
    setAllocations([]);
  };

  const openAdd = () => {
    setFormData({
      payment_number: generateNumber(),
      payment_date: new Date().toISOString().split('T')[0],
      supplier_id: "",
      amount: "",
      payment_method: "cash",
      cash_box_id: "",
      bank_account_id: "",
      notes: ""
    });
    setAllocations([]);
    setIsAddOpen(true);
  };

  const totalAllocated = useMemo(
    () => allocations.reduce((s, a) => s + (Number(a.allocated_amount) || 0), 0),
    [allocations]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(formData.amount);
    if (!formData.supplier_id) { toast.error("اختر المورد"); return; }
    if (!amount || amount <= 0) { toast.error("أدخل المبلغ"); return; }
    if (formData.payment_method === "cash" && !formData.cash_box_id) { toast.error("اختر الصندوق"); return; }
    if (formData.payment_method !== "cash" && !formData.bank_account_id) { toast.error("اختر الحساب البنكي"); return; }
    if (totalAllocated > amount + 0.01) { toast.error("المخصص للفواتير أكبر من مبلغ السند"); return; }

    createMutation.mutate({
      payment: {
        payment_number: formData.payment_number,
        payment_date: formData.payment_date,
        supplier_id: formData.supplier_id,
        amount,
        payment_method: formData.payment_method,
        cash_box_id: formData.payment_method === "cash" ? formData.cash_box_id : null,
        bank_account_id: formData.payment_method !== "cash" ? formData.bank_account_id : null,
        notes: formData.notes || null
      },
      allocations,
    });
  };

  const viewingPayment = payments.find((p: any) => p.id === viewingId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <ListPageHeader
          title="سندات الصرف"
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "نظام المشتريات" },
            { label: "سندات الصرف" },
          ]}
          showAdd={false}
          showSearch={false}
        />
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 ml-2" />
          إضافة سند صرف
        </Button>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">سجل سندات الصرف</h3>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">جاري التحميل...</div>
          ) : payments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">لا توجد سندات صرف مسجلة</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم السند</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>المورد</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>طريقة الدفع</TableHead>
                  <TableHead>الفواتير</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p: any) => {
                  const allocCount = p.payment_allocations?.length || 0;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono">{p.payment_number}</TableCell>
                      <TableCell>{new Date(p.payment_date).toLocaleDateString('ar-SA')}</TableCell>
                      <TableCell>{p.suppliers?.name}</TableCell>
                      <TableCell className="font-semibold">{Number(p.amount).toLocaleString()}</TableCell>
                      <TableCell>{paymentMethodLabels[p.payment_method] || p.payment_method}</TableCell>
                      <TableCell>
                        {allocCount > 0 ? (
                          <Badge variant="secondary" className="gap-1">
                            <Link2 className="h-3 w-3" /> {allocCount}
                          </Badge>
                        ) : (
                          <Badge variant="outline">على الحساب</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setViewingId(p.id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeletingId(p.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>إضافة سند صرف جديد</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>رقم السند</Label>
                <Input value={formData.payment_number} onChange={e => setFormData({...formData, payment_number: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>التاريخ</Label>
                <Input type="date" value={formData.payment_date} onChange={e => setFormData({...formData, payment_date: e.target.value})} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>المورد</Label>
              <Select value={formData.supplier_id} onValueChange={v => { setFormData({...formData, supplier_id: v}); setAllocations([]); }}>
                <SelectTrigger><SelectValue placeholder="اختر المورد" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>المبلغ</Label>
                <Input type="number" min="0" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>طريقة الدفع</Label>
                <Select value={formData.payment_method} onValueChange={(v: any) => setFormData({...formData, payment_method: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">نقدي</SelectItem>
                    <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                    <SelectItem value="check">شيك</SelectItem>
                    <SelectItem value="credit_card">بطاقة ائتمان</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {formData.payment_method === "cash" ? (
              <div className="space-y-2">
                <Label>الصندوق</Label>
                <Select value={formData.cash_box_id} onValueChange={v => setFormData({...formData, cash_box_id: v})}>
                  <SelectTrigger><SelectValue placeholder="اختر الصندوق" /></SelectTrigger>
                  <SelectContent>
                    {cashBoxes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>الحساب البنكي</Label>
                <Select value={formData.bank_account_id} onValueChange={v => setFormData({...formData, bank_account_id: v})}>
                  <SelectTrigger><SelectValue placeholder="اختر الحساب البنكي" /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.bank_name} - {b.account_number}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.supplier_id && (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <Label className="text-base font-semibold">تخصيص المبلغ على فواتير المورد</Label>
                <p className="text-xs text-muted-foreground">
                  حدد الفواتير التي تريد تسديدها. ما لا يتم تخصيصه يُسجَّل كدفعة على الحساب.
                </p>
                <InvoiceAllocationTable
                  invoices={supplierInvoices}
                  totalAmount={parseFloat(formData.amount) || 0}
                  value={allocations}
                  onChange={setAllocations}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={closeDialog}>إلغاء</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "جاري الحفظ..." : "حفظ وترحيل"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingId} onOpenChange={(o) => !o && setViewingId(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>تفاصيل سند الصرف {viewingPayment?.payment_number}</DialogTitle>
          </DialogHeader>
          {viewingPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">المورد:</span> <strong>{viewingPayment.suppliers?.name}</strong></div>
                <div><span className="text-muted-foreground">التاريخ:</span> <strong>{new Date(viewingPayment.payment_date).toLocaleDateString('ar-SA')}</strong></div>
                <div><span className="text-muted-foreground">المبلغ:</span> <strong>{Number(viewingPayment.amount).toLocaleString()}</strong></div>
                <div><span className="text-muted-foreground">الطريقة:</span> <strong>{paymentMethodLabels[viewingPayment.payment_method]}</strong></div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">الفواتير المسددة بهذا السند</h4>
                {viewingPayment.payment_allocations?.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>رقم الفاتورة</TableHead>
                        <TableHead>المبلغ المخصص</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingPayment.payment_allocations.map((a: any) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-mono">{a.purchase_invoices?.invoice_number}</TableCell>
                          <TableCell>{Number(a.allocated_amount).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">سند على الحساب (غير مخصص لفواتير محددة)</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              لا يمكن حذف السندات المرتبطة بفواتير. حذف ممكن فقط للسندات على الحساب.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingId && deleteMutation.mutate(deletingId)}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
