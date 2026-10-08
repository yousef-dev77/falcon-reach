import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListPageHeader } from "@/components/ListPageHeader";
import { Loader2, Printer, Wallet, TrendingDown, HandCoins, CalendarDays } from "lucide-react";
import { toast } from "sonner";

const statusLabel = (s: string) => ({
  draft: "مسودة", pending_approval: "بانتظار الاعتماد", pending_disbursement: "بانتظار الصرف",
  active: "نشط", completed: "مسدَّد", cancelled: "ملغي",
  submitted: "مقدَّم", approved: "معتمد", rejected: "مرفوض",
} as Record<string, string>)[s] || s;

export default function EmployeeStatement() {
  const { id } = useParams();
  const today = new Date();
  const firstOfYear = new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10);
  const [from, setFrom] = useState(firstOfYear);
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const r = await (supabase as any).rpc("employee_statement", { _employee_id: id, _from: from, _to: to });
    if (r.error) toast.error(r.error.message); else setData(r.data);
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  const fmt = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const emp = data?.employee;
  const payslips = data?.payslips || [];
  const loans = data?.loans || [];
  const loanPayments = data?.loan_payments || [];
  const leaves = data?.leaves || [];
  const leaveDays = leaves.reduce((s: number, l: any) => s + Number(l.days_count || 0), 0);

  const kpis = [
    { label: "إجمالي الدخل", value: data?.summary?.total_earnings, icon: Wallet, tone: "text-foreground" },
    { label: "إجمالي الخصومات", value: data?.summary?.total_deductions, icon: TrendingDown, tone: "text-destructive" },
    { label: "صافي المقبوض", value: data?.summary?.total_net, icon: Wallet, tone: "text-primary" },
    { label: "قروض قائمة", value: data?.summary?.loans_remaining, icon: HandCoins, tone: "text-foreground" },
  ];

  return (
    <div>
      <ListPageHeader
        title={`كشف حساب موظف ${emp?.full_name ? "— " + emp.full_name : ""}`}
        breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "الموارد البشرية", href: "/hr" }, { label: "الموظفون", href: "/hr/employees" }, { label: "كشف حساب" }]}
        onRefresh={load} showSearch={false} showAdd={false} onPrint={() => window.print()}
      />
      <div className="bg-card border border-t-0 rounded-b-lg p-4 space-y-5 print:border-0">
        {/* الفترة */}
        <div className="flex items-end gap-3 flex-wrap print:hidden">
          <div><Label>من</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>إلى</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <Button onClick={load}>عرض</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 me-1" />طباعة</Button>
        </div>

        {loading && <Loader2 className="animate-spin mx-auto" />}

        {data && (
          <>
            {/* بطاقة تعريف الموظف */}
            <div className="rounded-[10px] border bg-muted/40 p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><div className="text-muted-foreground text-xs">الاسم</div><div className="font-semibold">{emp?.full_name || "—"}</div></div>
              <div><div className="text-muted-foreground text-xs">الرقم الوظيفي</div><div className="font-mono">{emp?.employee_number || "—"}</div></div>
              <div><div className="text-muted-foreground text-xs">القسم</div><div>{emp?.department_name || emp?.department?.name || "—"}</div></div>
              <div><div className="text-muted-foreground text-xs">المسمى الوظيفي</div><div>{emp?.job_title_name || emp?.job_title?.name || "—"}</div></div>
              <div><div className="text-muted-foreground text-xs">الفرع</div><div>{emp?.branch_name || emp?.branch?.name || "—"}</div></div>
              <div><div className="text-muted-foreground text-xs">تاريخ التعيين</div><div>{emp?.hire_date || "—"}</div></div>
              <div><div className="text-muted-foreground text-xs">الراتب الأساسي</div><div className="font-semibold">{fmt(emp?.basic_salary)}</div></div>
              <div><div className="text-muted-foreground text-xs">الفترة</div><div>{from} ← {to}</div></div>
            </div>

            {/* المؤشرات */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {kpis.map(k => (
                <div key={k.label} className="rounded-[10px] border p-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs"><k.icon className="h-4 w-4" />{k.label}</div>
                  <div className={`font-bold text-xl mt-1 ${k.tone}`}>{fmt(k.value)}</div>
                </div>
              ))}
            </div>

            <Tabs defaultValue="payslips" className="print:hidden">
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="payslips">الرواتب ({payslips.length})</TabsTrigger>
                <TabsTrigger value="loans">السلف والقروض ({loans.length})</TabsTrigger>
                <TabsTrigger value="payments">سجل السداد ({loanPayments.length})</TabsTrigger>
                <TabsTrigger value="leaves">الإجازات ({leaveDays} يوم)</TabsTrigger>
              </TabsList>

              <TabsContent value="payslips" className="mt-3">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>الفترة</TableHead><TableHead>رقم التشغيل</TableHead><TableHead>الأساسي</TableHead>
                    <TableHead>البدلات</TableHead><TableHead>الخصومات</TableHead><TableHead>تأمينات</TableHead>
                    <TableHead>قسط قرض</TableHead><TableHead>الصافي</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {payslips.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.month}/{p.year}</TableCell>
                        <TableCell className="font-mono text-xs">{p.run_number}</TableCell>
                        <TableCell>{fmt(p.basic_salary)}</TableCell>
                        <TableCell>{fmt(p.total_earnings)}</TableCell>
                        <TableCell className="text-destructive">{fmt(p.total_deductions)}</TableCell>
                        <TableCell>{fmt(p.gosi_employee)}</TableCell>
                        <TableCell>{fmt(p.loan_deduction)}</TableCell>
                        <TableCell className="font-bold">{fmt(p.net_salary)}</TableCell>
                      </TableRow>
                    ))}
                    {payslips.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">لا توجد قسائم في الفترة</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="loans" className="mt-3">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>الرقم</TableHead><TableHead>النوع</TableHead><TableHead>البدء</TableHead>
                    <TableHead>المبلغ</TableHead><TableHead>المسدد</TableHead><TableHead>المتبقي</TableHead><TableHead>الحالة</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {loans.map((l: any) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono">{l.loan_number}</TableCell>
                        <TableCell>{l.loan_type === "advance" ? "سلفة راتب" : "قرض"}</TableCell>
                        <TableCell>{l.start_date}</TableCell>
                        <TableCell>{fmt(l.total_amount)}</TableCell>
                        <TableCell>{fmt(l.paid_amount)}</TableCell>
                        <TableCell className="font-bold text-primary">{fmt(l.remaining_amount)}</TableCell>
                        <TableCell><Badge variant="outline">{statusLabel(l.status)}</Badge></TableCell>
                      </TableRow>
                    ))}
                    {loans.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">لا توجد سلف أو قروض</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="payments" className="mt-3">
                <Table>
                  <TableHeader><TableRow><TableHead>التاريخ</TableHead><TableHead>القرض</TableHead><TableHead>المبلغ</TableHead><TableHead>ملاحظات</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {loanPayments.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.payment_date}</TableCell>
                        <TableCell className="font-mono">{p.loan_number}</TableCell>
                        <TableCell className="font-semibold">{fmt(p.amount)}</TableCell>
                        <TableCell className="text-xs">{p.notes || "—"}</TableCell>
                      </TableRow>
                    ))}
                    {loanPayments.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">لا يوجد سداد يدوي</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="leaves" className="mt-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2"><CalendarDays className="h-4 w-4" />إجمالي أيام الإجازة في الفترة: <span className="font-bold text-foreground">{leaveDays}</span></div>
                <Table>
                  <TableHeader><TableRow><TableHead>النوع</TableHead><TableHead>من</TableHead><TableHead>إلى</TableHead><TableHead>الأيام</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {leaves.map((lr: any) => (
                      <TableRow key={lr.id}>
                        <TableCell>{lr.leave_type_name}</TableCell>
                        <TableCell>{lr.start_date}</TableCell>
                        <TableCell>{lr.end_date}</TableCell>
                        <TableCell>{lr.days_count}</TableCell>
                        <TableCell><Badge variant="outline">{statusLabel(lr.status)}</Badge></TableCell>
                      </TableRow>
                    ))}
                    {leaves.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا توجد إجازات</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>

            {/* نسخة الطباعة: كل الأقسام متتابعة */}
            <div className="hidden print:block space-y-6">
              <section>
                <h3 className="font-semibold mb-2">قسائم الرواتب</h3>
                <table className="w-full text-xs border-collapse [&_td]:border [&_th]:border [&_td]:p-1 [&_th]:p-1">
                  <thead><tr><th>الفترة</th><th>الأساسي</th><th>البدلات</th><th>الخصومات</th><th>تأمينات</th><th>قسط</th><th>الصافي</th></tr></thead>
                  <tbody>{payslips.map((p: any) => (
                    <tr key={p.id}><td>{p.month}/{p.year}</td><td>{fmt(p.basic_salary)}</td><td>{fmt(p.total_earnings)}</td><td>{fmt(p.total_deductions)}</td><td>{fmt(p.gosi_employee)}</td><td>{fmt(p.loan_deduction)}</td><td>{fmt(p.net_salary)}</td></tr>
                  ))}</tbody>
                </table>
              </section>
              <section>
                <h3 className="font-semibold mb-2">السلف والقروض</h3>
                <table className="w-full text-xs border-collapse [&_td]:border [&_th]:border [&_td]:p-1 [&_th]:p-1">
                  <thead><tr><th>الرقم</th><th>النوع</th><th>المبلغ</th><th>المسدد</th><th>المتبقي</th><th>الحالة</th></tr></thead>
                  <tbody>{loans.map((l: any) => (
                    <tr key={l.id}><td>{l.loan_number}</td><td>{l.loan_type === "advance" ? "سلفة راتب" : "قرض"}</td><td>{fmt(l.total_amount)}</td><td>{fmt(l.paid_amount)}</td><td>{fmt(l.remaining_amount)}</td><td>{statusLabel(l.status)}</td></tr>
                  ))}</tbody>
                </table>
              </section>
              <section>
                <h3 className="font-semibold mb-2">الإجازات ({leaveDays} يوم)</h3>
                <table className="w-full text-xs border-collapse [&_td]:border [&_th]:border [&_td]:p-1 [&_th]:p-1">
                  <thead><tr><th>النوع</th><th>من</th><th>إلى</th><th>الأيام</th><th>الحالة</th></tr></thead>
                  <tbody>{leaves.map((lr: any) => (
                    <tr key={lr.id}><td>{lr.leave_type_name}</td><td>{lr.start_date}</td><td>{lr.end_date}</td><td>{lr.days_count}</td><td>{statusLabel(lr.status)}</td></tr>
                  ))}</tbody>
                </table>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
