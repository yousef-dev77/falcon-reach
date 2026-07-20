import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListPageHeader } from "@/components/ListPageHeader";
import { Loader2, Printer } from "lucide-react";
import { toast } from "sonner";

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

  const fmt = (n: any) => Number(n || 0).toLocaleString();

  return (
    <div>
      <ListPageHeader
        title={`كشف حساب موظف ${data?.employee?.full_name ? "— " + data.employee.full_name : ""}`}
        breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "الموارد البشرية", href: "/hr" }, { label: "الموظفون", href: "/hr/employees" }, { label: "كشف حساب" }]}
        onRefresh={load} showSearch={false}
      />
      <div className="bg-card border border-t-0 rounded-b-lg p-4 space-y-4 print:border-0">
        <div className="flex items-end gap-3 flex-wrap print:hidden">
          <div><Label>من</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>إلى</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <Button onClick={load}>عرض</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 me-1" />طباعة</Button>
        </div>

        {loading && <Loader2 className="animate-spin mx-auto" />}
        {data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="rounded-md bg-muted p-3"><div className="text-muted-foreground">إجمالي الدخل</div><div className="font-bold text-lg">{fmt(data.summary.total_earnings)}</div></div>
              <div className="rounded-md bg-muted p-3"><div className="text-muted-foreground">إجمالي الخصومات</div><div className="font-bold text-lg text-destructive">{fmt(data.summary.total_deductions)}</div></div>
              <div className="rounded-md bg-muted p-3"><div className="text-muted-foreground">صافي مقبوض</div><div className="font-bold text-lg text-primary">{fmt(data.summary.total_net)}</div></div>
              <div className="rounded-md bg-muted p-3"><div className="text-muted-foreground">قروض قائمة</div><div className="font-bold text-lg">{fmt(data.summary.loans_remaining)}</div></div>
            </div>

            <section>
              <h3 className="font-semibold mb-2">قسائم الرواتب</h3>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>الفترة</TableHead><TableHead>رقم التشغيل</TableHead><TableHead>الأساسي</TableHead>
                  <TableHead>البدلات</TableHead><TableHead>الخصومات</TableHead><TableHead>تأمينات</TableHead>
                  <TableHead>قسط قرض</TableHead><TableHead>الصافي</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(data.payslips || []).map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.month}/{p.year}</TableCell>
                      <TableCell className="font-mono text-xs">{p.run_number}</TableCell>
                      <TableCell>{fmt(p.basic_salary)}</TableCell>
                      <TableCell>{fmt(p.total_earnings)}</TableCell>
                      <TableCell>{fmt(p.total_deductions)}</TableCell>
                      <TableCell>{fmt(p.gosi_employee)}</TableCell>
                      <TableCell>{fmt(p.loan_deduction)}</TableCell>
                      <TableCell className="font-bold">{fmt(p.net_salary)}</TableCell>
                    </TableRow>
                  ))}
                  {(data.payslips || []).length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">لا توجد قسائم</TableCell></TableRow>}
                </TableBody>
              </Table>
            </section>

            <section>
              <h3 className="font-semibold mb-2">القروض والسلف</h3>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>الرقم</TableHead><TableHead>النوع</TableHead><TableHead>البدء</TableHead>
                  <TableHead>المبلغ</TableHead><TableHead>المسدد</TableHead><TableHead>المتبقي</TableHead><TableHead>الحالة</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(data.loans || []).map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono">{l.loan_number}</TableCell>
                      <TableCell>{l.loan_type === "advance" ? "سلفة" : "قرض"}</TableCell>
                      <TableCell>{l.start_date}</TableCell>
                      <TableCell>{fmt(l.total_amount)}</TableCell>
                      <TableCell>{fmt(l.paid_amount)}</TableCell>
                      <TableCell className="font-bold text-primary">{fmt(l.remaining_amount)}</TableCell>
                      <TableCell>{l.status}</TableCell>
                    </TableRow>
                  ))}
                  {(data.loans || []).length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">لا توجد قروض</TableCell></TableRow>}
                </TableBody>
              </Table>
            </section>

            {(data.loan_payments || []).length > 0 && (
              <section>
                <h3 className="font-semibold mb-2">السداد اليدوي</h3>
                <Table>
                  <TableHeader><TableRow><TableHead>التاريخ</TableHead><TableHead>القرض</TableHead><TableHead>المبلغ</TableHead><TableHead>ملاحظات</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.loan_payments.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.payment_date}</TableCell>
                        <TableCell className="font-mono">{p.loan_number}</TableCell>
                        <TableCell className="font-semibold">{fmt(p.amount)}</TableCell>
                        <TableCell className="text-xs">{p.notes || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </section>
            )}

            <section>
              <h3 className="font-semibold mb-2">الإجازات في الفترة</h3>
              <Table>
                <TableHeader><TableRow><TableHead>النوع</TableHead><TableHead>من</TableHead><TableHead>إلى</TableHead><TableHead>الأيام</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(data.leaves || []).map((lr: any) => (
                    <TableRow key={lr.id}>
                      <TableCell>{lr.leave_type_name}</TableCell>
                      <TableCell>{lr.start_date}</TableCell>
                      <TableCell>{lr.end_date}</TableCell>
                      <TableCell>{lr.days_count}</TableCell>
                      <TableCell>{lr.status}</TableCell>
                    </TableRow>
                  ))}
                  {(data.leaves || []).length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">لا توجد إجازات</TableCell></TableRow>}
                </TableBody>
              </Table>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
