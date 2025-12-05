import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

type FixedAsset = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  purchase_date: string;
  purchase_cost: number;
  useful_life_years: number;
  salvage_value: number;
  depreciation_method: string;
  accumulated_depreciation: number;
  current_value: number;
  location: string | null;
  status: string;
};

export default function FixedAssets() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<FixedAsset | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    category: "",
    purchase_date: new Date().toISOString().split("T")[0],
    purchase_cost: 0,
    useful_life_years: 5,
    salvage_value: 0,
    depreciation_method: "straight_line",
    location: "",
    status: "active",
  });

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("fixed_assets")
      .select("*")
      .order("code");

    if (error) {
      toast.error("خطأ في جلب الأصول الثابتة");
      console.error(error);
    } else {
      setAssets(data || []);
    }
    setLoading(false);
  };

  const calculateDepreciation = (cost: number, salvage: number, years: number) => {
    if (years <= 0) return 0;
    return (cost - salvage) / years;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("يجب تسجيل الدخول أولاً");
      return;
    }

    const currentValue = formData.purchase_cost - formData.salvage_value;

    const assetData = {
      code: formData.code,
      name: formData.name,
      description: formData.description || null,
      category: formData.category || null,
      purchase_date: formData.purchase_date,
      purchase_cost: formData.purchase_cost,
      useful_life_years: formData.useful_life_years,
      salvage_value: formData.salvage_value,
      depreciation_method: formData.depreciation_method,
      location: formData.location || null,
      status: formData.status,
      current_value: currentValue,
      accumulated_depreciation: 0,
    };

    if (editingAsset) {
      const { error } = await supabase
        .from("fixed_assets")
        .update(assetData)
        .eq("id", editingAsset.id);

      if (error) {
        toast.error("خطأ في تحديث الأصل");
        console.error(error);
      } else {
        toast.success("تم تحديث الأصل بنجاح");
        fetchAssets();
        resetForm();
      }
    } else {
      const { error } = await supabase.from("fixed_assets").insert({
        ...assetData,
        created_by: user.id,
      });

      if (error) {
        toast.error("خطأ في إضافة الأصل");
        console.error(error);
      } else {
        toast.success("تم إضافة الأصل بنجاح");
        fetchAssets();
        resetForm();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا الأصل؟")) return;

    const { error } = await supabase.from("fixed_assets").delete().eq("id", id);

    if (error) {
      toast.error("خطأ في حذف الأصل");
      console.error(error);
    } else {
      toast.success("تم حذف الأصل بنجاح");
      fetchAssets();
    }
  };

  const handleEdit = (asset: FixedAsset) => {
    setEditingAsset(asset);
    setFormData({
      code: asset.code,
      name: asset.name,
      description: asset.description || "",
      category: asset.category || "",
      purchase_date: asset.purchase_date,
      purchase_cost: asset.purchase_cost,
      useful_life_years: asset.useful_life_years,
      salvage_value: asset.salvage_value,
      depreciation_method: asset.depreciation_method,
      location: asset.location || "",
      status: asset.status,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      description: "",
      category: "",
      purchase_date: new Date().toISOString().split("T")[0],
      purchase_cost: 0,
      useful_life_years: 5,
      salvage_value: 0,
      depreciation_method: "straight_line",
      location: "",
      status: "active",
    });
    setEditingAsset(null);
    setIsDialogOpen(false);
  };

  const totalAssetValue = assets.reduce((sum, a) => sum + a.purchase_cost, 0);
  const totalCurrentValue = assets.reduce((sum, a) => sum + a.current_value, 0);
  const totalDepreciation = assets.reduce((sum, a) => sum + a.accumulated_depreciation, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">الأصول الثابتة</h1>
          <p className="text-muted-foreground">إدارة الأصول الثابتة والإهلاك</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90" onClick={() => resetForm()}>
              <Plus className="ml-2 h-4 w-4" />
              إضافة أصل ثابت
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingAsset ? "تعديل الأصل" : "إضافة أصل جديد"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>رمز الأصل</Label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>اسم الأصل</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>الوصف</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الفئة</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الفئة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buildings">مباني</SelectItem>
                      <SelectItem value="vehicles">سيارات</SelectItem>
                      <SelectItem value="equipment">معدات</SelectItem>
                      <SelectItem value="furniture">أثاث</SelectItem>
                      <SelectItem value="computers">أجهزة حاسوب</SelectItem>
                      <SelectItem value="other">أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>تاريخ الشراء</Label>
                  <Input
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>تكلفة الشراء</Label>
                  <Input
                    type="number"
                    value={formData.purchase_cost}
                    onChange={(e) => setFormData({ ...formData, purchase_cost: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>القيمة التخريدية</Label>
                  <Input
                    type="number"
                    value={formData.salvage_value}
                    onChange={(e) => setFormData({ ...formData, salvage_value: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>العمر الإنتاجي (سنوات)</Label>
                  <Input
                    type="number"
                    value={formData.useful_life_years}
                    onChange={(e) => setFormData({ ...formData, useful_life_years: parseInt(e.target.value) || 5 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>طريقة الإهلاك</Label>
                  <Select
                    value={formData.depreciation_method}
                    onValueChange={(value) => setFormData({ ...formData, depreciation_method: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="straight_line">القسط الثابت</SelectItem>
                      <SelectItem value="declining_balance">القسط المتناقص</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الموقع</Label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>الحالة</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">نشط</SelectItem>
                      <SelectItem value="disposed">مستبعد</SelectItem>
                      <SelectItem value="under_maintenance">تحت الصيانة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  الإهلاك السنوي:{" "}
                  <span className="font-bold">
                    {calculateDepreciation(formData.purchase_cost, formData.salvage_value, formData.useful_life_years).toLocaleString()} ر.س
                  </span>
                </p>
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  {editingAsset ? "تحديث" : "إضافة"}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  إلغاء
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">عدد الأصول</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assets.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">إجمالي التكلفة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAssetValue.toLocaleString()} ر.س</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">القيمة الدفترية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCurrentValue.toLocaleString()} ر.س</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">مجمع الإهلاك</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDepreciation.toLocaleString()} ر.س</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>سجل الأصول الثابتة</CardTitle>
        </CardHeader>
        <CardContent>
          {assets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              لا توجد أصول ثابتة مسجلة. ابدأ بإضافة أصل جديد.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الرمز</TableHead>
                  <TableHead>الاسم</TableHead>
                  <TableHead>الفئة</TableHead>
                  <TableHead>تاريخ الشراء</TableHead>
                  <TableHead>التكلفة</TableHead>
                  <TableHead>القيمة الحالية</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell className="font-medium">{asset.code}</TableCell>
                    <TableCell>{asset.name}</TableCell>
                    <TableCell>
                      {asset.category === "buildings" && "مباني"}
                      {asset.category === "vehicles" && "سيارات"}
                      {asset.category === "equipment" && "معدات"}
                      {asset.category === "furniture" && "أثاث"}
                      {asset.category === "computers" && "أجهزة حاسوب"}
                      {asset.category === "other" && "أخرى"}
                      {!asset.category && "-"}
                    </TableCell>
                    <TableCell>{format(new Date(asset.purchase_date), "yyyy/MM/dd")}</TableCell>
                    <TableCell>{asset.purchase_cost.toLocaleString()} ر.س</TableCell>
                    <TableCell>{asset.current_value.toLocaleString()} ر.س</TableCell>
                    <TableCell>
                      <Badge variant={asset.status === "active" ? "default" : "secondary"}>
                        {asset.status === "active" && "نشط"}
                        {asset.status === "disposed" && "مستبعد"}
                        {asset.status === "under_maintenance" && "صيانة"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(asset)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(asset.id)}>
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
    </div>
  );
}
