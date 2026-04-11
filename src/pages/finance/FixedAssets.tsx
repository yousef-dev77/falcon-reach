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
import { ListPageHeader } from "@/components/ListPageHeader";

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
    <div className="space-y-4">
      <ListPageHeader
        title="الأصول الثابتة"
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "النظام المالي" },
          { label: "الأصول الثابتة" },
        ]}
        showAdd={false}
        showSearch={false}
      />

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
