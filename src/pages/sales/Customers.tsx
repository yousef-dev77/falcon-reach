import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ListPageHeader } from "@/components/ListPageHeader";

export default function Customers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    email: "",
    phone: "",
    address: "",
    tax_number: "",
    credit_limit: "",
    payment_terms: "30"
  });
  const queryClient = useQueryClient();

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingCustomer) {
        const { error } = await supabase
          .from("customers")
          .update(data)
          .eq("id", editingCustomer.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success(editingCustomer ? "تم تحديث العميل بنجاح" : "تم إضافة العميل بنجاح");
      setIsAddOpen(false);
      setEditingCustomer(null);
      resetForm();
    },
    onError: () => {
      toast.error("حدث خطأ، حاول مرة أخرى");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("تم حذف العميل بنجاح");
      setDeletingId(null);
    },
    onError: () => {
      toast.error("حدث خطأ، حاول مرة أخرى");
    }
  });

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      email: "",
      phone: "",
      address: "",
      tax_number: "",
      credit_limit: "",
      payment_terms: "30"
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      ...formData,
      credit_limit: formData.credit_limit ? parseFloat(formData.credit_limit) : 0,
      payment_terms: parseInt(formData.payment_terms)
    });
  };

  const handleEdit = (customer: any) => {
    setEditingCustomer(customer);
    setFormData({
      code: customer.code,
      name: customer.name,
      email: customer.email || "",
      phone: customer.phone || "",
      address: customer.address || "",
      tax_number: customer.tax_number || "",
      credit_limit: customer.credit_limit?.toString() || "",
      payment_terms: customer.payment_terms?.toString() || "30"
    });
    setIsAddOpen(true);
  };

  const filteredCustomers = customers.filter((customer: any) =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <ListPageHeader
        title="العملاء"
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "نظام المبيعات" },
          { label: "العملاء" },
        ]}
        onAdd={() => { resetForm(); setEditingCustomer(null); setIsAddOpen(true); }}
        addLabel="إضافة عميل"
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ["customers"] })}
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="ابحث عن عميل..."
      />

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-12">جاري التحميل...</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">لا يوجد عملاء مسجلين</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الكود</TableHead>
                  <TableHead>الاسم</TableHead>
                  <TableHead>الهاتف</TableHead>
                  <TableHead>البريد الإلكتروني</TableHead>
                  <TableHead>حد الائتمان</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer: any) => (
                  <TableRow key={customer.id}>
                    <TableCell>{customer.code}</TableCell>
                    <TableCell>{customer.name}</TableCell>
                    <TableCell>{customer.phone}</TableCell>
                    <TableCell>{customer.email}</TableCell>
                    <TableCell>{customer.credit_limit} ر.س</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(customer)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setDeletingId(customer.id)}>
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

      <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) { setEditingCustomer(null); resetForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "تعديل عميل" : "إضافة عميل جديد"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>الكود</Label><Input value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} required /></div>
              <div><Label>الاسم</Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required /></div>
              <div><Label>الهاتف</Label><Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
              <div><Label>البريد الإلكتروني</Label><Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
              <div><Label>الرقم الضريبي</Label><Input value={formData.tax_number} onChange={e => setFormData({...formData, tax_number: e.target.value})} /></div>
              <div><Label>حد الائتمان</Label><Input type="number" value={formData.credit_limit} onChange={e => setFormData({...formData, credit_limit: e.target.value})} /></div>
              <div><Label>مدة السداد (يوم)</Label><Input type="number" value={formData.payment_terms} onChange={e => setFormData({...formData, payment_terms: e.target.value})} /></div>
            </div>
            <div><Label>العنوان</Label><Input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>إلغاء</Button>
              <Button type="submit">{editingCustomer ? "تحديث" : "حفظ"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذا العميل؟</AlertDialogDescription>
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
