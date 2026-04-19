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

export default function Collections() {
  const { user } = useAuth();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [formData, setFormData] = useState({
    receipt_number: "",
    receipt_date: new Date().toISOString().split('T')[0],
    customer_id: "",
    amount: "",
    payment_method: "cash" as "cash" | "bank_transfer" | "check" | "credit_card",
    cash_box_id: "",
    bank_account_id: "",
    notes: ""
  });
  const queryClient = useQueryClient();

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ["collections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collections")
        .select("*, customers(name), collection_allocations(id, allocated_amount, invoice_id, sales_invoices(invoice_number))")
        .order("receipt_date", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").eq("is_active", true).order("name");
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

  // Unpaid invoices for the selected customer
  const { data: customerInvoices = [] } = useQuery({
    queryKey: ["customer_unpaid_invoices", formData.customer_id],
    enabled: !!formData.customer_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_invoices")
        .select("id, invoice_number, invoice_date, total_amount, paid_amount, status")
        .eq("customer_id", formData.customer_id)
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
    const count = collections.length + 1;
    return `COL-${String(count).padStart(5, '0')}`;
  };

  const getCustomerAccount = async (customerId: string) => {
    const { data } = await supabase.from("customers").select("account_id").eq("id", customerId).single();
    return data?.account_id || null;
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: newCol, error } = await supabase
        .from("collections")
        .insert([{ ...data.collection, created_by: user?.id }])
        .select().single();
      if (error) throw error;

      // 1. Insert allocations (triggers will update invoice paid_amount + status)
      if (data.allocations.length > 0) {
        const allocRows = data.allocations.map((a: AllocationRow) => ({
          collection_id: newCol.id,
          invoice_id: a.invoice_id,
          allocated_amount: a.allocated_amount,
        }));
        const { error: allocError } = await supabase.from("collection_allocations").insert(allocRows);
        if (allocError) throw allocError;
      }

      // 2. Auto-create journal entry
      try {
        const { createAutoJournalEntry, getLinkedAccount, getJournalTypeForAccount } = await import("@/hooks/useAutoJournalEntry");
        const cashOrBankAccountId = await getLinkedAccount(data.collection.bank_account_id, data.collection.cash_box_id);
        const customerAccount = await getCustomerAccount(data.collection.customer_id);
        const journalTypeId = await getJournalTypeForAccount(data.collection.bank_account_id, data.collection.cash_box_id);

        if (cashOrBankAccountId && customerAccount) {
          await createAutoJournalEntry({
            entry_date: data.collection.receipt_date,
            description: `سند قبض رقم ${data.collection.receipt_number}`,
            reference: data.collection.receipt_number,
            created_by: user!.id,
            journal_type_id: journalTypeId || undefined,
            lines: [
              { account_id: cashOrBankAccountId, debit_amount: data.collection.amount, credit_amount: 0, description: `قبض من عميل - ${data.collection.receipt_number}` },
              { account_id: customerAccount, debit_amount: 0, credit_amount: data.collection.amount, description: `قبض من عميل - ${data.collection.receipt_number}` },
            ],
          });
        } else {
          toast.warning("تم الحفظ لكن لم يُنشأ القيد - تأكد من ربط حساب العميل والصندوق/البنك");
        }
      } catch (err: any) {
        console.error("Failed to create auto journal entry:", err);
        toast.warning(`تم حفظ السند لكن فشل القيد: ${err.message || ""}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      queryClient.invalidateQueries({ queryKey: ["sales_invoices"] });
      toast.success("تم إنشاء سند القبض وترحيله بنجاح");
      closeDialog();
    },
    onError: (err: any) => toast.error(err.message || "حدث خطأ، حاول مرة أخرى")
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("collections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      toast.success("تم حذف سند القبض");
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
      receipt_number: generateNumber(),
      receipt_date: new Date().toISOString().split('T')[0],
      customer_id: "",
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
    if (!formData.customer_id) { toast.error("اختر العميل"); return; }
    if (!amount || amount <= 0) { toast.error("أدخل المبلغ"); return; }
    if (formData.payment_method === "cash" && !formData.cash_box_id) { toast.error("اختر الصندوق"); return; }
    if (formData.payment_method !== "cash" && !formData.bank_account_id) { toast.error("اختر الحساب البنكي"); return; }
    if (totalAllocated > amount + 0.01) { toast.error("المخصص للفواتير أكبر من مبلغ السند"); return; }

    createMutation.mutate({
      collection: {
        receipt_number: formData.receipt_number,
        receipt_date: formData.receipt_date,
        customer_id: formData.customer_id,
        amount,
        payment_method: formData.payment_method,
        cash_box_id: formData.payment_method === "cash" ? formData.cash_box_id : null,
        bank_account_id: formData.payment_method !== "cash" ? formData.bank_account_id : null,
        notes: formData.notes || null
      },
      allocations,
    });
  };

  const viewingCollection = collections.find((c: any) => c.id === viewingId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <ListPageHeader
          title="سندات القبض"
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "نظام المبيعات" },
            { label: "سندات القبض" },
          ]}
          showAdd={false}
          showSearch={false}
        />
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 ml-2" />
          إضافة سند قبض
        </Button>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">سجل سندات القبض</h3>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">جاري التحميل...</div>
          ) : collections.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">لا توجد سندات قبض مسجلة</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم السند</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>العميل</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>طريقة الدفع</TableHead>
                  <TableHead>الفواتير</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collections.map((col: any) => {
                  const allocCount = col.collection_allocations?.length || 0;
                  return (
                    <TableRow key={col.id}>
                      <TableCell className="font-mono">{col.receipt_number}</TableCell>
                      <TableCell>{new Date(col.receipt_date).toLocaleDateString('ar-SA')}</TableCell>
                      <TableCell>{col.customers?.name}</TableCell>
                      <TableCell className="font-semibold">{Number(col.amount).toLocaleString()}</TableCell>
                      <TableCell>{paymentMethodLabels[col.payment_method] || col.payment_method}</TableCell>
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
                          <Button variant="ghost" size="icon" onClick={() => setViewingId(col.id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeletingId(col.id)}>
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
            <DialogTitle>إضافة سند قبض جديد</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>رقم السند</Label>
                <Input value={formData.receipt_number} onChange={e => setFormData({...formData, receipt_number: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>التاريخ</Label>
                <Input type="date" value={formData.receipt_date} onChange={e => setFormData({...formData, receipt_date: e.target.value})} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>العميل</Label>
              <Select value={formData.customer_id} onValueChange={v => { setFormData({...formData, customer_id: v}); setAllocations([]); }}>
                <SelectTrigger><SelectValue placeholder="اختر العميل" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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

            {/* Allocation Section */}
            {formData.customer_id && (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <Label className="text-base font-semibold">تخصيص المبلغ على فواتير العميل</Label>
                <p className="text-xs text-muted-foreground">
                  حدد الفواتير التي تريد تسديدها. ما لا يتم تخصيصه يُسجَّل كمبلغ على الحساب.
                </p>
                <InvoiceAllocationTable
                  invoices={customerInvoices}
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

      {/* View Dialog - shows linked invoices */}
      <Dialog open={!!viewingId} onOpenChange={(o) => !o && setViewingId(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>تفاصيل سند القبض {viewingCollection?.receipt_number}</DialogTitle>
          </DialogHeader>
          {viewingCollection && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">العميل:</span> <strong>{viewingCollection.customers?.name}</strong></div>
                <div><span className="text-muted-foreground">التاريخ:</span> <strong>{new Date(viewingCollection.receipt_date).toLocaleDateString('ar-SA')}</strong></div>
                <div><span className="text-muted-foreground">المبلغ:</span> <strong>{Number(viewingCollection.amount).toLocaleString()}</strong></div>
                <div><span className="text-muted-foreground">الطريقة:</span> <strong>{paymentMethodLabels[viewingCollection.payment_method]}</strong></div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">الفواتير المسددة بهذا السند</h4>
                {viewingCollection.collection_allocations?.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>رقم الفاتورة</TableHead>
                        <TableHead>المبلغ المخصص</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingCollection.collection_allocations.map((a: any) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-mono">{a.sales_invoices?.invoice_number}</TableCell>
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
