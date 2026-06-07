import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Printer, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ListPageHeader } from "@/components/ListPageHeader";

export default function PayrollDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [run, setRun] = useState<any>(null);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [r, p] = await Promise.all([
        supabase.from("hr_payroll_runs").select("*, branch:branches(name)").eq("id", id).maybeSingle(),
        supabase.from("hr_payslips").select("*, employee:hr_employees(employee_number, full_name)").eq("payroll_run_id", id),
      ]);
      setRun(r.data); setPayslips(p.data || []); setLoading(false);
    })();
  }, [id]);

  if (loading) return <Loader2 className="animate-spin mx-auto mt-12" />;
  if (!run) return <div className="p-4">تشغيل غير موجود</div>;

  return (
    <div>
      <ListPageHeader title={`كشف رواتب ${run.run_number}`} breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "الموارد البشرية", href: "/hr" }, { label: "الرواتب", href: "/hr/payroll" }, { label: run.run_number }]} showAdd={false} showSearch={false} onPrint={() => window.print()} extraActions={<Button variant="ghost" size="sm" onClick={() => navigate("/hr/payroll")}><ArrowRight className="h-4 w-4 me-1" />رجوع</Button>} />
      <div className="space-y-4 p-4 bg-card border border-t-0 rounded-b-lg">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card><CardHeader className="pb-2"><CardTitle className="text-xs">الفترة</CardTitle></CardHeader><CardContent className="text-lg font-bold">{run.month}/{run.year}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-xs">عدد الموظفين</CardTitle></CardHeader><CardContent className="text-lg font-bold">{run.employees_count}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-xs">إجمالي الراتب</CardTitle></CardHeader><CardContent className="text-lg font-bold">{Number(run.total_gross).toLocaleString()}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-xs">إجمالي الخصومات</CardTitle></CardHeader><CardContent className="text-lg font-bold">{(Number(run.total_deductions) + Number(run.total_gosi) + Number(run.total_loans)).toLocaleString()}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-xs">الصافي</CardTitle></CardHeader><CardContent className="text-lg font-bold text-green-600">{Number(run.total_net).toLocaleString()} ر.س</CardContent></Card>
        </div>
        <div className="flex items-center gap-2">
          الحالة: <Badge>{run.status}</Badge>
          {run.journal_entry_id && <Badge variant="outline">مرتبط بقيد محاسبي</Badge>}
        </div>

        <Table>
          <TableHeader><TableRow><TableHead>الرقم</TableHead><TableHead>الموظف</TableHead><TableHead>الأساسي</TableHead><TableHead>البدلات</TableHead><TableHead>الخصومات</TableHead><TableHead>تأمينات</TableHead><TableHead>سلف</TableHead><TableHead>الإجمالي</TableHead><TableHead>الصافي</TableHead></TableRow></TableHeader>
          <TableBody>
            {payslips.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-mono">{p.employee?.employee_number}</TableCell>
                <TableCell>{p.employee?.full_name}</TableCell>
                <TableCell>{Number(p.basic_salary).toLocaleString()}</TableCell>
                <TableCell>{Number(p.total_earnings).toLocaleString()}</TableCell>
                <TableCell>{Number(p.total_deductions).toLocaleString()}</TableCell>
                <TableCell>{Number(p.gosi_employee).toLocaleString()}</TableCell>
                <TableCell>{Number(p.loan_deduction).toLocaleString()}</TableCell>
                <TableCell>{Number(p.gross_salary).toLocaleString()}</TableCell>
                <TableCell className="font-bold text-green-600">{Number(p.net_salary).toLocaleString()}</TableCell>
              </TableRow>
            ))}
            {payslips.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">اضغط "حساب" أولاً</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
