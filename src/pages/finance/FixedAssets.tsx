import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Loader2, Archive } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";
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
  account_id: string | null;
  depreciation_account_id: string | null;
  expense_account_id: string | null;
  depreciation_start_date: string | null;
  branch_id: string | null;
};
type Acc = { id: string; code: string; name: string; account_type: string; parent_id: string | null };
const emptyForm = () => ({ code: "", name: "", description: "", category: "", purchase_date: new Date().toISOString().split("T")[0], purchase_cost: 0, useful_life_years: 5, salvage_value: 0, depreciation_method: "straight_line", location: "", status: "active", account_id: "", depreciation_account_id: "", expense_account_id: "", depreciation_start_date: "", branch_id: "" });

export default function FixedAssets() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<FixedAsset | null>(null);
  const [formData, setFormData] = useState(emptyForm());
  const [accounts, setAccounts] = useState<Acc[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetchAssets();
    supabase.from("accounts").select("id,code,name,account_type,parent_id").eq("is_active", true).order("code").then(({ data }) => {
      const all = (data || []) as Acc[];
      const parents = new Set(all.map((a) => a.parent_id).filter(Boolean));
      setAccounts(all.filter((a) => !parents.has(a.id)));
    });
    supabase.from("branches").select("id,name").eq("is_active", true).then(({ data }) => setBranches((data as any) || []));
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

    if (!formData.code || !formData.name) return toast.error("الرمز والاسم مطلوبان");
    if (formData.purchase_cost <= 0) return toast.error("التكلفة يجب أن تكون أكبر من صفر");
    if (formData.salvage_value >= formData.purchase_cost) return toast.error("قيمة الخردة يجب أن تكون أقل من التكلفة");
    if (!formData.depreciation_account_id || !formData.expense_account_id) return toast.error("حدد حساب مجمع الإهلاك وحساب مصروف الإهلاك");
    const keepAcc = editingAsset ? editingAsset.accumulated_depreciation : 0;
    const currentValue = formData.purchase_cost - keepAcc;

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
      accumulated_depreciation: keepAcc,
      account_id: formData.account_id || null,
      depreciation_account_id: formData.depreciation_account_id || null,
      expense_account_id: formData.expense_account_id || null,
      depreciation_start_date: formData.depreciation_start_date || null,
      branch_id: formData.branch_id || null,
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
        // إعادة احتساب جدول الإهلاك تلقائياً (الأقساط غير المرحّلة فقط)
        const { count } = await supabase.from("asset_depreciation_schedule").select("id", { count: "exact", head: true }).eq("asset_id", editingAsset.id);
        if (count) {
          const { error: gErr } = await supabase.rpc("generate_asset_depreciation_schedule", { _asset_id: editingAsset.id });
          if (gErr) toast.error(gErr.message); else toast.info("تمت إعادة احتساب جدول الإهلاك");
        }
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
      account_id: asset.account_id || "",
      depreciation_account_id: asset.depreciation_account_id || "",
      expense_account_id: asset.expense_account_id || "",
      depreciation_start_date: asset.depreciation_start_date || "",
      branch_id: asset.branch_id || "",
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData(emptyForm());
    setEditingAsset(null);
    setIsDialogOpen(false);
  };

  const [disposeAsset, setDisposeAsset] = useState<FixedAsset | null>(null);
  const [dsp, setDsp] = useState({ type: "sale", date: new Date().toISOString().split("T")[0], amount: 0, proceeds: "", gl: "", notes: "" });
  const openDispose = (a: FixedAsset) => {
    setDsp({ type: "sale", date: new Date().toISOString().split("T")[0], amount: 0, proceeds: "", gl: "", notes: "" });
    setDisposeAsset(a);
  };
  const submitDispose = async () => {
    if (!disposeAsset) return;
    if (!confirm("سيتم إقفال الأصل نهائياً وترحيل قيد الاستبعاد. متابعة؟")) return;
    const { error } = await supabase.rpc("dispose_fixed_asset", {
      _asset_id: disposeAsset.id, _disposal_date: dsp.date, _disposal_type: dsp.type,
      _amount: dsp.type === "scrap" ? 0 : dsp.amount,
      _proceeds_account_id: dsp.proceeds || null, _gain_loss_account_id: dsp.gl || null, _notes: dsp.notes || null,
    } as any);
    if (error) return toast.error(error.message);
    toast.success("تم استبعاد الأصل وترحيل القيد");
    setDisposeAsset(null);
    fetchAssets();
  };

  const set = (k: string, v: any) => setFormData((f) => ({ ...f, [k]: v }));
  const accSelect = (k: "account_id" | "depreciation_account_id" | "expense_account_id", label: string, types: string[]) => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Select value={(formData as any)[k] || undefined} onValueChange={(v) => set(k, v)}>
        <SelectTrigger><SelectValue placeholder="اختر الحساب" /></SelectTrigger>
        <SelectContent>
          {accounts.filter((a) => types.includes(a.account_type)).map((a) => (
            <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
  const monthly = calculateDepreciation(formData.purchase_cost, formData.salvage_value, formData.useful_life_years) / 12;

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
        onAdd={() => {
          resetForm();
          setIsDialogOpen(true);
        }}
        addLabel="أصل ثابت جديد"
        showSearch={false}
      />

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-4 text-sm space-y-1">
          <div className="font-semibold">طريقة العمل</div>
          <ol className="list-decimal ps-5 space-y-0.5 text-muted-foreground">
            <li>أنشئ الأصل هنا: التكلفة، العمر الإنتاجي، قيمة الخردة، وحسابات الأصل ومجمع الإهلاك ومصروف الإهلاك.</li>
            <li>انتقل إلى <Link to="/finance/asset-depreciation" className="text-primary underline">جدول الإهلاك</Link> واختر الأصل ثم "توليد جدول الإهلاك" (قسط شهري بالقسط الثابت).</li>
            <li>رحّل الأقساط المستحقة شهرياً: يُنشأ قيد (من ح/ مصروف الإهلاك إلى ح/ مجمع الإهلاك) وتنخفض القيمة الدفترية.</li>
          </ol>
        </CardContent>
      </Card>

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
            <div className="text-2xl font-bold">{totalAssetValue.toLocaleString()} ر.ي</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">القيمة الدفترية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCurrentValue.toLocaleString()} ر.ي</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">مجمع الإهلاك</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDepreciation.toLocaleString()} ر.ي</div>
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
                    <TableCell>{asset.purchase_cost.toLocaleString()} ر.ي</TableCell>
                    <TableCell>{asset.current_value.toLocaleString()} ر.ي</TableCell>
                    <TableCell>
                      <Badge variant={asset.status === "active" ? "default" : "secondary"}>
                        {asset.status === "active" && "نشط"}
                        {asset.status === "disposed" && "مستبعد"}
                        {asset.status === "under_maintenance" && "صيانة"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {asset.status !== "disposed" && (
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(asset)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {asset.status !== "disposed" && (
                          <Button variant="ghost" size="icon" title="استبعاد / بيع" onClick={() => openDispose(asset)}>
                            <Archive className="h-4 w-4 text-warning-strong" />
                          </Button>
                        )}
                        {asset.status !== "disposed" && asset.accumulated_depreciation === 0 && (
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(asset.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={(o) => (o ? setIsDialogOpen(true) : resetForm())}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingAsset ? "تعديل أصل ثابت" : "أصل ثابت جديد"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1"><Label>الرمز *</Label><Input value={formData.code} onChange={(e) => set("code", e.target.value)} /></div>
              <div className="space-y-1 md:col-span-2"><Label>اسم الأصل *</Label><Input value={formData.name} onChange={(e) => set("name", e.target.value)} /></div>
              <div className="space-y-1"><Label>الفئة</Label>
                <Select value={formData.category || undefined} onValueChange={(v) => set("category", v)}>
                  <SelectTrigger><SelectValue placeholder="اختر الفئة" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buildings">مباني</SelectItem><SelectItem value="vehicles">سيارات</SelectItem>
                    <SelectItem value="equipment">معدات</SelectItem><SelectItem value="furniture">أثاث</SelectItem>
                    <SelectItem value="computers">أجهزة حاسوب</SelectItem><SelectItem value="other">أخرى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>الفرع</Label>
                <Select value={formData.branch_id || undefined} onValueChange={(v) => set("branch_id", v)}>
                  <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                  <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>الموقع</Label><Input value={formData.location} onChange={(e) => set("location", e.target.value)} /></div>
              <div className="space-y-1"><Label>تاريخ الشراء *</Label><Input type="date" value={formData.purchase_date} onChange={(e) => set("purchase_date", e.target.value)} /></div>
              <div className="space-y-1"><Label>بداية الإهلاك</Label><Input type="date" value={formData.depreciation_start_date} onChange={(e) => set("depreciation_start_date", e.target.value)} /></div>
              <div className="space-y-1"><Label>الحالة</Label>
                <Select value={formData.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="active">نشط</SelectItem><SelectItem value="under_maintenance">صيانة</SelectItem>{formData.status === "disposed" && <SelectItem value="disposed">مستبعد</SelectItem>}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>التكلفة *</Label><Input type="number" min={0} step="0.01" value={formData.purchase_cost} onChange={(e) => set("purchase_cost", Number(e.target.value))} /></div>
              <div className="space-y-1"><Label>العمر الإنتاجي (سنوات) *</Label><Input type="number" min={1} value={formData.useful_life_years} onChange={(e) => set("useful_life_years", Number(e.target.value))} /></div>
              <div className="space-y-1"><Label>قيمة الخردة</Label><Input type="number" min={0} step="0.01" value={formData.salvage_value} onChange={(e) => set("salvage_value", Number(e.target.value))} /></div>
            </div>
            <div className="rounded-[10px] bg-muted p-3 text-sm">
              القسط الشهري المتوقع: <span className="font-bold">{monthly.toLocaleString(undefined, { maximumFractionDigits: 2 })} ر.ي</span> — السنوي: <span className="font-bold">{(monthly * 12).toLocaleString(undefined, { maximumFractionDigits: 2 })} ر.ي</span>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {accSelect("account_id", "حساب الأصل", ["asset"])}
              {accSelect("depreciation_account_id", "حساب مجمع الإهلاك *", ["asset", "liability"])}
              {accSelect("expense_account_id", "حساب مصروف الإهلاك *", ["expense"])}
            </div>
            <div className="space-y-1"><Label>الوصف</Label><Textarea value={formData.description} onChange={(e) => set("description", e.target.value)} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetForm}>إلغاء</Button>
              <Button type="submit">{editingAsset ? "حفظ التعديلات" : "حفظ الأصل"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!disposeAsset} onOpenChange={(o) => !o && setDisposeAsset(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>استبعاد / بيع الأصل: {disposeAsset?.name}</DialogTitle></DialogHeader>
          {disposeAsset && (() => {
            const book = disposeAsset.purchase_cost - disposeAsset.accumulated_depreciation;
            const amt = dsp.type === "scrap" ? 0 : dsp.amount;
            const gl = amt - book;
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-sm rounded-[10px] bg-muted p-3">
                  <div>التكلفة<div className="font-bold">{disposeAsset.purchase_cost.toLocaleString()}</div></div>
                  <div>مجمع الإهلاك<div className="font-bold">{disposeAsset.accumulated_depreciation.toLocaleString()}</div></div>
                  <div>القيمة الدفترية<div className="font-bold">{book.toLocaleString()}</div></div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1"><Label>نوع الاستبعاد</Label>
                    <Select value={dsp.type} onValueChange={(v) => setDsp({ ...dsp, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="sale">بيع</SelectItem><SelectItem value="scrap">تخريد / إتلاف</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label>تاريخ الاستبعاد</Label><Input type="date" value={dsp.date} onChange={(e) => setDsp({ ...dsp, date: e.target.value })} /></div>
                  {dsp.type === "sale" && <>
                    <div className="space-y-1"><Label>قيمة البيع</Label><Input type="number" min={0} value={dsp.amount} onChange={(e) => setDsp({ ...dsp, amount: Number(e.target.value) })} /></div>
                    <div className="space-y-1"><Label>حساب المتحصلات</Label>
                      <Select value={dsp.proceeds || undefined} onValueChange={(v) => setDsp({ ...dsp, proceeds: v })}>
                        <SelectTrigger><SelectValue placeholder="صندوق / بنك / مدين" /></SelectTrigger>
                        <SelectContent>{accounts.filter((a) => a.account_type === "asset").map((a) => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </>}
                  <div className="space-y-1 md:col-span-2"><Label>حساب أرباح/خسائر استبعاد الأصول</Label>
                    <Select value={dsp.gl || undefined} onValueChange={(v) => setDsp({ ...dsp, gl: v })}>
                      <SelectTrigger><SelectValue placeholder="اختر الحساب" /></SelectTrigger>
                      <SelectContent>{accounts.filter((a) => ["revenue", "expense"].includes(a.account_type)).map((a) => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 md:col-span-2"><Label>ملاحظات</Label><Textarea value={dsp.notes} onChange={(e) => setDsp({ ...dsp, notes: e.target.value })} /></div>
                </div>
                <div className={`rounded-[10px] p-3 text-sm font-semibold ${gl >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                  {gl === 0 ? "لا ربح ولا خسارة" : gl > 0 ? `ربح رأسمالي: ${gl.toLocaleString()} ر.ي` : `خسارة رأسمالية: ${(-gl).toLocaleString()} ر.ي`}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDisposeAsset(null)}>إلغاء</Button>
                  <Button variant="destructive" onClick={submitDispose}>تأكيد الاستبعاد وترحيل القيد</Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
