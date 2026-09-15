import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListPageHeader } from "@/components/ListPageHeader";
import {
  AlertTriangle,
  ArrowLeftCircle,
  ClipboardCheck,
  DollarSign,
  Loader2,
  Package,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function Dashboard() {
  const navigate = useNavigate();
  const from = monthStart();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["executive-dashboard", from],
    queryFn: async () => {
      const [sales, purchases, collections, payments, cashBoxes, banks, products, drafts, loans, vouchers] =
        await Promise.all([
          supabase.from("sales_invoices").select("total_amount, paid_amount, invoice_date, status").gte("invoice_date", from),
          supabase.from("purchase_invoices").select("total_amount, paid_amount, invoice_date, status").gte("invoice_date", from),
          supabase.from("collections").select("amount, receipt_date").gte("receipt_date", from),
          supabase.from("payments").select("amount, payment_date").gte("payment_date", from),
          supabase.from("cash_boxes").select("id, name, current_balance"),
          supabase.from("bank_accounts").select("id, bank_name, current_balance"),
          supabase.from("products").select("id, name, code, min_stock_level, is_active").eq("is_active", true),
          supabase
            .from("sales_invoices")
            .select("id, invoice_number, invoice_date, total_amount, customers(name)")
            .eq("status", "draft")
            .order("invoice_date", { ascending: false })
            .limit(6),
          supabase.from("hr_loans").select("id").eq("status", "pending_approval"),
          supabase.from("hr_payment_vouchers").select("id").eq("status", "draft"),
        ]);

      const sum = (rows: any[] | null, key: string) =>
        (rows ?? []).reduce((s, r) => s + Number(r[key] ?? 0), 0);

      const salesTotal = sum(sales.data, "total_amount");
      const purchasesTotal = sum(purchases.data, "total_amount");
      const unpaidSales = (sales.data ?? []).reduce(
        (s, r: any) => s + (Number(r.total_amount ?? 0) - Number(r.paid_amount ?? 0)),
        0,
      );
      const unpaidPurchases = (purchases.data ?? []).reduce(
        (s, r: any) => s + (Number(r.total_amount ?? 0) - Number(r.paid_amount ?? 0)),
        0,
      );

      return {
        salesTotal,
        purchasesTotal,
        margin: salesTotal - purchasesTotal,
        collections: sum(collections.data, "amount"),
        payments: sum(payments.data, "amount"),
        unpaidSales,
        unpaidPurchases,
        cashTotal: sum(cashBoxes.data, "current_balance"),
        bankTotal: sum(banks.data, "current_balance"),
        cashBoxes: cashBoxes.data ?? [],
        banks: banks.data ?? [],
        productsCount: (products.data ?? []).length,
        draftInvoices: drafts.data ?? [],
        pendingApprovals: (loans.data ?? []).length + (vouchers.data ?? []).length,
      };
    },
  });

  const alerts = useMemo(() => {
    if (!data) return [];
    const list: { text: string; tone: "warn" | "info"; route: string }[] = [];
    if (data.pendingApprovals > 0)
      list.push({ text: `${data.pendingApprovals} مستند بانتظار موافقتك`, tone: "warn", route: "/approvals" });
    if (data.unpaidSales > 0)
      list.push({ text: `مستحقات على العملاء: ${fmt(data.unpaidSales)}`, tone: "info", route: "/finance/aging-report" });
    if (data.unpaidPurchases > 0)
      list.push({ text: `مستحقات للموردين: ${fmt(data.unpaidPurchases)}`, tone: "info", route: "/purchases/payments" });
    if (data.draftInvoices.length > 0)
      list.push({ text: `${data.draftInvoices.length} فاتورة مبيعات مسودة`, tone: "warn", route: "/sales/invoices" });
    return list;
  }, [data]);

  const kpis = data
    ? [
        { title: "مبيعات الشهر", value: fmt(data.salesTotal), icon: TrendingUp, tone: "text-green-600" },
        { title: "مشتريات الشهر", value: fmt(data.purchasesTotal), icon: TrendingDown, tone: "text-red-600" },
        { title: "الفارق (مبيعات - مشتريات)", value: fmt(data.margin), icon: DollarSign, tone: "text-primary" },
        { title: "النقد المتاح (صناديق + بنوك)", value: fmt(data.cashTotal + data.bankTotal), icon: Wallet, tone: "text-secondary" },
        { title: "تحصيلات الشهر", value: fmt(data.collections), icon: ShoppingCart, tone: "text-green-600" },
        { title: "مدفوعات الشهر", value: fmt(data.payments), icon: ShoppingCart, tone: "text-red-600" },
        { title: "الأصناف النشطة", value: fmt(data.productsCount), icon: Package, tone: "text-primary" },
        { title: "بانتظار الموافقة", value: fmt(data.pendingApprovals), icon: ClipboardCheck, tone: "text-amber-600" },
      ]
    : [];

  return (
    <div>
      <ListPageHeader
        title="لوحة التحكم التنفيذية"
        subtitle={`مؤشرات الفترة من ${from} حتى اليوم`}
        breadcrumbs={[{ label: "الرئيسية" }]}
        showAdd={false}
        showSearch={false}
        onRefresh={() => refetch()}
      />

      <div className="bg-card border border-t-0 rounded-b-lg p-4 space-y-5">
        {isLoading || !data ? (
          <Loader2 className="animate-spin mx-auto my-10" />
        ) : (
          <>
            {alerts.length > 0 && (
              <div className="grid gap-2 md:grid-cols-2">
                {alerts.map((a) => (
                  <button
                    key={a.text}
                    onClick={() => navigate(a.route)}
                    className={`flex items-center justify-between gap-2 rounded-[10px] border px-3 py-2 text-sm text-start hover:bg-muted/60 ${
                      a.tone === "warn" ? "border-amber-300 bg-amber-50/60" : "border-border"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      {a.text}
                    </span>
                    <ArrowLeftCircle className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {kpis.map((k) => (
                <Card key={k.title}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{k.title}</CardTitle>
                    <k.icon className={`h-5 w-5 ${k.tone}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{k.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">أرصدة الصناديق والبنوك</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الحساب</TableHead>
                        <TableHead>النوع</TableHead>
                        <TableHead>الرصيد</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        ...data.cashBoxes.map((c: any) => ({ id: c.id, name: c.name, type: "صندوق", bal: c.current_balance })),
                        ...data.banks.map((b: any) => ({ id: b.id, name: b.bank_name, type: "بنك", bal: b.current_balance })),
                      ].map((r) => (
                        <TableRow key={`${r.type}-${r.id}`}>
                          <TableCell>{r.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{r.type}</Badge>
                          </TableCell>
                          <TableCell className="font-bold">{fmt(Number(r.bal ?? 0))}</TableCell>
                        </TableRow>
                      ))}
                      {data.cashBoxes.length + data.banks.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                            لا توجد صناديق أو بنوك مسجلة
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">آخر فواتير المبيعات المسودة</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الرقم</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>العميل</TableHead>
                        <TableHead>الإجمالي</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.draftInvoices.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono">{r.invoice_number}</TableCell>
                          <TableCell>{r.invoice_date}</TableCell>
                          <TableCell>{r.customers?.name ?? "-"}</TableCell>
                          <TableCell>{fmt(Number(r.total_amount ?? 0))}</TableCell>
                        </TableRow>
                      ))}
                      {data.draftInvoices.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                            لا توجد فواتير مسودة
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/sales/invoices")}>
                    فتح فواتير المبيعات
                  </Button>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
