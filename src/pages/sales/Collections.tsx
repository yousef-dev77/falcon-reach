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

export default function Collections() {
  const { user } = useAuth();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    receipt_number: "",
    receipt_date: new Date().toISOString().split('T')[0],
    customer_id: "",
    amount: "",
    payment_method: "cash" as const,
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
        .select("*, customers(name)")
        .order("receipt_date", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").eq("is_active", true);
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
      if (editingCollection) {
        const { error } = await supabase.from("collections").update(data).eq("id", editingCollection.id);
        if (error) throw error;
      } else {
        // Insert collection
        const { data: newCollection, error } = await supabase.from("collections").insert([{ ...data, created_by: user?.id }]).select().single();
        if (error) throw error;

        // Auto-generate journal entry
        try {
          const { createAutoJournalEntry, getLinkedAccount, getJournalTypeForAccount } = await import("@/hooks/useAutoJournalEntry");
          
          const cashOrBankAccountId = await getLinkedAccount(data.bank_account_id, data.cash_box_id);
          const customerAccount = await getCustomerAccount(data.customer_id);
          const journalTypeId = await getJournalTypeForAccount(data.bank_account_id, data.cash_box_id);
          
          if (cashOrBankAccountId && customerAccount) {
            await createAutoJournalEntry({
              entry_date: data.receipt_date,
              description: `سند قبض رقم ${data.receipt_number}`,
              reference: data.receipt_number,
              created_by: user!.id,
              journal_type_id: journalTypeId || undefined,
              lines: [
                { account_id: cashOrBankAccountId, debit_amount: data.amount, credit_amount: 0, description: `قبض من عميل - ${data.receipt_number}` },
                { account_id: customerAccount, debit_amount: 0, credit_amount: data.amount, description: `قبض من عميل - ${data.receipt_number}` },
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
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      toast.success(editingCollection ? "تم تحديث سند القبض بنجاح" : "تم إضافة سند القبض بنجاح");
      setIsAddOpen(false);
      setEditingCollection(null);
      resetForm();
    },
    onError: () => {
      toast.error("حدث خطأ، حاول مرة أخرى");
    }
  });

  const getCustomerAccount = async (customerId: string) => {
    const { data } = await supabase.from("customers").select("account_id").eq("id", customerId).single();
    return data?.account_id || null;
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("collections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      toast.success("تم حذف سند القبض بنجاح");
      setDeletingId(null);
    },
    onError: () => {
      toast.error("حدث خطأ، حاول مرة أخرى");
    }
  });

  const resetForm = () => {
    setFormData({
      receipt_number: "",
      receipt_date: new Date().toISOString().split('T')[0],
      customer_id: "",
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

  const handleEdit = (collection: any) => {
    setEditingCollection(collection);
    setFormData({
      receipt_number: collection.receipt_number,
      receipt_date: collection.receipt_date,
      customer_id: collection.customer_id,
      amount: collection.amount.toString(),
      payment_method: collection.payment_method,
      cash_box_id: collection.cash_box_id || "",
      bank_account_id: collection.bank_account_id || "",
      notes: collection.notes || ""
    });
    setIsAddOpen(true);
  };

  return (
    <div className="space-y-4">
      <ListPageHeader
        title="التحصيلات"
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "نظام المبيعات" },
          { label: "التحصيلات" },
        ]}
        showAdd={false}
        showSearch={false}
      />

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">سجل التحصيلات</h3>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">جاري التحميل...</div>
          ) : collections.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">لا توجد تحصيلات مسجلة</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم السند</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>العميل</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>طريقة الدفع</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collections.map((collection: any) => (
                  <TableRow key={collection.id}>
                    <TableCell>{collection.receipt_number}</TableCell>
                    <TableCell>{new Date(collection.receipt_date).toLocaleDateString('ar-SA')}</TableCell>
                    <TableCell>{collection.customers?.name}</TableCell>
                    <TableCell>{collection.amount} ر.س</TableCell>
                    <TableCell>{collection.payment_method}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(collection)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setDeletingId(collection.id)}>
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
