import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Trash2, Edit } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ListPageHeader } from "@/components/ListPageHeader";

export default function Movements() {
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMovement, setEditingMovement] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    movement_date: new Date().toISOString().split("T")[0],
    product_id: "",
    warehouse_id: "",
    quantity: "",
    unit_cost: "",
    reference: "",
    notes: "",
  });
  const queryClient = useQueryClient();

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["inventory_movements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_movements")
        .select("*, products(name, code), warehouses(name)")
        .order("movement_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products_active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses_active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouses").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const generateNumber = () => `MOV-${String(movements.length + 1).padStart(5, "0")}`;

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingMovement) {
        const { error } = await supabase.from("inventory_movements").update(data).eq("id", editingMovement.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("inventory_movements").insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_movements"] });
      toast.success(editingMovement ? "تم تحديث الحركة بنجاح" : "تم إضافة الحركة بنجاح");
      setIsDialogOpen(false);
      setEditingMovement(null);
      resetForm();
    },
    onError: () => toast.error("حدث خطأ، حاول مرة أخرى"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inventory_movements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_movements"] });
      toast.success("تم حذف الحركة بنجاح");
      setDeletingId(null);
    },
    onError: () => toast.error("حدث خطأ، حاول مرة أخرى"),
  });

  const resetForm = () => {
    setFormData({ movement_date: new Date().toISOString().split("T")[0], product_id: "", warehouse_id: "", quantity: "", unit_cost: "", reference: "", notes: "" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!formData.product_id || !formData.warehouse_id) { toast.error("اختر المنتج والمستودع"); return; }
    mutation.mutate({
      movement_number: editingMovement ? editingMovement.movement_number : generateNumber(),
      movement_date: formData.movement_date,
      product_id: formData.product_id,
      warehouse_id: formData.warehouse_id,
      quantity: parseFloat(formData.quantity) || 0,
      unit_cost: formData.unit_cost ? parseFloat(formData.unit_cost) : null,
      reference: formData.reference || null,
      notes: formData.notes || null,
      created_by: user.id,
    });
  };

  const handleEdit = (mov: any) => {
    setEditingMovement(mov);
    setFormData({
      movement_date: mov.movement_date,
      product_id: mov.product_id,
      warehouse_id: mov.warehouse_id,
      quantity: mov.quantity?.toString() || "",
      unit_cost: mov.unit_cost?.toString() || "",
      reference: mov.reference || "",
      notes: mov.notes || "",
    });
    setIsDialogOpen(true);
  };

  const filtered = movements.filter((m: any) =>
    m.movement_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.products?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const inCount = movements.filter((m: any) => (m.quantity || 0) > 0).length;
  const outCount = movements.filter((m: any) => (m.quantity || 0) < 0).length;

  return (
    <div className="space-y-4">
      <ListPageHeader
        title="الحركات المخزنية"
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "النظام المخزني" },
          { label: "الحركات المخزنية" },
        ]}
        onAdd={() => { resetForm(); setEditingMovement(null); setIsDialogOpen(true); }}
        addLabel="إضافة حركة"
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ["inventory_movements"] })}
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="بحث في الحركات..."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">إجمالي الحركات</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{movements.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">استلام (وارد)</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{inCount}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">صرف (صادر)</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">{outCount}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-12">جاري التحميل...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">لا توجد حركات مسجلة</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الحركة</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>المنتج</TableHead>
                  <TableHead>المستودع</TableHead>
                  <TableHead>الكمية</TableHead>
                  <TableHead>التكلفة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((mov: any) => (
                  <TableRow key={mov.id}>
                    <TableCell className="font-mono">{mov.movement_number}</TableCell>
                    <TableCell>{new Date(mov.movement_date).toLocaleDateString("ar-SA")}</TableCell>
                    <TableCell>{mov.products?.name}</TableCell>
                    <TableCell>{mov.warehouses?.name}</TableCell>
                    <TableCell className={Number(mov.quantity) >= 0 ? "text-green-600" : "text-red-600"}>{mov.quantity}</TableCell>
                    <TableCell>{mov.unit_cost || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(mov)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeletingId(mov.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { setEditingMovement(null); resetForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingMovement ? "تعديل حركة مخزنية" : "إضافة حركة مخزنية"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>التاريخ</Label>
                <Input type="date" value={formData.movement_date} onChange={e => setFormData({...formData, movement_date: e.target.value})} required />
              </div>
              <div>
                <Label>المرجع</Label>
                <Input value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})} />
              </div>
              <div>
                <Label>المنتج *</Label>
                <Select value={formData.product_id} onValueChange={v => setFormData({...formData, product_id: v})}>
                  <SelectTrigger><SelectValue placeholder="اختر المنتج" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>المستودع *</Label>
                <Select value={formData.warehouse_id} onValueChange={v => setFormData({...formData, warehouse_id: v})}>
                  <SelectTrigger><SelectValue placeholder="اختر المستودع" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>الكمية (+ وارد / - صادر)</Label>
                <Input type="number" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} required />
              </div>
              <div>
                <Label>تكلفة الوحدة</Label>
                <Input type="number" step="0.01" value={formData.unit_cost} onChange={e => setFormData({...formData, unit_cost: e.target.value})} />
              </div>
            </div>
            <div>
              <Label>ملاحظات</Label>
              <Textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "جاري الحفظ..." : editingMovement ? "تحديث" : "حفظ"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذه الحركة المخزنية؟</AlertDialogDescription>
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
