import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListPageHeader } from "@/components/ListPageHeader";
import { useSearchParams } from "react-router-dom";

export default function StockBalance() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialProduct = searchParams.get("product") || "";
  const [productFilter, setProductFilter] = useState(initialProduct);
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (productFilter) setSearchParams({ product: productFilter });
    else setSearchParams({});
  }, [productFilter]);

  const { data: balances = [], isLoading } = useQuery({
    queryKey: ["stock_balances"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("product_stock_balance").select("*");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products_active"],
    queryFn: async () => (await supabase.from("products").select("id,code,name,cost_price,min_stock_level,reorder_point,unit_id, units_of_measure(name)").eq("is_active", true)).data || [],
  });
  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => (await supabase.from("warehouses").select("*").eq("is_active", true)).data || [],
  });

  const productMap = Object.fromEntries(products.map((p: any) => [p.id, p]));
  const warehouseMap = Object.fromEntries(warehouses.map((w: any) => [w.id, w]));

  const filtered = balances.filter((b: any) => {
    if (productFilter && b.product_id !== productFilter) return false;
    if (warehouseFilter && b.warehouse_id !== warehouseFilter) return false;
    if (search) {
      const p = productMap[b.product_id];
      if (!p) return false;
      const s = search.toLowerCase();
      if (!p.code.toLowerCase().includes(s) && !p.name.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  // Product card (movement history) when single product selected
  const { data: movements = [] } = useQuery({
    queryKey: ["product_movements", productFilter, warehouseFilter],
    enabled: !!productFilter,
    queryFn: async () => {
      let q = supabase.from("inventory_movements").select("*, warehouses(name)").eq("product_id", productFilter).order("movement_date", { ascending: false }).order("created_at", { ascending: false });
      if (warehouseFilter) q = q.eq("warehouse_id", warehouseFilter);
      const { data } = await q;
      return data || [];
    },
  });

  const totalQty = filtered.reduce((s: number, b: any) => s + Number(b.quantity || 0), 0);
  const totalValue = filtered.reduce((s: number, b: any) => s + Number(b.stock_value || 0), 0);

  return (
    <div className="space-y-4">
      <ListPageHeader
        title="أرصدة المخزون وكرت الصنف"
        breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "النظام المخزني" }, { label: "الأرصدة" }]}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="بحث بالاسم/الكود..."
      />

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>الصنف</Label>
              <Select value={productFilter || "all"} onValueChange={(v) => setProductFilter(v === "all" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأصناف</SelectItem>
                  {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.code} - {p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المستودع</Label>
              <Select value={warehouseFilter || "all"} onValueChange={(v) => setWarehouseFilter(v === "all" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المستودعات</SelectItem>
                  {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="border rounded-lg p-3"><div className="text-xs text-muted-foreground">عدد الأسطر</div><div className="text-2xl font-bold">{filtered.length}</div></div>
            <div className="border rounded-lg p-3"><div className="text-xs text-muted-foreground">إجمالي الكمية</div><div className="text-2xl font-bold">{totalQty.toFixed(2)}</div></div>
            <div className="border rounded-lg p-3"><div className="text-xs text-muted-foreground">إجمالي القيمة</div><div className="text-2xl font-bold">{totalValue.toFixed(2)}</div></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-3">الأرصدة الحالية</h3>
          {isLoading ? <div className="text-center py-8">جاري التحميل...</div> :
            filtered.length === 0 ? <div className="text-center py-8 text-muted-foreground">لا توجد أرصدة</div> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الكود</TableHead>
                    <TableHead>الصنف</TableHead>
                    <TableHead>المستودع</TableHead>
                    <TableHead>الوحدة</TableHead>
                    <TableHead>الرصيد</TableHead>
                    <TableHead>متوسط التكلفة</TableHead>
                    <TableHead>قيمة المخزون</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((b: any, i: number) => {
                    const p = productMap[b.product_id];
                    const w = warehouseMap[b.warehouse_id];
                    const qty = Number(b.quantity || 0);
                    const min = Number(p?.min_stock_level || 0);
                    const reorder = Number(p?.reorder_point || 0);
                    const lowStock = min > 0 && qty <= min;
                    const reachedReorder = reorder > 0 && qty <= reorder;
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-mono">{p?.code || "-"}</TableCell>
                        <TableCell>{p?.name || "-"}</TableCell>
                        <TableCell>{w?.name || "-"}</TableCell>
                        <TableCell>{p?.units_of_measure?.name || "-"}</TableCell>
                        <TableCell className="font-semibold">{qty.toFixed(2)}</TableCell>
                        <TableCell>{Number(p?.cost_price || 0).toFixed(2)}</TableCell>
                        <TableCell>{Number(b.stock_value || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          {lowStock ? <Badge variant="destructive">منخفض</Badge> :
                           reachedReorder ? <Badge variant="secondary">إعادة طلب</Badge> :
                           <Badge>طبيعي</Badge>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
        </CardContent>
      </Card>

      {productFilter && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-3">كرت الصنف - حركة {productMap[productFilter]?.name}</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>رقم الحركة</TableHead>
                  <TableHead>المستودع</TableHead>
                  <TableHead>وارد</TableHead>
                  <TableHead>صادر</TableHead>
                  <TableHead>السعر</TableHead>
                  <TableHead>المرجع</TableHead>
                  <TableHead>ملاحظات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.movement_date}</TableCell>
                    <TableCell className="font-mono text-xs">{m.movement_number}</TableCell>
                    <TableCell>{m.warehouses?.name}</TableCell>
                    <TableCell className="text-success">{m.quantity > 0 ? Number(m.quantity).toFixed(2) : "-"}</TableCell>
                    <TableCell className="text-destructive">{m.quantity < 0 ? Math.abs(Number(m.quantity)).toFixed(2) : "-"}</TableCell>
                    <TableCell>{Number(m.unit_cost || 0).toFixed(2)}</TableCell>
                    <TableCell>{m.reference}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.notes}</TableCell>
                  </TableRow>
                ))}
                {movements.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">لا توجد حركات</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
