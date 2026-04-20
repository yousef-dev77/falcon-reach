import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Printer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface AccountStatementProps {
  type: "customer" | "supplier";
  partyId: string;
  partyName: string;
  partyCode?: string;
}

interface StatementRow {
  date: string;
  documentNumber: string;
  documentType: "invoice" | "voucher";
  description: string;
  debit: number;
  credit: number;
  balance: number;
  navigateTo?: string;
}

export function AccountStatement({ type, partyId, partyName, partyCode }: AccountStatementProps) {
  const navigate = useNavigate();
  const isCustomer = type === "customer";

  // الفواتير (مدين للعميل / دائن للمورد)
  const { data: invoices = [] } = useQuery({
    queryKey: [`${type}-invoices`, partyId],
    queryFn: async () => {
      if (isCustomer) {
        const { data, error } = await supabase
          .from("sales_invoices")
          .select("id, invoice_number, invoice_date, total_amount, paid_amount, status")
          .eq("customer_id", partyId)
          .neq("status", "draft")
          .order("invoice_date");
        if (error) throw error;
        return (data || []) as any[];
      } else {
        const { data, error } = await supabase
          .from("purchase_invoices")
          .select("id, invoice_number, invoice_date, total_amount, paid_amount, status")
          .eq("supplier_id", partyId)
          .neq("status", "draft")
          .order("invoice_date");
        if (error) throw error;
        return (data || []) as any[];
      }
    },
  });

  // السندات (دائن للعميل / مدين للمورد)
  const { data: vouchers = [] } = useQuery({
    queryKey: [`${type}-vouchers`, partyId],
    queryFn: async () => {
      if (isCustomer) {
        const { data, error } = await supabase
          .from("collections")
          .select("id, receipt_number, receipt_date, amount, payment_method, notes")
          .eq("customer_id", partyId)
          .order("receipt_date");
        if (error) throw error;
        return (data || []) as any[];
      } else {
        const { data, error } = await supabase
          .from("payments")
          .select("id, payment_number, payment_date, amount, payment_method, notes")
          .eq("supplier_id", partyId)
          .order("payment_date");
        if (error) throw error;
        return (data || []) as any[];
      }
    },
  });

  // دمج وترتيب وحساب الرصيد المتحرك
  const rows: StatementRow[] = [];
  let runningBalance = 0;

  const merged = [
    ...invoices.map((inv: any) => ({
      sortDate: inv.invoice_date,
      kind: "invoice" as const,
      data: inv,
    })),
    ...vouchers.map((v: any) => ({
      sortDate: isCustomer ? v.receipt_date : v.payment_date,
      kind: "voucher" as const,
      data: v,
    })),
  ].sort((a, b) => a.sortDate.localeCompare(b.sortDate));

  for (const item of merged) {
    if (item.kind === "invoice") {
      const amount = Number(item.data.total_amount || 0);
      // العميل: الفاتورة تزيد المديونية (مدين)؛ المورد: تزيد الدائنية (دائن)
      const debit = isCustomer ? amount : 0;
      const credit = isCustomer ? 0 : amount;
      runningBalance += isCustomer ? amount : -amount;
      rows.push({
        date: item.data.invoice_date,
        documentNumber: item.data.invoice_number,
        documentType: "invoice",
        description: `فاتورة ${isCustomer ? "مبيعات" : "مشتريات"}`,
        debit,
        credit,
        balance: runningBalance,
        navigateTo: isCustomer ? "/sales/invoices" : "/purchases/invoices",
      });
    } else {
      const amount = Number(item.data.amount || 0);
      const number = isCustomer ? item.data.receipt_number : item.data.payment_number;
      const date = isCustomer ? item.data.receipt_date : item.data.payment_date;
      // العميل: السند يقلل المديونية (دائن)؛ المورد: يقلل الدائنية (مدين)
      const debit = isCustomer ? 0 : amount;
      const credit = isCustomer ? amount : 0;
      runningBalance += isCustomer ? -amount : amount;
      rows.push({
        date,
        documentNumber: number,
        documentType: "voucher",
        description: isCustomer ? "سند قبض" : "سند صرف",
        debit,
        credit,
        balance: runningBalance,
        navigateTo: isCustomer ? "/sales/collections" : "/purchases/payments",
      });
    }
  }

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const finalBalance = totalDebit - totalCredit;
  const balanceLabel = isCustomer
    ? finalBalance >= 0 ? "مدين (مستحق على العميل)" : "دائن (دفعة مقدمة)"
    : finalBalance <= 0 ? "دائن (مستحق للمورد)" : "مدين (دفعة مقدمة)";

  const handlePrint = () => window.print();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
          <ArrowRight className="h-4 w-4" />
          رجوع
        </Button>
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" />
          طباعة
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">
                كشف حساب {isCustomer ? "العميل" : "المورد"}
              </CardTitle>
              <p className="text-muted-foreground mt-1">
                {partyCode && <span className="me-2">[{partyCode}]</span>}
                {partyName}
              </p>
            </div>
            <Badge variant={isCustomer ? "default" : "secondary"} className="text-base px-4 py-1">
              {isCustomer ? "عميل" : "مورد"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">إجمالي المدين</p>
                <p className="text-2xl font-bold text-primary">
                  {totalDebit.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-secondary/10 border-secondary/30">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">إجمالي الدائن</p>
                <p className="text-2xl font-bold text-secondary-foreground">
                  {totalCredit.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-accent/20 border-accent/40">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{balanceLabel}</p>
                <p className="text-2xl font-bold text-accent-foreground">
                  {Math.abs(finalBalance).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>التاريخ</TableHead>
                  <TableHead>المستند</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>البيان</TableHead>
                  <TableHead className="text-end">مدين</TableHead>
                  <TableHead className="text-end">دائن</TableHead>
                  <TableHead className="text-end">الرصيد</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      لا توجد حركات
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, i) => (
                    <TableRow key={i} className="hover:bg-muted/30">
                      <TableCell>{format(new Date(row.date), "yyyy-MM-dd")}</TableCell>
                      <TableCell className="font-mono font-medium">{row.documentNumber}</TableCell>
                      <TableCell>
                        <Badge variant={row.documentType === "invoice" ? "default" : "secondary"}>
                          {row.description}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.description}</TableCell>
                      <TableCell className="text-end font-mono">
                        {row.debit > 0 ? row.debit.toLocaleString() : "-"}
                      </TableCell>
                      <TableCell className="text-end font-mono">
                        {row.credit > 0 ? row.credit.toLocaleString() : "-"}
                      </TableCell>
                      <TableCell className="text-end font-mono font-bold">
                        {row.balance.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
