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
        .select("*, customers(name)")
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

  const generateNumber = () => {
    const count = collections.length + 1;
    return `COL-${String(count).padStart(5, '0')}`;
  };

  const getCustomerAccount = async (customerId: string) => {
    const { data } = await supabase.from("customers").select("account_id").eq("id", customerId).single();
    return data?.account_id || null;
  };

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingCollection) {
        const { error } = await supabase.from("collections").update(data).eq("id", editingCollection.id);
        if (error) throw error;
      } else {
        const { data: newCol, error } = await supabase.from("collections").insert([{ ...data, created_by: user?.id }]).select().single();
        if (error) throw error;

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
          toast.warning("تم حفظ السند لكن لم يتم إنشاء القيد تلقائياً");
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      toast.success(editingCollection ? "تم تحديث سند القبض" : "تم إضافة سند القبض");
      closeDialog();
    },
    onError: () => toast.error("حدث خطأ، حاول مرة أخرى")
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
    onError: () => toast.error("حدث خطأ، حاول مرة أخرى")
  });

  const closeDialog = () => {
    setIsAddOpen(false);
    setEditingCollection(null);
  };

  const openAdd = () => {
    setEditingCollection(null);
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
    setIsAddOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customer_id) { toast.error("اختر العميل"); return; }
    if (!formData.amount || parseFloat(formData.amount) <= 0) { toast.error("أدخل المبلغ"); return; }
    if (formData.payment_method === "cash" && !formData.cash_box_id) { toast.error("اختر الصندوق"); return; }
    if (formData.payment_method !== "cash" && !formData.bank_account_id) { toast.error("اختر الحساب البنكي"); return; }

    mutation.mutate({
      receipt_number: formData.receipt_number,
      receipt_date: formData.receipt_date,
      customer_id: formData.customer_id,
      amount: parseFloat(formData.amount),
      payment_method: formData.payment_method,
      cash_box_id: formData.payment_method === "cash" ? formData.cash_box_id : null,
      bank_account_id: formData.payment_method !== "cash" ? formData.bank_account_id : null,
      notes: formData.notes || null
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
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collections.map((col: any) => (
                  <TableRow key={col.id}>
                    <TableCell className="font-mono">{col.receipt_number}</TableCell>
                    <TableCell>{new Date(col.receipt_date).toLocaleDateString('ar-SA')}</TableCell>
                    <TableCell>{col.customers?.name}</TableCell>
                    <TableCell>{Number(col.amount).toLocaleString()}</TableCell>
                    <TableCell>{paymentMethodLabels[col.payment_method] || col.payment_method}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(col)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeletingId(col.id)}>
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
            <DialogTitle>{editingCollection ? "تعديل سند القبض" : "إضافة سند قبض جديد"}</DialogTitle>
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
              <Select value={formData.customer_id} onValueChange={v => setFormData({...formData, customer_id: v})}>
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
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={closeDialog}>إلغاء</Button>
              <Button type="submit" disabled={mutation.isPending}>{editingCollection ? "تحديث" : "إضافة"}</Button>
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
