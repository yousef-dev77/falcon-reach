import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Upload, Package, FileBarChart } from "lucide-react";
import { ListPageHeader } from "@/components/ListPageHeader";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const emptyForm = {
  code: "", name: "", description: "", notes: "",
  cost_price: "", selling_price: "", wholesale_price: "", retail_price: "",
  min_stock_level: "", max_stock_level: "", reorder_point: "",
  category_id: "", supplier_id: "", unit_id: "",
  barcode: "", image_url: "",
  is_service: false, track_inventory: true, is_active: true,
};

export default function Products() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>(emptyForm);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, product_categories(name), suppliers(name), units_of_measure(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("product_categories").select("*").eq("is_active", true)).data || [],
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => (await supabase.from("suppliers").select("*").eq("is_active", true)).data || [],
  });
  const { data: units = [] } = useQuery({
    queryKey: ["units"],
    queryFn: async () => (await supabase.from("units_of_measure").select("*").eq("is_active", true)).data || [],
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        cost_price: parseFloat(data.cost_price) || 0,
        selling_price: parseFloat(data.selling_price) || 0,
        wholesale_price: parseFloat(data.wholesale_price) || 0,
        retail_price: parseFloat(data.retail_price) || 0,
        min_stock_level: parseFloat(data.min_stock_level) || 0,
        max_stock_level: data.max_stock_level ? parseFloat(data.max_stock_level) : null,
        reorder_point: data.reorder_point ? parseFloat(data.reorder_point) : null,
        category_id: data.category_id || null,
        supplier_id: data.supplier_id || null,
        unit_id: data.unit_id || null,
        barcode: data.barcode || null,
        image_url: data.image_url || null,
      };
      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(editing ? "تم تحديث الصنف" : "تم إضافة الصنف");
      setIsOpen(false); setEditing(null); setFormData(emptyForm);
    },
    onError: (e: any) => toast.error(e.message || "حدث خطأ"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("تم الحذف");
      setDeletingId(null);
    },
    onError: (e: any) => toast.error(e.message || "حدث خطأ"),
  });

  const handleEdit = (p: any) => {
    setEditing(p);
    setFormData({
      ...emptyForm, ...p,
      cost_price: p.cost_price?.toString() || "",
      selling_price: p.selling_price?.toString() || "",
      wholesale_price: p.wholesale_price?.toString() || "",
      retail_price: p.retail_price?.toString() || "",
      min_stock_level: p.min_stock_level?.toString() || "",
      max_stock_level: p.max_stock_level?.toString() || "",
      reorder_point: p.reorder_point?.toString() || "",
      description: p.description || "", notes: p.notes || "",
      barcode: p.barcode || "", image_url: p.image_url || "",
      category_id: p.category_id || "", supplier_id: p.supplier_id || "", unit_id: p.unit_id || "",
    });
    setIsOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setFormData({ ...formData, image_url: data.publicUrl });
      toast.success("تم رفع الصورة");
    } catch (err: any) {
      toast.error(err.message || "فشل رفع الصورة");
    } finally {
      setUploading(false);
    }
  };

  const filtered = products.filter((p: any) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.barcode || "").includes(searchTerm)
  );

  return (
    <div className="space-y-4">
      <ListPageHeader
        title="الأصناف والمنتجات"
        breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "النظام المخزني" }, { label: "الأصناف" }]}
        onAdd={() => { setEditing(null); setFormData(emptyForm); setIsOpen(true); }}
        addLabel="إضافة صنف"
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ["products"] })}
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="بحث بالاسم/الكود/الباركود..."
      />

      <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) { setEditing(null); setFormData(emptyForm); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل صنف" : "صنف جديد"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(formData); }} className="space-y-4">
            <Tabs defaultValue="main" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="main">رئيسية</TabsTrigger>
                <TabsTrigger value="pricing">التسعير</TabsTrigger>
                <TabsTrigger value="inventory">المخزون</TabsTrigger>
                <TabsTrigger value="barcode">الباركود</TabsTrigger>
                <TabsTrigger value="image">الصورة</TabsTrigger>
              </TabsList>

              <TabsContent value="main" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>الكود *</Label><Input required value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} /></div>
                  <div className="space-y-2"><Label>الاسم *</Label><Input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                  <div className="space-y-2">
                    <Label>الفئة</Label>
                    <Select value={formData.category_id} onValueChange={(v) => setFormData({ ...formData, category_id: v })}>
                      <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                      <SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>الوحدة</Label>
                    <Select value={formData.unit_id} onValueChange={(v) => setFormData({ ...formData, unit_id: v })}>
                      <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                      <SelectContent>{units.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>المورد الرئيسي</Label>
                    <Select value={formData.supplier_id} onValueChange={(v) => setFormData({ ...formData, supplier_id: v })}>
                      <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                      <SelectContent>{suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-6 pt-6">
                    <div className="flex items-center gap-2"><Switch checked={formData.is_service} onCheckedChange={(v) => setFormData({ ...formData, is_service: v, track_inventory: v ? false : formData.track_inventory })} /><Label>خدمة</Label></div>
                    <div className="flex items-center gap-2"><Switch checked={formData.is_active} onCheckedChange={(v) => setFormData({ ...formData, is_active: v })} /><Label>نشط</Label></div>
                  </div>
                </div>
                <div className="space-y-2"><Label>الوصف</Label><Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
                <div className="space-y-2"><Label>ملاحظات</Label><Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} /></div>
              </TabsContent>

              <TabsContent value="pricing" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>سعر التكلفة (متوسط مرجح)</Label><Input type="number" step="0.01" value={formData.cost_price} onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })} /></div>
                  <div className="space-y-2"><Label>سعر البيع الافتراضي</Label><Input type="number" step="0.01" value={formData.selling_price} onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })} /></div>
                  <div className="space-y-2"><Label>سعر الجملة</Label><Input type="number" step="0.01" value={formData.wholesale_price} onChange={(e) => setFormData({ ...formData, wholesale_price: e.target.value })} /></div>
                  <div className="space-y-2"><Label>سعر التجزئة</Label><Input type="number" step="0.01" value={formData.retail_price} onChange={(e) => setFormData({ ...formData, retail_price: e.target.value })} /></div>
                </div>
              </TabsContent>

              <TabsContent value="inventory" className="space-y-4">
                <div className="flex items-center gap-2"><Switch checked={formData.track_inventory} onCheckedChange={(v) => setFormData({ ...formData, track_inventory: v })} disabled={formData.is_service} /><Label>تتبع المخزون</Label></div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>الحد الأدنى</Label><Input type="number" value={formData.min_stock_level} onChange={(e) => setFormData({ ...formData, min_stock_level: e.target.value })} /></div>
                  <div className="space-y-2"><Label>نقطة إعادة الطلب</Label><Input type="number" value={formData.reorder_point} onChange={(e) => setFormData({ ...formData, reorder_point: e.target.value })} /></div>
                  <div className="space-y-2"><Label>الحد الأقصى</Label><Input type="number" value={formData.max_stock_level} onChange={(e) => setFormData({ ...formData, max_stock_level: e.target.value })} /></div>
                </div>
              </TabsContent>

              <TabsContent value="barcode" className="space-y-4">
                <div className="space-y-2"><Label>الباركود</Label><Input value={formData.barcode} onChange={(e) => setFormData({ ...formData, barcode: e.target.value })} placeholder="EAN13 / UPC / كود مخصص" /></div>
              </TabsContent>

              <TabsContent value="image" className="space-y-4">
                {formData.image_url && <img src={formData.image_url} alt="" className="h-40 w-40 object-cover rounded-lg border" />}
                <div className="space-y-2">
                  <Label>صورة المنتج</Label>
                  <Input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                  {uploading && <p className="text-sm text-muted-foreground">جاري الرفع...</p>}
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "جاري الحفظ..." : "حفظ"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? <div className="text-center py-12">جاري التحميل...</div> :
            filtered.length === 0 ? <div className="text-center py-12 text-muted-foreground">لا توجد أصناف</div> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>صورة</TableHead>
                    <TableHead>الكود</TableHead>
                    <TableHead>الاسم</TableHead>
                    <TableHead>الباركود</TableHead>
                    <TableHead>الفئة</TableHead>
                    <TableHead>التكلفة</TableHead>
                    <TableHead>البيع</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.image_url ? <img src={p.image_url} className="h-10 w-10 object-cover rounded" /> : <div className="h-10 w-10 bg-muted rounded flex items-center justify-center"><Package className="h-4 w-4 text-muted-foreground" /></div>}</TableCell>
                      <TableCell className="font-mono">{p.code}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="font-mono text-xs">{p.barcode || "-"}</TableCell>
                      <TableCell>{p.product_categories?.name || "-"}</TableCell>
                      <TableCell>{Number(p.cost_price || 0).toFixed(2)}</TableCell>
                      <TableCell>{Number(p.selling_price || 0).toFixed(2)}</TableCell>
                      <TableCell>{p.is_service ? <Badge variant="secondary">خدمة</Badge> : <Badge>سلعة</Badge>}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" onClick={() => navigate(`/inventory/stock-balance?product=${p.id}`)} title="كرت الصنف"><FileBarChart className="h-4 w-4" /></Button>
                          <Button variant="outline" size="sm" onClick={() => handleEdit(p)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="outline" size="sm" onClick={() => setDeletingId(p.id)}><Trash2 className="h-4 w-4" /></Button>
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
          <AlertDialogHeader><AlertDialogTitle>تأكيد الحذف</AlertDialogTitle><AlertDialogDescription>هل أنت متأكد؟</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction onClick={() => deletingId && deleteMutation.mutate(deletingId)}>حذف</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
