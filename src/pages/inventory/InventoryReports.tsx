import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, FileText, Package, TrendingDown, Warehouse, Box } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function InventoryReports() {
  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ["products_report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, product_categories(name), units_of_measure(name)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch warehouses
  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses_report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch inventory movements
  const { data: movements = [] } = useQuery({
    queryKey: ["movements_report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_movements")
        .select("*, products(name), warehouses(name)")
        .order("movement_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["categories_report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_categories")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Low stock products
  const lowStockProducts = products.filter(p => 
    p.min_stock_level && p.min_stock_level > 0
  );

  const totalProductValue = products.reduce((sum, p) => sum + ((p.cost_price || 0) * 1), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">تقارير المخزون</h1>
        <p className="text-muted-foreground">التقارير التحليلية للمخزون</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الأصناف</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
            <p className="text-xs text-muted-foreground">صنف مسجل</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">المستودعات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{warehouses.length}</div>
            <p className="text-xs text-muted-foreground">مستودع نشط</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">الفئات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories.length}</div>
            <p className="text-xs text-muted-foreground">فئة منتجات</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">الحركات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{movements.length}</div>
            <p className="text-xs text-muted-foreground">حركة مخزنية</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="quantities" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="quantities">
            <Package className="h-4 w-4 ml-2" />
            الكميات الحالية
          </TabsTrigger>
          <TabsTrigger value="movements">
            <BarChart3 className="h-4 w-4 ml-2" />
            حركة الأصناف
          </TabsTrigger>
          <TabsTrigger value="low-stock">
            <TrendingDown className="h-4 w-4 ml-2" />
            الأصناف القاربة على النفاد
          </TabsTrigger>
          <TabsTrigger value="warehouses">
            <Warehouse className="h-4 w-4 ml-2" />
            تقرير المستودعات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quantities">
          <Card>
            <CardHeader>
              <CardTitle>تقرير الكميات الحالية</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الرمز</TableHead>
                    <TableHead>اسم الصنف</TableHead>
                    <TableHead>الفئة</TableHead>
                    <TableHead>الوحدة</TableHead>
                    <TableHead>سعر التكلفة</TableHead>
                    <TableHead>سعر البيع</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.length > 0 ? products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>{product.code}</TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>{product.product_categories?.name || '-'}</TableCell>
                      <TableCell>{product.units_of_measure?.name || '-'}</TableCell>
                      <TableCell>{product.cost_price?.toLocaleString()} ر.س</TableCell>
                      <TableCell>{product.selling_price?.toLocaleString()} ر.س</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        لا توجد أصناف مسجلة
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements">
          <Card>
            <CardHeader>
              <CardTitle>تقرير حركة الأصناف</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم الحركة</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الصنف</TableHead>
                    <TableHead>المستودع</TableHead>
                    <TableHead>الكمية</TableHead>
                    <TableHead>المرجع</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.length > 0 ? movements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell>{movement.movement_number}</TableCell>
                      <TableCell>{movement.movement_date}</TableCell>
                      <TableCell>{movement.products?.name || '-'}</TableCell>
                      <TableCell>{movement.warehouses?.name || '-'}</TableCell>
                      <TableCell className={movement.quantity > 0 ? 'text-green-600' : 'text-red-600'}>
                        {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                      </TableCell>
                      <TableCell>{movement.reference || '-'}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        لا توجد حركات مخزنية
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="low-stock">
          <Card>
            <CardHeader>
              <CardTitle>الأصناف القاربة على النفاد</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الرمز</TableHead>
                    <TableHead>اسم الصنف</TableHead>
                    <TableHead>الحد الأدنى</TableHead>
                    <TableHead>نقطة إعادة الطلب</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockProducts.length > 0 ? lowStockProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>{product.code}</TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>{product.min_stock_level}</TableCell>
                      <TableCell>{product.reorder_point || '-'}</TableCell>
                      <TableCell>
                        <span className="text-yellow-600 bg-yellow-100 px-2 py-1 rounded text-xs">
                          يحتاج مراجعة
                        </span>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        لا توجد أصناف قاربة على النفاد
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="warehouses">
          <Card>
            <CardHeader>
              <CardTitle>تقرير المستودعات</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الرمز</TableHead>
                    <TableHead>اسم المستودع</TableHead>
                    <TableHead>العنوان</TableHead>
                    <TableHead>طريقة التقييم</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {warehouses.length > 0 ? warehouses.map((warehouse) => (
                    <TableRow key={warehouse.id}>
                      <TableCell>{warehouse.code}</TableCell>
                      <TableCell>{warehouse.name}</TableCell>
                      <TableCell>{warehouse.address || '-'}</TableCell>
                      <TableCell>
                        {warehouse.valuation_method === 'fifo' && 'الوارد أولاً'}
                        {warehouse.valuation_method === 'lifo' && 'الوارد أخيراً'}
                        {warehouse.valuation_method === 'average' && 'المتوسط المرجح'}
                      </TableCell>
                      <TableCell>
                        <span className={warehouse.is_active ? "text-green-600" : "text-red-600"}>
                          {warehouse.is_active ? "نشط" : "غير نشط"}
                        </span>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        لا توجد مستودعات مسجلة
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
