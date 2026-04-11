import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, UserPlus, Receipt } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListPageHeader } from "@/components/ListPageHeader";

export default function PurchaseReports() {
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers_report"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: purchaseInvoices = [] } = useQuery({
    queryKey: ["purchase_invoices_report"],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchase_invoices").select("*, suppliers(name)").order("invoice_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments_report"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("*, suppliers(name)").order("payment_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const totalPurchases = purchaseInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
  const totalPayments = payments.reduce((sum, pay) => sum + (pay.amount || 0), 0);
  const totalPaid = purchaseInvoices.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0);
  const totalUnpaid = totalPurchases - totalPaid;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">تقارير المشتريات</h1>
        <p className="text-muted-foreground">التقارير التحليلية للمشتريات</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">إجمالي المشتريات</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalPurchases.toLocaleString()} ر.س</div>
            <p className="text-xs text-muted-foreground">{purchaseInvoices.length} فاتورة</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">المدفوعات</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalPayments.toLocaleString()} ر.س</div>
            <p className="text-xs text-muted-foreground">{payments.length} سند</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">المستحق</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{totalUnpaid.toLocaleString()} ر.س</div>
            <p className="text-xs text-muted-foreground">غير مدفوع</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">الموردين</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{suppliers.length}</div>
            <p className="text-xs text-muted-foreground">مورد</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="suppliers" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="suppliers"><UserPlus className="h-4 w-4 ml-2" />الموردين</TabsTrigger>
          <TabsTrigger value="invoices"><Receipt className="h-4 w-4 ml-2" />الفواتير</TabsTrigger>
          <TabsTrigger value="payments"><CreditCard className="h-4 w-4 ml-2" />المدفوعات</TabsTrigger>
        </TabsList>

        <TabsContent value="suppliers">
          <Card>
            <CardHeader><CardTitle>قائمة الموردين</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الرمز</TableHead>
                    <TableHead>الاسم</TableHead>
                    <TableHead>الهاتف</TableHead>
                    <TableHead>شروط الدفع</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.length > 0 ? suppliers.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.code}</TableCell>
                      <TableCell>{s.name}</TableCell>
                      <TableCell>{s.phone || '-'}</TableCell>
                      <TableCell>{s.payment_terms} يوم</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">لا يوجد موردين</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <CardHeader><CardTitle>فواتير المشتريات</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم الفاتورة</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>المورد</TableHead>
                    <TableHead>الإجمالي</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseInvoices.length > 0 ? purchaseInvoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>{inv.invoice_number}</TableCell>
                      <TableCell>{inv.invoice_date}</TableCell>
                      <TableCell>{inv.suppliers?.name || '-'}</TableCell>
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

        <TabsContent value="payments">
          <Card>
            <CardHeader><CardTitle>المدفوعات</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم السند</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>المورد</TableHead>
                    <TableHead>المبلغ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length > 0 ? payments.map((pay) => (
                    <TableRow key={pay.id}>
                      <TableCell>{pay.payment_number}</TableCell>
                      <TableCell>{pay.payment_date}</TableCell>
                      <TableCell>{pay.suppliers?.name || '-'}</TableCell>
                      <TableCell>{pay.amount?.toLocaleString()} ر.س</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">لا توجد مدفوعات</TableCell></TableRow>
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
