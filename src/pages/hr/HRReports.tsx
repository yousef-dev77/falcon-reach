import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, FileBarChart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ListPageHeader } from "@/components/ListPageHeader";

export default function HRReports() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [totals, setTotals] = useState({ gross: 0, net: 0, gosi: 0, loans: 0 });

  const load = async () => {
    setLoading(true);
    const run = await supabase.from("hr_payroll_runs").select("id").eq("year", year).eq("month", month).maybeSingle();
    if (!run.data) { setData([]); setTotals({ gross: 0, net: 0, gosi: 0, loans: 0 }); setLoading(false); return; }
    const ps = await supabase.from("hr_payslips").select("*, employee:hr_employees(employee_number, full_name, department:hr_departments(name))").eq("payroll_run_id", run.data.id);
    const rows = ps.data || [];
    setData(rows);
    setTotals({
      gross: rows.reduce((s: number, r: any) => s + Number(r.gross_salary), 0),
      net: rows.reduce((s: number, r: any) => s + Number(r.net_salary), 0),
      gosi: rows.reduce((s: number, r: any) => s + Number(r.gosi_employee) + Number(r.gosi_employer), 0),
      loans: rows.reduce((s: number, r: any) => s + Number(r.loan_deduction), 0),
    });
    setLoading(false);
  };
  useEffect(() => { load(); }, [year, month]);

  return (
    <div>
      <ListPageHeader title="تقارير الموارد البشرية" breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "الموارد البشرية", href: "/hr" }, { label: "التقارير" }]} showAdd={false} onPrint={() => window.print()} onRefresh={load} showSearch={false} />
      <div className="bg-card border border-t-0 rounded-b-lg p-4 space-y-4">
        <div className="flex items-end gap-3">
          <div><Label>السنة</Label><Input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="w-24" /></div>
          <div><Label>الشهر</Label><Input type="number" min={1} max={12} value={month} onChange={e => setMonth(Number(e.target.value))} className="w-20" /></div>
          <Button onClick={load}><FileBarChart className="h-4 w-4 me-1" />عرض</Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardHeader className="pb-2"><CardTitle className="text-xs">إجمالي الرواتب</CardTitle></CardHeader><CardContent className="text-xl font-bold">{totals.gross.toLocaleString()}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-xs">صافي المستحق</CardTitle></CardHeader><CardContent className="text-xl font-bold text-green-600">{totals.net.toLocaleString()}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-xs">إجمالي التأمينات</CardTitle></CardHeader><CardContent className="text-xl font-bold">{totals.gosi.toLocaleString()}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-xs">استرداد سلف</CardTitle></CardHeader><CardContent className="text-xl font-bold">{totals.loans.toLocaleString()}</CardContent></Card>
        </div>

        <h3 className="font-bold">كشف رواتب الشهر {month}/{year}</h3>
        {loading ? <Loader2 className="animate-spin mx-auto" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>الرقم</TableHead><TableHead>الموظف</TableHead><TableHead>القسم</TableHead><TableHead>الأساسي</TableHead><TableHead>إجمالي</TableHead><TableHead>تأمينات</TableHead><TableHead>سلف</TableHead><TableHead>الصافي</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.employee?.employee_number}</TableCell>
                  <TableCell>{r.employee?.full_name}</TableCell>
                  <TableCell>{r.employee?.department?.name || "-"}</TableCell>
                  <TableCell>{Number(r.basic_salary).toLocaleString()}</TableCell>
                  <TableCell>{Number(r.gross_salary).toLocaleString()}</TableCell>
                  <TableCell>{Number(r.gosi_employee).toLocaleString()}</TableCell>
                  <TableCell>{Number(r.loan_deduction).toLocaleString()}</TableCell>
                  <TableCell className="font-bold text-green-600">{Number(r.net_salary).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {data.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">لا توجد بيانات لهذا الشهر</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
