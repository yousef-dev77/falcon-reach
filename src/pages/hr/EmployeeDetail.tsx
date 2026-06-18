import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, ArrowRight, User, Phone, Mail, MapPin, Briefcase, Calendar, Wallet, FileText, GraduationCap, Target, TrendingUp, Building2, BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ListPageHeader } from "@/components/ListPageHeader";
import { format } from "date-fns";

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [emp, setEmp] = useState<any>(null);
  const [dept, setDept] = useState<any>(null);
  const [job, setJob] = useState<any>(null);
  const [branch, setBranch] = useState<any>(null);
  const [salary, setSalary] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [training, setTraining] = useState<any[]>([]);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    const e = await supabase.from("hr_employees").select("*").eq("id", id).maybeSingle();
    if (!e.data) { setLoading(false); return; }
    setEmp(e.data);
    const [d, j, b, st, lr, lb, at, ln, dc, ct, rv, tr, ps] = await Promise.all([
      e.data.department_id ? supabase.from("hr_departments").select("*").eq("id", e.data.department_id).maybeSingle() : Promise.resolve({ data: null }),
      e.data.job_title_id ? supabase.from("hr_job_titles").select("*").eq("id", e.data.job_title_id).maybeSingle() : Promise.resolve({ data: null }),
      e.data.branch_id ? supabase.from("branches").select("*").eq("id", e.data.branch_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("hr_employee_salary_structure").select("*, hr_salary_components(name, component_type)").eq("employee_id", id),
      supabase.from("hr_leave_requests").select("*, hr_leave_types(name)").eq("employee_id", id).order("start_date", { ascending: false }).limit(20),
      supabase.from("hr_leave_balances").select("*, hr_leave_types(name)").eq("employee_id", id),
      supabase.from("hr_attendance").select("*").eq("employee_id", id).order("attendance_date", { ascending: false }).limit(30),
      supabase.from("hr_loans").select("*").eq("employee_id", id).order("created_at", { ascending: false }),
      supabase.from("hr_employee_documents").select("*").eq("employee_id", id),
      supabase.from("hr_contracts").select("*").eq("employee_id", id).order("start_date", { ascending: false }),
      supabase.from("hr_performance_reviews").select("*, hr_performance_cycles(cycle_name)").eq("employee_id", id).order("review_date", { ascending: false }),
      supabase.from("hr_training_attendees").select("*, hr_training_sessions(start_date, end_date, hr_training_programs(program_name))").eq("employee_id", id),
      supabase.from("hr_payslips").select("*, hr_payroll_runs(year, month, run_number)").eq("employee_id", id).order("created_at", { ascending: false }).limit(12),
    ]);
    setDept(d.data); setJob(j.data); setBranch(b.data);
    setSalary(st.data || []); setLeaves(lr.data || []); setBalances(lb.data || []);
    setAttendance(at.data || []); setLoans(ln.data || []); setDocs(dc.data || []);
    setContracts(ct.data || []); setReviews(rv.data || []); setTraining(tr.data || []); setPayslips(ps.data || []);
    setLoading(false);
  };
  useEffect(() => { if (id) fetch(); }, [id]);

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;
  if (!emp) return <div className="p-8 text-center">الموظف غير موجود</div>;

  const initials = emp.full_name?.split(" ").slice(0, 2).map((s: string) => s[0]).join("") || "؟";

  return (
    <div className="space-y-4">
      <ListPageHeader
        title={`ملف الموظف: ${emp.full_name}`}
        breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "الموارد البشرية", href: "/hr" }, { label: "الموظفين", href: "/hr/employees" }, { label: emp.full_name }]}
        showAdd={false}
        showSearch={false}
      />
      <div className="px-4">
        <Button variant="outline" onClick={() => navigate("/hr/employees")}><ArrowRight className="me-2 h-4 w-4" />رجوع</Button>
      </div>

      {/* Employee Card Header */}
      <Card className="mx-4">
        <CardContent className="p-6">
          <div className="flex items-start gap-4 flex-wrap">
            <Avatar className="h-24 w-24 bg-primary/10">
              <AvatarFallback className="text-2xl bg-primary text-primary-foreground">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-[260px]">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-bold">{emp.full_name}</h2>
                <Badge variant={emp.is_active ? "default" : "secondary"}>{emp.is_active ? "نشط" : "موقوف"}</Badge>
                {emp.is_subject_to_gosi && <Badge variant="outline" className="gap-1"><BadgeCheck className="h-3 w-3" />GOSI</Badge>}
              </div>
              <p className="text-muted-foreground font-mono">{emp.employee_number}</p>
              {emp.full_name_en && <p className="text-sm text-muted-foreground">{emp.full_name_en}</p>}
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="flex items-center gap-1"><Briefcase className="h-4 w-4 text-muted-foreground" />{job?.name || "—"}</div>
                <div className="flex items-center gap-1"><Building2 className="h-4 w-4 text-muted-foreground" />{dept?.name || "—"}</div>
                <div className="flex items-center gap-1"><MapPin className="h-4 w-4 text-muted-foreground" />{branch?.name || "—"}</div>
                <div className="flex items-center gap-1"><Calendar className="h-4 w-4 text-muted-foreground" />تعيين: {format(new Date(emp.hire_date), "yyyy/MM/dd")}</div>
                {emp.phone && <div className="flex items-center gap-1"><Phone className="h-4 w-4 text-muted-foreground" />{emp.phone}</div>}
                {emp.email && <div className="flex items-center gap-1"><Mail className="h-4 w-4 text-muted-foreground" />{emp.email}</div>}
                <div className="flex items-center gap-1"><Wallet className="h-4 w-4 text-muted-foreground" />{Number(emp.basic_salary).toLocaleString()} ر.س</div>
                <div className="flex items-center gap-1"><User className="h-4 w-4 text-muted-foreground" />{emp.nationality || "—"}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="info" className="px-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="info"><User className="me-2 h-4 w-4" />معلومات</TabsTrigger>
          <TabsTrigger value="salary"><Wallet className="me-2 h-4 w-4" />الراتب</TabsTrigger>
          <TabsTrigger value="leaves"><Calendar className="me-2 h-4 w-4" />إجازات</TabsTrigger>
          <TabsTrigger value="attendance">حضور</TabsTrigger>
          <TabsTrigger value="loans">سلف</TabsTrigger>
          <TabsTrigger value="docs"><FileText className="me-2 h-4 w-4" />وثائق</TabsTrigger>
          <TabsTrigger value="contracts">عقود</TabsTrigger>
          <TabsTrigger value="reviews"><Target className="me-2 h-4 w-4" />تقييمات</TabsTrigger>
          <TabsTrigger value="training"><GraduationCap className="me-2 h-4 w-4" />تدريب</TabsTrigger>
          <TabsTrigger value="payslips">قسائم الراتب</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <Card><CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div><span className="font-medium text-muted-foreground">الهوية/الإقامة: </span>{emp.national_id || "—"}</div>
            <div><span className="font-medium text-muted-foreground">رقم GOSI: </span>{emp.gosi_number || "—"}</div>
            <div><span className="font-medium text-muted-foreground">الجنس: </span>{emp.gender === "male" ? "ذكر" : emp.gender === "female" ? "أنثى" : "—"}</div>
            <div><span className="font-medium text-muted-foreground">تاريخ الميلاد: </span>{emp.date_of_birth ? format(new Date(emp.date_of_birth), "yyyy/MM/dd") : "—"}</div>
            <div><span className="font-medium text-muted-foreground">العنوان: </span>{emp.address || "—"}</div>
            <div><span className="font-medium text-muted-foreground">البنك: </span>{emp.bank_name || "—"}</div>
            <div className="col-span-2"><span className="font-medium text-muted-foreground">IBAN: </span><span className="font-mono">{emp.bank_iban || "—"}</span></div>
            <div className="col-span-2"><span className="font-medium text-muted-foreground">ملاحظات: </span>{emp.notes || "—"}</div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="salary">
          <Card><CardHeader><CardTitle>هيكل الراتب</CardTitle></CardHeader><CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>المكوّن</TableHead><TableHead>النوع</TableHead><TableHead>المبلغ/النسبة</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader>
              <TableBody>
                {salary.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.hr_salary_components?.name}</TableCell>
                    <TableCell><Badge variant={s.hr_salary_components?.component_type === "earning" ? "default" : "secondary"}>{s.hr_salary_components?.component_type === "earning" ? "إضافة" : "خصم"}</Badge></TableCell>
                    <TableCell>{s.amount}</TableCell>
                    <TableCell><Badge variant={s.is_active ? "default" : "secondary"}>{s.is_active ? "نشط" : "موقوف"}</Badge></TableCell>
                  </TableRow>
                ))}
                {salary.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">لا توجد مكونات راتب</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="leaves">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card><CardHeader><CardTitle>أرصدة الإجازات</CardTitle></CardHeader><CardContent>
              {balances.map((b: any) => (
                <div key={b.id} className="flex justify-between border-b py-2">
                  <span>{b.hr_leave_types?.name}</span>
                  <span className="font-mono">{b.balance} يوم</span>
                </div>
              ))}
              {balances.length === 0 && <p className="text-muted-foreground text-center py-4">لا توجد أرصدة</p>}
            </CardContent></Card>
            <Card><CardHeader><CardTitle>طلبات الإجازات</CardTitle></CardHeader><CardContent>
              {leaves.map((l: any) => (
                <div key={l.id} className="border-b py-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{l.hr_leave_types?.name}</span>
                    <Badge variant={l.status === "approved" ? "default" : l.status === "rejected" ? "destructive" : "secondary"}>{l.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">{format(new Date(l.start_date), "yyyy/MM/dd")} → {format(new Date(l.end_date), "yyyy/MM/dd")} ({l.days_count} يوم)</div>
                </div>
              ))}
              {leaves.length === 0 && <p className="text-muted-foreground text-center py-4">لا توجد طلبات</p>}
            </CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="attendance">
          <Card><CardContent className="p-4">
            <Table>
              <TableHeader><TableRow><TableHead>التاريخ</TableHead><TableHead>الحالة</TableHead><TableHead>الدخول</TableHead><TableHead>الخروج</TableHead></TableRow></TableHeader>
              <TableBody>
                {attendance.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell>{format(new Date(a.attendance_date), "yyyy/MM/dd")}</TableCell>
                    <TableCell><Badge variant={a.status === "present" ? "default" : a.status === "absent" ? "destructive" : "secondary"}>{a.status}</Badge></TableCell>
                    <TableCell>{a.check_in || "—"}</TableCell>
                    <TableCell>{a.check_out || "—"}</TableCell>
                  </TableRow>
                ))}
                {attendance.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">لا توجد سجلات حضور</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="loans">
          <Card><CardContent className="p-4">
            <Table>
              <TableHeader><TableRow><TableHead>الرقم</TableHead><TableHead>المبلغ</TableHead><TableHead>المسدد</TableHead><TableHead>المتبقي</TableHead><TableHead>القسط</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader>
              <TableBody>
                {loans.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono">{l.loan_number}</TableCell>
                    <TableCell>{Number(l.loan_amount).toLocaleString()}</TableCell>
                    <TableCell>{Number(l.paid_amount).toLocaleString()}</TableCell>
                    <TableCell>{Number(l.remaining_amount).toLocaleString()}</TableCell>
                    <TableCell>{Number(l.installment_amount).toLocaleString()}</TableCell>
                    <TableCell><Badge variant={l.status === "active" ? "default" : "secondary"}>{l.status}</Badge></TableCell>
                  </TableRow>
                ))}
                {loans.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">لا توجد سلف</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="docs">
          <Card><CardContent className="p-4">
            <Table>
              <TableHeader><TableRow><TableHead>النوع</TableHead><TableHead>الرقم</TableHead><TableHead>الإصدار</TableHead><TableHead>الانتهاء</TableHead></TableRow></TableHeader>
              <TableBody>
                {docs.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.doc_type}</TableCell>
                    <TableCell className="font-mono">{d.doc_number}</TableCell>
                    <TableCell>{d.issue_date ? format(new Date(d.issue_date), "yyyy/MM/dd") : "—"}</TableCell>
                    <TableCell>{d.expiry_date ? format(new Date(d.expiry_date), "yyyy/MM/dd") : "—"}</TableCell>
                  </TableRow>
                ))}
                {docs.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">لا توجد وثائق</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="contracts">
          <Card><CardContent className="p-4">
            <Table>
              <TableHeader><TableRow><TableHead>الرقم</TableHead><TableHead>النوع</TableHead><TableHead>البداية</TableHead><TableHead>النهاية</TableHead><TableHead>الراتب</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader>
              <TableBody>
                {contracts.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono">{c.contract_number}</TableCell>
                    <TableCell>{c.contract_type}</TableCell>
                    <TableCell>{format(new Date(c.start_date), "yyyy/MM/dd")}</TableCell>
                    <TableCell>{c.end_date ? format(new Date(c.end_date), "yyyy/MM/dd") : "—"}</TableCell>
                    <TableCell>{Number(c.basic_salary).toLocaleString()}</TableCell>
                    <TableCell><Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
                  </TableRow>
                ))}
                {contracts.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">لا توجد عقود</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="reviews">
          <Card><CardContent className="p-4">
            <Table>
              <TableHeader><TableRow><TableHead>الدورة</TableHead><TableHead>التاريخ</TableHead><TableHead>الدرجة</TableHead><TableHead>التقدير</TableHead></TableRow></TableHeader>
              <TableBody>
                {reviews.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.hr_performance_cycles?.cycle_name}</TableCell>
                    <TableCell>{format(new Date(r.review_date), "yyyy/MM/dd")}</TableCell>
                    <TableCell className="font-mono">{r.overall_score || 0}%</TableCell>
                    <TableCell><Badge>{r.overall_rating}</Badge></TableCell>
                  </TableRow>
                ))}
                {reviews.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">لا توجد تقييمات</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="training">
          <Card><CardContent className="p-4">
            <Table>
              <TableHeader><TableRow><TableHead>البرنامج</TableHead><TableHead>الفترة</TableHead><TableHead>الحالة</TableHead><TableHead>الدرجة</TableHead></TableRow></TableHeader>
              <TableBody>
                {training.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.hr_training_sessions?.hr_training_programs?.program_name}</TableCell>
                    <TableCell className="text-xs">{t.hr_training_sessions?.start_date} → {t.hr_training_sessions?.end_date}</TableCell>
                    <TableCell><Badge>{t.attendance_status}</Badge></TableCell>
                    <TableCell>{t.score || "—"}</TableCell>
                  </TableRow>
                ))}
                {training.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">لا توجد دورات</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="payslips">
          <Card><CardContent className="p-4">
            <Table>
              <TableHeader><TableRow><TableHead>الشهر</TableHead><TableHead>الأساسي</TableHead><TableHead>الإضافات</TableHead><TableHead>الخصومات</TableHead><TableHead>GOSI</TableHead><TableHead>الصافي</TableHead></TableRow></TableHeader>
              <TableBody>
                {payslips.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.hr_payroll_runs?.year}/{p.hr_payroll_runs?.month}</TableCell>
                    <TableCell>{Number(p.basic_salary).toLocaleString()}</TableCell>
                    <TableCell>{Number(p.total_earnings).toLocaleString()}</TableCell>
                    <TableCell>{Number(p.total_deductions).toLocaleString()}</TableCell>
                    <TableCell>{Number(p.gosi_employee).toLocaleString()}</TableCell>
                    <TableCell className="font-bold text-primary">{Number(p.net_salary).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {payslips.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">لا توجد قسائم</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
