import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { ListPageHeader } from "@/components/ListPageHeader";

const paymentMethodLabels: Record<string, string> = {
  cash: "نقدي",
  bank_transfer: "تحويل بنكي",
  check: "شيك",
  credit_card: "بطاقة ائتمان",
};

export default function Payments() {
  const { user } = useAuth();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
        .select("*, suppliers(name)")
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

  const generateNumber = () => {
    const count = payments.length + 1;
    return `PAY-${String(count).padStart(5, '0')}`;
  };

  const getSupplierAccount = async (supplierId: string) => {
    const { data } = await supabase.from("suppliers").select("account_id").eq("id", supplierId).single();
    return data?.account_id || null;
  };

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingPayment) {
        const { error } = await supabase.from("payments").update(data).eq("id", editingPayment.id);
        if (error) throw error;
      } else {
        const { data: newPayment, error } = await supabase.from("payments").insert([{ ...data, created_by: user?.id }]).select().single();
        if (error) throw error;

        try {
          const { createAutoJournalEntry, getLinkedAccount, getJournalTypeForAccount } = await import("@/hooks/useAutoJournalEntry");
          const cashOrBankAccountId = await getLinkedAccount(data.bank_account_id, data.cash_box_id);
          const supplierAccount = await getSupplierAccount(data.supplier_id);
          const journalTypeId = await getJournalTypeForAccount(data.bank_account_id, data.cash_box_id);
          
          if (cashOrBankAccountId && supplierAccount) {
            await createAutoJournalEntry({
              entry_date: data.payment_date,
              description: `سند صرف رقم ${data.payment_number}`,
              reference: data.payment_number,
              created_by: user!.id,
              journal_type_id: journalTypeId || undefined,
              lines: [
                { account_id: supplierAccount, debit_amount: data.amount, credit_amount: 0, description: `دفع لمورد - ${data.payment_number}` },
                { account_id: cashOrBankAccountId, debit_amount: 0, credit_amount: data.amount, description: `دفع لمورد - ${data.payment_number}` },
              ],
            });
            toast.info("تم إنشاء القيد المحاسبي تلقائياً");
          }
        } catch (journalError) {
          console.error("Failed to create auto journal entry:", journalError);
          toast.warning("تم حفظ السند لكن لم يتم إنشاء القيد تلقائياً");
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast.success(editingPayment ? "تم تحديث سند الصرف" : "تم إضافة سند الصرف");
      closeDialog();
    },
    onError: () => toast.error("حدث خطأ، حاول مرة أخرى")
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
    onError: () => toast.error("حدث خطأ، حاول مرة أخرى")
  });

  const resetForm = () => {
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
  };

  const closeDialog = () => {
    setIsAddOpen(false);
    setEditingPayment(null);
  };

  const openAdd = () => {
    setEditingPayment(null);
    resetForm();
    setIsAddOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.supplier_id) { toast.error("اختر المورد"); return; }
    if (!formData.amount || parseFloat(formData.amount) <= 0) { toast.error("أدخل المبلغ"); return; }
    if (formData.payment_method === "cash" && !formData.cash_box_id) { toast.error("اختر الصندوق"); return; }
    if (formData.payment_method !== "cash" && !formData.bank_account_id) { toast.error("اختر الحساب البنكي"); return; }

    mutation.mutate({
      payment_number: formData.payment_number,
      payment_date: formData.payment_date,
      supplier_id: formData.supplier_id,
      amount: parseFloat(formData.amount),
      payment_method: formData.payment_method,
      cash_box_id: formData.payment_method === "cash" ? formData.cash_box_id : null,
      bank_account_id: formData.payment_method !== "cash" ? formData.bank_account_id : null,
      notes: formData.notes || null
    });
  };

  const handleEdit = (payment: any) => {
    setEditingPayment(payment);
    setFormData({
      payment_number: payment.payment_number,
      payment_date: payment.payment_date,
      supplier_id: payment.supplier_id,
      amount: payment.amount.toString(),
      payment_method: payment.payment_method,
      cash_box_id: payment.cash_box_id || "",
      bank_account_id: payment.bank_account_id || "",
      notes: payment.notes || ""
    });
    setIsAddOpen(true);
  };

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
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment: any) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-mono">{payment.payment_number}</TableCell>
                    <TableCell>{new Date(payment.payment_date).toLocaleDateString('ar-SA')}</TableCell>
                    <TableCell>{payment.suppliers?.name}</TableCell>
                    <TableCell>{Number(payment.amount).toLocaleString()}</TableCell>
                    <TableCell>{paymentMethodLabels[payment.payment_method] || payment.payment_method}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(payment)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeletingId(payment.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPayment ? "تعديل سند الصرف" : "إضافة سند صرف جديد"}</DialogTitle>
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
              <Select value={formData.supplier_id} onValueChange={v => setFormData({...formData, supplier_id: v})}>
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
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={closeDialog}>إلغاء</Button>
              <Button type="submit" disabled={mutation.isPending}>{editingPayment ? "تحديث" : "إضافة"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذا السند؟</AlertDialogDescription>
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
