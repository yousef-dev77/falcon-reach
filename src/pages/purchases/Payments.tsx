import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { ListPageHeader } from "@/components/ListPageHeader";

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
    payment_method: "cash" as const,
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
      const { data, error } = await supabase.from("suppliers").select("*").eq("is_active", true);
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

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingPayment) {
        const { error } = await supabase.from("payments").update(data).eq("id", editingPayment.id);
        if (error) throw error;
      } else {
        // Insert payment
        const { data: newPayment, error } = await supabase.from("payments").insert([{ ...data, created_by: user?.id }]).select().single();
        if (error) throw error;

        // Auto-generate journal entry
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
          toast.warning("تم حفظ السند لكن لم يتم إنشاء القيد تلقائياً - تحقق من ربط الحسابات");
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast.success(editingPayment ? "تم تحديث سند الصرف بنجاح" : "تم إضافة سند الصرف بنجاح");
      setIsAddOpen(false);
      setEditingPayment(null);
      resetForm();
    },
    onError: () => {
      toast.error("حدث خطأ، حاول مرة أخرى");
    }
  });

  const getSupplierAccount = async (supplierId: string) => {
    const { data } = await supabase.from("suppliers").select("account_id").eq("id", supplierId).single();
    return data?.account_id || null;
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast.success("تم حذف سند الصرف بنجاح");
      setDeletingId(null);
    },
    onError: () => {
      toast.error("حدث خطأ، حاول مرة أخرى");
    }
  });

  const resetForm = () => {
    setFormData({
      payment_number: "",
      payment_date: new Date().toISOString().split('T')[0],
      supplier_id: "",
      amount: "",
      payment_method: "cash",
      cash_box_id: "",
      bank_account_id: "",
      notes: ""
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      ...formData,
      amount: parseFloat(formData.amount),
      cash_box_id: formData.payment_method === "cash" ? formData.cash_box_id : null,
      bank_account_id: formData.payment_method !== "cash" ? formData.bank_account_id : null
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
      <ListPageHeader
        title="المدفوعات"
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "نظام المشتريات" },
          { label: "المدفوعات" },
        ]}
        showAdd={false}
        showSearch={false}
      />

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">سجل المدفوعات</h3>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">جاري التحميل...</div>
          ) : payments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">لا توجد مدفوعات مسجلة</div>
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
                    <TableCell>{payment.payment_number}</TableCell>
                    <TableCell>{new Date(payment.payment_date).toLocaleDateString('ar-SA')}</TableCell>
                    <TableCell>{payment.suppliers?.name}</TableCell>
                    <TableCell>{payment.amount} ر.س</TableCell>
                    <TableCell>{payment.payment_method}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(payment)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setDeletingId(payment.id)}>
                          <Trash2 className="h-4 w-4" />
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
