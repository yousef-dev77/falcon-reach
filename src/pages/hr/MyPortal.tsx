import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Wallet, Calendar, Clock, FileText, CreditCard, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ListPageHeader } from "@/components/ListPageHeader";
import { format } from "date-fns";

export default function MyPortal() {
  const { user } = useAuth();
  const [emp, setEmp] = useState<any>(null);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [reqOpen, setReqOpen] = useState(false);
  const [req, setReq] = useState({ leave_type_id: "", start_date: "", end_date: "", days_count: 1, reason: "" });

  const fetch = async () => {
    if (!user) return;
    setLoading(true);
    const e = await supabase.from("hr_employees").select("*").eq("user_id", user.id).maybeSingle();
    if (!e.data) { setLoading(false); return; }
    setEmp(e.data);
    const eid = e.data.id;
    const [ps, lb, lr, lt, at, dc, ln] = await Promise.all([
      supabase.from("hr_payslips").select("*, hr_payroll_runs(year, month)").eq("employee_id", eid).order("created_at", { ascending: false }).limit(12),
      supabase.from("hr_leave_balances").select("*, hr_leave_types(name)").eq("employee_id", eid),
      supabase.from("hr_leave_requests").select("*, hr_leave_types(name)").eq("employee_id", eid).order("start_date", { ascending: false }),
      supabase.from("hr_leave_types").select("*").eq("is_active", true),
      supabase.from("hr_attendance").select("*").eq("employee_id", eid).order("attendance_date", { ascending: false }).limit(30),
      supabase.from("hr_employee_documents").select("*").eq("employee_id", eid),
      supabase.from("hr_loans").select("*").eq("employee_id", eid).order("created_at", { ascending: false }),
    ]);
    setPayslips(ps.data || []); setBalances(lb.data || []); setLeaves(lr.data || []);
    setLeaveTypes(lt.data || []); setAttendance(at.data || []); setDocs(dc.data || []); setLoans(ln.data || []);
    setLoading(false);
  };
  useEffect(() => { fetch(); }, [user]);

  const submitLeave = async () => {
    if (!req.leave_type_id || !req.start_date || !req.end_date) return toast.error("الحقول مطلوبة");
    const days = Math.max(1, Math.ceil((new Date(req.end_date).getTime() - new Date(req.start_date).getTime()) / 86400000) + 1);
    const reqNum = `LR-${Date.now().toString().slice(-8)}`;
    const r = await supabase.from("hr_leave_requests").insert([{
      request_number: reqNum,
      employee_id: emp.id, leave_type_id: req.leave_type_id,
      start_date: req.start_date, end_date: req.end_date,
      days_count: days, reason: req.reason, status: "submitted",
    }]);
    if (r.error) toast.error(r.error.message);
    else { toast.success("تم إرسال الطلب"); setReqOpen(false); setReq({ leave_type_id: "", start_date: "", end_date: "", days_count: 1, reason: "" }); fetch(); }
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;
  if (!emp) return (
    <div className="p-8 text-center space-y-2">
      <p className="text-muted-foreground">حسابك غير مرتبط بسجل موظف.</p>
      <p className="text-sm text-muted-foreground">تواصل مع قسم الموارد البشرية لربط حسابك.</p>
    </div>
  );

  const initials = emp.full_name?.split(" ").slice(0, 2).map((s: string) => s[0]).join("") || "؟";

  return (
    <div className="space-y-4">
      <ListPageHeader title="بوابتي" breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "بوابتي" }]} showAdd={false} showSearch={false} />
      <Card className="mx-4">
        <CardContent className="p-6 flex items-center gap-4">
          <Avatar className="h-20 w-20"><AvatarFallback className="text-xl bg-primary text-primary-foreground">{initials}</AvatarFallback></Avatar>
          <div>
            <h2 className="text-2xl font-bold">{emp.full_name}</h2>
            <p className="text-muted-foreground font-mono">{emp.employee_number}</p>
            <div className="flex gap-2 mt-2"><Badge>{emp.contract_type}</Badge><Badge variant="outline">تعيين: {format(new Date(emp.hire_date), "yyyy/MM/dd")}</Badge></div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="payslips" className="px-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="payslips"><Wallet className="me-2 h-4 w-4" />قسائم الراتب</TabsTrigger>
          <TabsTrigger value="leaves"><Calendar className="me-2 h-4 w-4" />الإجازات</TabsTrigger>
          <TabsTrigger value="attendance"><Clock className="me-2 h-4 w-4" />الحضور</TabsTrigger>
          <TabsTrigger value="docs"><FileText className="me-2 h-4 w-4" />وثائقي</TabsTrigger>
          <TabsTrigger value="loans"><CreditCard className="me-2 h-4 w-4" />السلف</TabsTrigger>
          <TabsTrigger value="profile"><User className="me-2 h-4 w-4" />ملفي</TabsTrigger>
        </TabsList>

        <TabsContent value="payslips">
          <Card><CardContent className="p-4">
            <Table>
              <TableHeader><TableRow><TableHead>الشهر</TableHead><TableHead>الأساسي</TableHead><TableHead>الإضافات</TableHead><TableHead>الخصومات</TableHead><TableHead>الصافي</TableHead></TableRow></TableHeader>
              <TableBody>
                {payslips.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.hr_payroll_runs?.year}/{p.hr_payroll_runs?.month}</TableCell>
                    <TableCell>{Number(p.basic_salary).toLocaleString()}</TableCell>
                    <TableCell>{Number(p.total_earnings).toLocaleString()}</TableCell>
                    <TableCell>{Number(p.total_deductions + p.gosi_employee + p.loan_deduction).toLocaleString()}</TableCell>
                    <TableCell className="font-bold text-primary">{Number(p.net_salary).toLocaleString()} ر.س</TableCell>
                  </TableRow>
                ))}
                {payslips.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">لا توجد قسائم</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="leaves">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {balances.map((b: any) => (
                <Card key={b.id}><CardContent className="p-4"><p className="text-sm text-muted-foreground">{b.hr_leave_types?.name}</p><p className="text-2xl font-bold">{b.balance} يوم</p></CardContent></Card>
              ))}
            </div>
            <Card>
              <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle>طلباتي</CardTitle>
                <Dialog open={reqOpen} onOpenChange={setReqOpen}>
                  <DialogTrigger asChild><Button><Plus className="me-2 h-4 w-4" />طلب إجازة</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>طلب إجازة جديد</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <Label>نوع الإجازة *</Label>
                        <Select value={req.leave_type_id} onValueChange={v => setReq({ ...req, leave_type_id: v })}>
                          <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                          <SelectContent>{leaveTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label>من *</Label><Input type="date" value={req.start_date} onChange={e => setReq({ ...req, start_date: e.target.value })} /></div>
                        <div><Label>إلى *</Label><Input type="date" value={req.end_date} onChange={e => setReq({ ...req, end_date: e.target.value })} /></div>
                      </div>
                      <div><Label>السبب</Label><Textarea rows={2} value={req.reason} onChange={e => setReq({ ...req, reason: e.target.value })} /></div>
                    </div>
                    <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setReqOpen(false)}>إلغاء</Button><Button onClick={submitLeave}>إرسال</Button></div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>النوع</TableHead><TableHead>من</TableHead><TableHead>إلى</TableHead><TableHead>الأيام</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {leaves.map((l: any) => (
                      <TableRow key={l.id}>
                        <TableCell>{l.hr_leave_types?.name}</TableCell>
                        <TableCell>{format(new Date(l.start_date), "yyyy/MM/dd")}</TableCell>
                        <TableCell>{format(new Date(l.end_date), "yyyy/MM/dd")}</TableCell>
                        <TableCell>{l.days_count}</TableCell>
                        <TableCell><Badge variant={l.status === "approved" ? "default" : l.status === "rejected" ? "destructive" : "secondary"}>{l.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                    {leaves.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">لا توجد طلبات</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
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
                    <TableCell><Badge variant={a.status === "present" ? "default" : "secondary"}>{a.status}</Badge></TableCell>
                    <TableCell>{a.check_in || "—"}</TableCell>
                    <TableCell>{a.check_out || "—"}</TableCell>
                  </TableRow>
                ))}
                {attendance.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">لا يوجد</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="docs">
          <Card><CardContent className="p-4">
            <Table>
              <TableHeader><TableRow><TableHead>النوع</TableHead><TableHead>الرقم</TableHead><TableHead>الانتهاء</TableHead></TableRow></TableHeader>
              <TableBody>
                {docs.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.doc_type}</TableCell>
                    <TableCell className="font-mono">{d.doc_number}</TableCell>
                    <TableCell>{d.expiry_date ? format(new Date(d.expiry_date), "yyyy/MM/dd") : "—"}</TableCell>
                  </TableRow>
                ))}
                {docs.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">لا توجد وثائق</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="loans">
          <Card><CardContent className="p-4">
            <Table>
              <TableHeader><TableRow><TableHead>الرقم</TableHead><TableHead>المبلغ</TableHead><TableHead>المسدد</TableHead><TableHead>المتبقي</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader>
              <TableBody>
                {loans.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono">{l.loan_number}</TableCell>
                    <TableCell>{Number(l.loan_amount).toLocaleString()}</TableCell>
                    <TableCell>{Number(l.paid_amount).toLocaleString()}</TableCell>
                    <TableCell>{Number(l.remaining_amount).toLocaleString()}</TableCell>
                    <TableCell><Badge>{l.status}</Badge></TableCell>
                  </TableRow>
                ))}
                {loans.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">لا توجد سلف</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="profile">
          <Card><CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div><span className="font-medium text-muted-foreground">الجوال: </span>{emp.phone || "—"}</div>
            <div><span className="font-medium text-muted-foreground">البريد: </span>{emp.email || "—"}</div>
            <div className="col-span-2"><span className="font-medium text-muted-foreground">العنوان: </span>{emp.address || "—"}</div>
            <div><span className="font-medium text-muted-foreground">البنك: </span>{emp.bank_name || "—"}</div>
            <div><span className="font-medium text-muted-foreground">IBAN: </span><span className="font-mono">{emp.bank_iban || "—"}</span></div>
            <p className="col-span-2 text-xs text-muted-foreground">لتحديث بياناتك الأساسية، تواصل مع الموارد البشرية.</p>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
