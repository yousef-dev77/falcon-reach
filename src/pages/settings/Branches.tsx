import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MapPin, Edit, Trash2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ListPageHeader } from "@/components/ListPageHeader";

export default function Branches() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ code: "", name: "", address: "", phone: "" });
  const queryClient = useQueryClient();

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingBranch) {
        const { error } = await supabase.from("branches").update(data).eq("id", editingBranch.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("branches").insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      toast.success(editingBranch ? "تم تحديث الفرع بنجاح" : "تم إضافة الفرع بنجاح");
      closeDialog();
    },
    onError: (e: any) => toast.error(e?.message || "حدث خطأ، حاول مرة أخرى"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("branches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      toast.success("تم حذف الفرع بنجاح");
      setDeletingId(null);
    },
    onError: (e: any) => {
      toast.error(e?.message || "تعذر الحذف");
      setDeletingId(null);
    },
  });

  const resetForm = () => setFormData({ code: "", name: "", address: "", phone: "" });

  const closeDialog = () => {
    setIsAddOpen(false);
    setEditingBranch(null);
    resetForm();
  };

  const handleAdd = () => {
    setEditingBranch(null);
    resetForm();
    setIsAddOpen(true);
  };

  const handleEdit = (branch: any) => {
    setEditingBranch(branch);
    setFormData({
      code: branch.code,
      name: branch.name,
      address: branch.address || "",
      phone: branch.phone || "",
    });
    setIsAddOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error("الرجاء إدخال الكود والاسم");
      return;
    }
    mutation.mutate(formData);
  };

  return (
    <div className="space-y-4">
      <ListPageHeader
        title="الفروع"
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "الإعدادات" },
          { label: "الفروع" },
        ]}
        onAdd={handleAdd}
        addLabel="إضافة فرع"
        showSearch={false}
      />

      {isLoading ? (
        <div className="text-center py-12">جاري التحميل...</div>
      ) : branches.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">لا توجد فروع مسجلة</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {branches.map((branch: any) => (
            <Card key={branch.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-6 w-6 text-primary" />
                    <div>
                      <CardTitle>{branch.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">كود: {branch.code}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(branch)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDeletingId(branch.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {branch.address && <p className="text-sm text-muted-foreground">{branch.address}</p>}
                {branch.phone && <p className="text-sm text-muted-foreground">{branch.phone}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isAddOpen} onOpenChange={(v) => (v ? setIsAddOpen(true) : closeDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBranch ? "تعديل الفرع" : "إضافة فرع جديد"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>كود الفرع *</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="مثال: BR001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>اسم الفرع *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="مثال: الفرع الرئيسي"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>العنوان</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>رقم الهاتف</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                إلغاء
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "جاري الحفظ..." : editingBranch ? "تحديث" : "إضافة"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذا الفرع؟ لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
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
