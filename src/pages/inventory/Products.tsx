import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { ListPageHeader } from "@/components/ListPageHeader";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Products() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    cost_price: "",
    selling_price: "",
    min_stock_level: "",
    category_id: "",
    supplier_id: "",
    unit_id: ""
  });
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, product_categories(name), suppliers(name), units_of_measure(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_categories").select("*").eq("is_active", true);
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

  const { data: units = [] } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data, error } = await supabase.from("units_of_measure").select("*").eq("is_active", true);
      if (error) throw error;
      return data;
    }
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingProduct) {
        const { error } = await supabase.from("products").update(data).eq("id", editingProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(editingProduct ? "تم تحديث المنتج بنجاح" : "تم إضافة المنتج بنجاح");
      setIsAddOpen(false);
      setEditingProduct(null);
      resetForm();
    },
    onError: () => {
      toast.error("حدث خطأ، حاول مرة أخرى");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("تم حذف المنتج بنجاح");
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
      description: "",
      cost_price: "",
      selling_price: "",
      min_stock_level: "",
      category_id: "",
      supplier_id: "",
      unit_id: ""
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      ...formData,
      cost_price: formData.cost_price ? parseFloat(formData.cost_price) : 0,
      selling_price: formData.selling_price ? parseFloat(formData.selling_price) : 0,
      min_stock_level: formData.min_stock_level ? parseFloat(formData.min_stock_level) : 0,
      category_id: formData.category_id || null,
      supplier_id: formData.supplier_id || null,
      unit_id: formData.unit_id || null
    });
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setFormData({
      code: product.code,
      name: product.name,
      description: product.description || "",
      cost_price: product.cost_price?.toString() || "",
      selling_price: product.selling_price?.toString() || "",
      min_stock_level: product.min_stock_level?.toString() || "",
      category_id: product.category_id || "",
      supplier_id: product.supplier_id || "",
      unit_id: product.unit_id || ""
    });
    setIsAddOpen(true);
  };

  const filteredProducts = products.filter((product: any) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <ListPageHeader
        title="الأصناف والمنتجات"
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "النظام المخزني" },
          { label: "الأصناف والمنتجات" },
        ]}
        onAdd={() => { setEditingProduct(null); resetForm(); setIsAddOpen(true); }}
        addLabel="إضافة صنف"
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ["products"] })}
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="بحث في الأصناف..."
      />
        <Dialog open={isAddOpen} onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) {
            setEditingProduct(null);
            resetForm();
          }
        }}>
          <div className="hidden"><DialogTrigger /></div>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editingProduct ? "تعديل منتج" : "إضافة منتج جديد"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>كود المنتج *</Label>
                  <Input required value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>اسم المنتج *</Label>
                  <Input required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>سعر التكلفة</Label>
                  <Input type="number" step="0.01" value={formData.cost_price} onChange={(e) => setFormData({...formData, cost_price: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>سعر البيع</Label>
                  <Input type="number" step="0.01" value={formData.selling_price} onChange={(e) => setFormData({...formData, selling_price: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>الحد الأدنى للمخزون</Label>
                  <Input type="number" value={formData.min_stock_level} onChange={(e) => setFormData({...formData, min_stock_level: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>الفئة</Label>
                  <Select value={formData.category_id} onValueChange={(value) => setFormData({...formData, category_id: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الفئة" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat: any) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>المورد</Label>
                  <Select value={formData.supplier_id} onValueChange={(value) => setFormData({...formData, supplier_id: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر المورد" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((sup: any) => (
                        <SelectItem key={sup.id} value={sup.id}>{sup.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>الوحدة</Label>
                  <Select value={formData.unit_id} onValueChange={(value) => setFormData({...formData, unit_id: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الوحدة" />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map((unit: any) => (
                        <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>الوصف</Label>
                <Input value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>إلغاء</Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "جاري الحفظ..." : "حفظ"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="ابحث عن صنف..." className="pr-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">جاري التحميل...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">لا توجد أصناف مسجلة</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الكود</TableHead>
                  <TableHead>الاسم</TableHead>
                  <TableHead>الفئة</TableHead>
                  <TableHead>سعر التكلفة</TableHead>
                  <TableHead>سعر البيع</TableHead>
                  <TableHead>المورد</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product: any) => (
                  <TableRow key={product.id}>
                    <TableCell>{product.code}</TableCell>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>{product.product_categories?.name}</TableCell>
                    <TableCell>{product.cost_price} ر.س</TableCell>
                    <TableCell>{product.selling_price} ر.س</TableCell>
                    <TableCell>{product.suppliers?.name}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(product)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setDeletingId(product.id)}>
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
            <AlertDialogDescription>هل أنت متأكد من حذف هذا المنتج؟</AlertDialogDescription>
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
