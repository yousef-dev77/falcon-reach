import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, TrendingUp, Users, Receipt } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SalesReports() {
  const { data: customers = [] } = useQuery({
    queryKey: ["customers_report"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: salesInvoices = [] } = useQuery({
    queryKey: ["sales_invoices_report"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales_invoices").select("*, customers(name)").order("invoice_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: collections = [] } = useQuery({
    queryKey: ["collections_report"],
    queryFn: async () => {
      const { data, error } = await supabase.from("collections").select("*, customers(name)").order("receipt_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const totalSales = salesInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
  const totalCollections = collections.reduce((sum, col) => sum + (col.amount || 0), 0);
  const totalPaid = salesInvoices.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0);
  const totalUnpaid = totalSales - totalPaid;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">تقارير المبيعات</h1>
        <p className="text-muted-foreground">التقارير التحليلية للمبيعات</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">إجمالي المبيعات</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalSales.toLocaleString()} ر.س</div>
            <p className="text-xs text-muted-foreground">{salesInvoices.length} فاتورة</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">التحصيلات</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalCollections.toLocaleString()} ر.س</div>
            <p className="text-xs text-muted-foreground">{collections.length} سند</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">المستحق</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{totalUnpaid.toLocaleString()} ر.س</div>
            <p className="text-xs text-muted-foreground">غير محصل</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">العملاء</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers.length}</div>
            <p className="text-xs text-muted-foreground">عميل</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="customers" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="customers"><Users className="h-4 w-4 ml-2" />العملاء</TabsTrigger>
          <TabsTrigger value="invoices"><Receipt className="h-4 w-4 ml-2" />الفواتير</TabsTrigger>
          <TabsTrigger value="collections"><DollarSign className="h-4 w-4 ml-2" />التحصيلات</TabsTrigger>
        </TabsList>

        <TabsContent value="customers">
          <Card>
            <CardHeader><CardTitle>قائمة العملاء</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الرمز</TableHead>
                    <TableHead>الاسم</TableHead>
                    <TableHead>الهاتف</TableHead>
                    <TableHead>الحد الائتماني</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.length > 0 ? customers.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.code}</TableCell>
                      <TableCell>{c.name}</TableCell>
                      <TableCell>{c.phone || '-'}</TableCell>
                      <TableCell>{c.credit_limit?.toLocaleString()} ر.س</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">لا يوجد عملاء</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <CardHeader><CardTitle>فواتير المبيعات</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم الفاتورة</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>العميل</TableHead>
                    <TableHead>الإجمالي</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesInvoices.length > 0 ? salesInvoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>{inv.invoice_number}</TableCell>
                      <TableCell>{inv.invoice_date}</TableCell>
                      <TableCell>{inv.customers?.name || '-'}</TableCell>
                      <TableCell>{inv.total_amount?.toLocaleString()} ر.س</TableCell>
                      <TableCell><span className={`px-2 py-1 rounded text-xs ${inv.status === 'paid' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>{inv.status === 'paid' ? 'مدفوعة' : inv.status}</span></TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">لا توجد فواتير</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="collections">
          <Card>
            <CardHeader><CardTitle>التحصيلات</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم السند</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>العميل</TableHead>
                    <TableHead>المبلغ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {collections.length > 0 ? collections.map((col) => (
                    <TableRow key={col.id}>
                      <TableCell>{col.receipt_number}</TableCell>
                      <TableCell>{col.receipt_date}</TableCell>
                      <TableCell>{col.customers?.name || '-'}</TableCell>
                      <TableCell>{col.amount?.toLocaleString()} ر.س</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">لا توجد تحصيلات</TableCell></TableRow>
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
