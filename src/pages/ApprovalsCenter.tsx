import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ListPageHeader } from "@/components/ListPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeftCircle, Loader2 } from "lucide-react";

type PendingItem = {
  id: string;
  group: string;
  number: string;
  date: string | null;
  party: string;
  amount: number | null;
  statusLabel: string;
  route: string;
};

const GROUPS = [
  { key: "hr_vouchers", label: "سندات صرف الموارد البشرية" },
  { key: "hr_loans", label: "السلف والقروض" },
  { key: "leaves", label: "طلبات الإجازة" },
  { key: "purchase_requests", label: "طلبات الشراء" },
  { key: "sales_invoices", label: "فواتير مبيعات مسودة" },
  { key: "purchase_invoices", label: "فواتير مشتريات مسودة" },
  { key: "inventory_vouchers", label: "سندات مخزنية مسودة" },
] as const;

export default function ApprovalsCenter() {
  const navigate = useNavigate();

  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ["approvals-center"],
    queryFn: async (): Promise<PendingItem[]> => {
      const [vouchers, loans, leaves, prs, si, pi, iv] = await Promise.all([
        supabase
          .from("hr_payment_vouchers")
          .select("id, voucher_number, voucher_date, amount, status, employee:hr_employees(full_name)")
          .eq("status", "draft")
          .order("voucher_date", { ascending: false }),
        supabase
          .from("hr_loans")
          .select("id, loan_number, start_date, total_amount, status, loan_type, employee:hr_employees(full_name)")
          .eq("status", "pending_approval")
          .order("start_date", { ascending: false }),
        supabase
          .from("hr_leave_requests")
          .select("id, request_number, start_date, days_count, status, employee:hr_employees(full_name)")
          .eq("status", "submitted")
          .order("start_date", { ascending: false }),
        supabase
          .from("purchase_requests")
          .select("id, request_number, request_date, status, department")
          .eq("status", "submitted")
          .order("request_date", { ascending: false }),
        supabase
          .from("sales_invoices")
          .select("id, invoice_number, invoice_date, total_amount, status, customers(name)")
          .eq("status", "draft")
          .order("invoice_date", { ascending: false })
          .limit(50),
        supabase
          .from("purchase_invoices")
          .select("id, invoice_number, invoice_date, total_amount, status, suppliers(name)")
          .eq("status", "draft")
          .order("invoice_date", { ascending: false })
          .limit(50),
        supabase
          .from("inventory_vouchers")
          .select("id, voucher_number, voucher_date, total_value, status, voucher_type")
          .eq("status", "draft")
          .order("voucher_date", { ascending: false })
          .limit(50),
      ]);

      const rows: PendingItem[] = [];
      (vouchers.data ?? []).forEach((r: any) =>
        rows.push({
          id: r.id,
          group: "hr_vouchers",
          number: r.voucher_number,
          date: r.voucher_date,
          party: r.employee?.full_name ?? "-",
          amount: Number(r.amount),
          statusLabel: "بانتظار الترحيل من المالية",
          route: "/finance/hr-vouchers",
        }),
      );
      (loans.data ?? []).forEach((r: any) =>
        rows.push({
          id: r.id,
          group: "hr_loans",
          number: r.loan_number,
          date: r.start_date,
          party: r.employee?.full_name ?? "-",
          amount: Number(r.total_amount),
          statusLabel: "بانتظار الاعتماد",
          route: r.loan_type === "advance" ? "/hr/salary-advances" : "/hr/loans",
        }),
      );
      (leaves.data ?? []).forEach((r: any) =>
        rows.push({
          id: r.id,
          group: "leaves",
          number: r.request_number,
          date: r.start_date,
          party: r.employee?.full_name ?? "-",
          amount: Number(r.days_count),
          statusLabel: "بانتظار الاعتماد",
          route: "/hr/leave-requests",
        }),
      );
      (prs.data ?? []).forEach((r: any) =>
        rows.push({
          id: r.id,
          group: "purchase_requests",
          number: r.request_number,
          date: r.request_date,
          party: r.department ?? "-",
          amount: null,
          statusLabel: "بانتظار الاعتماد",
          route: "/purchases/requests",
        }),
      );
      (si.data ?? []).forEach((r: any) =>
        rows.push({
          id: r.id,
          group: "sales_invoices",
          number: r.invoice_number,
          date: r.invoice_date,
          party: r.customers?.name ?? "-",
          amount: Number(r.total_amount),
          statusLabel: "بانتظار التأكيد",
          route: "/sales/invoices",
        }),
      );
      (pi.data ?? []).forEach((r: any) =>
        rows.push({
          id: r.id,
          group: "purchase_invoices",
          number: r.invoice_number,
          date: r.invoice_date,
          party: r.suppliers?.name ?? "-",
          amount: Number(r.total_amount),
          statusLabel: "بانتظار التأكيد",
          route: "/purchases/invoices",
        }),
      );
      (iv.data ?? []).forEach((r: any) =>
        rows.push({
          id: r.id,
          group: "inventory_vouchers",
          number: r.voucher_number,
          date: r.voucher_date,
          party: r.voucher_type,
          amount: Number(r.total_value),
          statusLabel: "بانتظار التأكيد",
          route: `/inventory/vouchers/${r.voucher_type}`,
        }),
      );
      return rows;
    },
  });

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach((i) => {
      map[i.group] = (map[i.group] ?? 0) + 1;
    });
    return map;
  }, [items]);

  const renderTable = (rows: PendingItem[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>الرقم</TableHead>
          <TableHead>التاريخ</TableHead>
          <TableHead>الجهة</TableHead>
          <TableHead>القيمة</TableHead>
          <TableHead>الحالة</TableHead>
          <TableHead>الشاشة</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
              لا يوجد شيء بانتظار الموافقة
            </TableCell>
          </TableRow>
        ) : (
          rows.map((r) => (
            <TableRow key={`${r.group}-${r.id}`}>
              <TableCell className="font-mono">{r.number}</TableCell>
              <TableCell>{r.date ?? "-"}</TableCell>
              <TableCell>{r.party}</TableCell>
              <TableCell>{r.amount === null ? "-" : r.amount.toLocaleString()}</TableCell>
              <TableCell>
                <Badge variant="secondary">{r.statusLabel}</Badge>
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate(r.route)}>
                  <ArrowLeftCircle className="h-4 w-4" />
                  فتح
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <div>
      <ListPageHeader
        title="مركز الإشعارات والموافقات"
        subtitle={`${items.length} مستند بانتظار إجراء`}
        breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "مركز الموافقات" }]}
        showAdd={false}
        showSearch={false}
        onRefresh={() => refetch()}
      />
      <div className="bg-card border border-t-0 rounded-b-lg p-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {GROUPS.map((g) => (
            <Card key={g.key}>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs">{g.label}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{counts[g.key] ?? 0}</CardContent>
            </Card>
          ))}
        </div>

        {isLoading ? (
          <Loader2 className="animate-spin mx-auto my-8" />
        ) : (
          <Tabs defaultValue="all">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="all">الكل ({items.length})</TabsTrigger>
              {GROUPS.map((g) => (
                <TabsTrigger key={g.key} value={g.key}>
                  {g.label} ({counts[g.key] ?? 0})
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="all">{renderTable(items)}</TabsContent>
            {GROUPS.map((g) => (
              <TabsContent key={g.key} value={g.key}>
                {renderTable(items.filter((i) => i.group === g.key))}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </div>
  );
}
