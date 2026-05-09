import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ListPageHeader } from "@/components/ListPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function VATDeclaration() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [from, setFrom] = useState(firstDay);
  const [to, setTo] = useState(lastDay);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["vat-declaration", from, to],
    queryFn: async () => {
      // Sales (output VAT) from sales invoices in date range
      const { data: salesInv } = await supabase
        .from("sales_invoices")
        .select("subtotal, tax_amount, status")
        .gte("invoice_date", from).lte("invoice_date", to)
        .neq("status", "draft");

      const { data: salesRet } = await supabase
        .from("sales_returns")
        .select("subtotal, tax_amount, status")
        .gte("return_date", from).lte("return_date", to)
        .eq("status", "confirmed");

      const { data: purchInv } = await supabase
        .from("purchase_invoices")
        .select("subtotal, tax_amount, status")
        .gte("invoice_date", from).lte("invoice_date", to)
        .neq("status", "draft");

      const { data: purchRet } = await supabase
        .from("purchase_returns")
        .select("subtotal, tax_amount, status")
        .gte("return_date", from).lte("return_date", to)
        .eq("status", "confirmed");

      const sumSales = (salesInv || []).reduce((a, b) => a + Number(b.subtotal || 0), 0);
      const vatSales = (salesInv || []).reduce((a, b) => a + Number(b.tax_amount || 0), 0);
      const sumSalesRet = (salesRet || []).reduce((a, b) => a + Number(b.subtotal || 0), 0);
      const vatSalesRet = (salesRet || []).reduce((a, b) => a + Number(b.tax_amount || 0), 0);

      const sumPurch = (purchInv || []).reduce((a, b) => a + Number(b.subtotal || 0), 0);
      const vatPurch = (purchInv || []).reduce((a, b) => a + Number(b.tax_amount || 0), 0);
      const sumPurchRet = (purchRet || []).reduce((a, b) => a + Number(b.subtotal || 0), 0);
      const vatPurchRet = (purchRet || []).reduce((a, b) => a + Number(b.tax_amount || 0), 0);

      const netOutput = vatSales - vatSalesRet;
      const netInput = vatPurch - vatPurchRet;
      const netVAT = netOutput - netInput;

      return {
        sales: { base: sumSales - sumSalesRet, vat: netOutput, raw: { gross: sumSales, ret: sumSalesRet, vatGross: vatSales, vatRet: vatSalesRet } },
        purchases: { base: sumPurch - sumPurchRet, vat: netInput, raw: { gross: sumPurch, ret: sumPurchRet, vatGross: vatPurch, vatRet: vatPurchRet } },
        net: netVAT,
      };
    },
  });

  return (
    <div className="space-y-4">
      <ListPageHeader
        title="الإقرار الضريبي (VAT)"
        breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "النظام المالي" }, { label: "الإقرار الضريبي" }]}
        showAdd={false}
        onRefresh={() => refetch()}
      />

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>من تاريخ</Label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>إلى تاريخ</Label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {isLoading ? <p className="text-center">جاري الحساب...</p> : data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">ضريبة المخرجات (مبيعات)</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{data.sales.vat.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground mt-1">قاعدة: {data.sales.base.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">ضريبة المدخلات (مشتريات)</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-secondary">{data.purchases.vat.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground mt-1">قاعدة: {data.purchases.base.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">صافي الضريبة المستحقة</CardTitle></CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${data.net >= 0 ? "text-destructive" : "text-green-600"}`}>
                  {Math.abs(data.net).toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {data.net >= 0 ? "مستحق دفعها للضريبة" : "مسترد من الضريبة"}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>التفاصيل</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>البند</TableHead>
                    <TableHead className="text-right">القاعدة الضريبية</TableHead>
                    <TableHead className="text-right">الضريبة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow><TableCell>إجمالي المبيعات</TableCell><TableCell className="text-right">{data.sales.raw.gross.toFixed(2)}</TableCell><TableCell className="text-right">{data.sales.raw.vatGross.toFixed(2)}</TableCell></TableRow>
                  <TableRow><TableCell>(-) مرتجعات المبيعات</TableCell><TableCell className="text-right">{data.sales.raw.ret.toFixed(2)}</TableCell><TableCell className="text-right">{data.sales.raw.vatRet.toFixed(2)}</TableCell></TableRow>
                  <TableRow className="font-bold bg-muted/50"><TableCell>صافي المبيعات (مخرجات)</TableCell><TableCell className="text-right">{data.sales.base.toFixed(2)}</TableCell><TableCell className="text-right">{data.sales.vat.toFixed(2)}</TableCell></TableRow>
                  <TableRow><TableCell>إجمالي المشتريات</TableCell><TableCell className="text-right">{data.purchases.raw.gross.toFixed(2)}</TableCell><TableCell className="text-right">{data.purchases.raw.vatGross.toFixed(2)}</TableCell></TableRow>
                  <TableRow><TableCell>(-) مرتجعات المشتريات</TableCell><TableCell className="text-right">{data.purchases.raw.ret.toFixed(2)}</TableCell><TableCell className="text-right">{data.purchases.raw.vatRet.toFixed(2)}</TableCell></TableRow>
                  <TableRow className="font-bold bg-muted/50"><TableCell>صافي المشتريات (مدخلات)</TableCell><TableCell className="text-right">{data.purchases.base.toFixed(2)}</TableCell><TableCell className="text-right">{data.purchases.vat.toFixed(2)}</TableCell></TableRow>
                  <TableRow className="font-bold bg-primary/10 text-lg"><TableCell colSpan={2}>صافي الضريبة المستحقة</TableCell><TableCell className="text-right">{data.net.toFixed(2)}</TableCell></TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
