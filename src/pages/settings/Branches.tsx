import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MapPin, Plus, Edit, Trash2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ListPageHeader } from "@/components/ListPageHeader";

export default function Branches() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    address: "",
    phone: ""
  });
  const queryClient = useQueryClient();

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingBranch) {
        const { error } = await supabase
          .from("branches")
          .update(data)
          .eq("id", editingBranch.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("branches").insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      toast.success(editingBranch ? "تم تحديث الفرع بنجاح" : "تم إضافة الفرع بنجاح");
      setIsAddOpen(false);
      setEditingBranch(null);
      resetForm();
    },
    onError: () => {
      toast.error("حدث خطأ، حاول مرة أخرى");
    }
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
    }
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("branches").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      toast.success("تم تعطيل الفرع");
    },
    onError: (e: any) => toast.error(e?.message || "تعذر التعطيل"),
  });

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      address: "",
      phone: ""
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const handleEdit = (branch: any) => {
    setEditingBranch(branch);
    setFormData({
      code: branch.code,
      name: branch.name,
      address: branch.address || "",
      phone: branch.phone || ""
    });
    setIsAddOpen(true);
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
        showAdd={false}
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
                    <CardTitle>{branch.name}</CardTitle>
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
                <p className="text-sm text-muted-foreground">{branch.address}</p>
                <p className="text-sm text-muted-foreground">{branch.phone}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذا الفرع؟</AlertDialogDescription>
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
