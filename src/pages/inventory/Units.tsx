import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListPageHeader } from "@/components/ListPageHeader";

export default function Units() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<any>(null);
  const [formData, setFormData] = useState({ code: "", name: "" });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: units = [], isLoading } = useQuery({
    queryKey: ["units_of_measure"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("units_of_measure")
        .select("*")
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  const unitMutation = useMutation({
    mutationFn: async (values: any) => {
      if (selectedUnit) {
        const { error } = await supabase
          .from("units_of_measure")
          .update(values)
          .eq("id", selectedUnit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("units_of_measure").insert([values]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units_of_measure"] });
      toast({
        title: selectedUnit ? "تم التحديث" : "تمت الإضافة",
        description: selectedUnit ? "تم تحديث الوحدة بنجاح" : "تمت إضافة الوحدة بنجاح",
      });
      setIsAddDialogOpen(false);
      setIsEditDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("units_of_measure").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units_of_measure"] });
      toast({ title: "تم الحذف", description: "تم حذف الوحدة بنجاح" });
      setIsDeleteDialogOpen(false);
    },
  });

  const resetForm = () => {
    setFormData({ code: "", name: "" });
    setSelectedUnit(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    unitMutation.mutate(formData);
  };

  return (
    <div className="space-y-4">
      <ListPageHeader
        title="وحدات القياس"
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "النظام المخزني" },
          { label: "وحدات القياس" },
        ]}
        showAdd={false}
        showSearch={false}
      />

      <Card>
        <CardHeader>
          <CardTitle>قائمة الوحدات</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
          ) : units.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الرمز</TableHead>
                  <TableHead>الاسم</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map((unit) => (
                  <TableRow key={unit.id}>
                    <TableCell>{unit.code}</TableCell>
                    <TableCell>{unit.name}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedUnit(unit);
                            setFormData({ code: unit.code, name: unit.name });
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedUnit(unit);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              لا توجد وحدات مسجلة
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل الوحدة</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="edit-code">رمز الوحدة</Label>
              <Input
                id="edit-code"
                value={formData.code}
                onChange={(e) => setFormData({...formData, code: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-name">اسم الوحدة</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
            </div>
            <Button type="submit" className="w-full">تحديث</Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف الوحدة "{selectedUnit?.name}" نهائياً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(selectedUnit?.id)}>
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
