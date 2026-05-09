import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ListPageHeader } from "@/components/ListPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Calculator, CheckCircle } from "lucide-react";

export default function AssetDepreciation() {
  const qc = useQueryClient();
  const [selectedAsset, setSelectedAsset] = useState<string>("");

  const { data: assets = [] } = useQuery({
    queryKey: ["fixed-assets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fixed_assets").select("*").eq("status", "active").order("code");
      if (error) throw error;
      return data;
    },
  });

  const { data: schedule = [], refetch } = useQuery({
    queryKey: ["depreciation-schedule", selectedAsset],
    queryFn: async () => {
      if (!selectedAsset) return [];
      const { data, error } = await supabase
        .from("asset_depreciation_schedule")
        .select("*")
        .eq("asset_id", selectedAsset)
        .order("period_date");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedAsset,
  });

  const generate = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("generate_asset_depreciation_schedule", { _asset_id: selectedAsset });
      if (error) throw error;
      return data;
    },
    onSuccess: (count) => {
      toast.success(`تم توليد ${count} قيد إهلاك`);
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const post = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("post_asset_depreciation", { _schedule_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الترحيل");
      refetch();
      qc.invalidateQueries({ queryKey: ["fixed-assets"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const postAllDue = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const due = schedule.filter((s: any) => !s.is_posted && s.period_date <= today);
    if (due.length === 0) { toast.info("لا توجد قيود مستحقة"); return; }
    if (!confirm(`ترحيل ${due.length} قيد؟`)) return;
    for (const s of due) {
      try { await supabase.rpc("post_asset_depreciation", { _schedule_id: s.id }); } catch (e) { console.error(e); }
    }
    toast.success(`تم ترحيل ${due.length} قيد`);
    refetch();
  };

  const asset: any = assets.find((a: any) => a.id === selectedAsset);

  return (
    <div className="space-y-4">
      <ListPageHeader
        title="جدول إهلاك الأصول الثابتة"
        breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "النظام المالي" }, { label: "إهلاك الأصول" }]}
        showAdd={false}
        onRefresh={() => refetch()}
      />

      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-64">
            <label className="text-sm">اختر الأصل</label>
            <Select value={selectedAsset} onValueChange={setSelectedAsset}>
              <SelectTrigger><SelectValue placeholder="اختر أصل ثابت" /></SelectTrigger>
              <SelectContent>
                {assets.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {selectedAsset && (
            <>
              <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
                <Calculator className="me-2 h-4 w-4" />
                توليد جدول الإهلاك
              </Button>
              <Button variant="default" onClick={postAllDue}>
                <CheckCircle className="me-2 h-4 w-4" />
                ترحيل المستحق
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {asset && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardHeader><CardTitle className="text-xs">التكلفة</CardTitle></CardHeader><CardContent className="font-bold">{Number(asset.purchase_cost).toFixed(2)}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-xs">القيمة الحالية</CardTitle></CardHeader><CardContent className="font-bold text-primary">{Number(asset.current_value).toFixed(2)}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-xs">مجمع الإهلاك</CardTitle></CardHeader><CardContent className="font-bold text-destructive">{Number(asset.accumulated_depreciation).toFixed(2)}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-xs">العمر الإنتاجي</CardTitle></CardHeader><CardContent className="font-bold">{asset.useful_life_years} سنة</CardContent></Card>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الفترة</TableHead>
                <TableHead className="text-right">قيمة الإهلاك</TableHead>
                <TableHead className="text-right">المجمع</TableHead>
                <TableHead className="text-right">القيمة الدفترية</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>إجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedule.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center">لا يوجد جدول. اضغط "توليد"</TableCell></TableRow>
              ) : schedule.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell>{s.period_date}</TableCell>
                  <TableCell className="text-right">{Number(s.depreciation_amount).toFixed(2)}</TableCell>
                  <TableCell className="text-right">{Number(s.accumulated_amount).toFixed(2)}</TableCell>
                  <TableCell className="text-right">{Number(s.book_value).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={s.is_posted ? "default" : "secondary"}>
                      {s.is_posted ? "مرحّل" : "في انتظار"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {!s.is_posted && (
                      <Button size="sm" variant="outline" onClick={() => post.mutate(s.id)}>
                        ترحيل
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
