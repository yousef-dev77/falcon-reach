import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, Wallet, FileText, Briefcase, TrendingUp, AlertTriangle, FileSignature, GraduationCap, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ListPageHeader } from "@/components/ListPageHeader";
import { NavLink } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useBranch } from "@/contexts/BranchContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function HRDashboard() {
  const { activeBranch } = useBranch();
  const [kpis, setKpis] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [recentEmp, setRecentEmp] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [k, a, r] = await Promise.all([
        supabase.rpc("hr_dashboard_kpis", { _branch_id: activeBranch?.id || null }),
        supabase.rpc("get_expiring_documents", { _days_ahead: 60 }),
        supabase.from("hr_employees").select("id, full_name, employee_number, hire_date").eq("is_active", true).order("hire_date", { ascending: false }).limit(5),
      ]);
      setKpis(k.data); setAlerts(a.data || []); setRecentEmp(r.data || []);
    })();
  }, [activeBranch?.id]);

  const k = kpis || {};
  const payrollDelta = k.last_month_payroll ? ((k.current_month_payroll - k.last_month_payroll) / k.last_month_payroll) * 100 : 0;

  const cards = [
    { title: "إجمالي الموظفين", value: k.total_employees || 0, sub: `+${k.new_employees_30d || 0} هذا الشهر`, icon: Users, to: "/hr/employees", color: "text-primary" },
    { title: "حاضرون اليوم", value: k.present_today || 0, sub: `${k.on_leave_today || 0} في إجازة`, icon: Calendar, to: "/hr/attendance", color: "text-blue-600" },
    { title: "صافي رواتب الشهر", value: Number(k.current_month_payroll || 0).toLocaleString("ar-SA") + " ر.س",
      sub: payrollDelta !== 0 ? `${payrollDelta > 0 ? "+" : ""}${payrollDelta.toFixed(1)}% عن السابق` : undefined,
      icon: Wallet, to: "/hr/payroll", color: "text-green-600" },
    { title: "طلبات إجازة معلّقة", value: k.pending_leaves || 0, icon: FileText, to: "/hr/leave-requests", color: "text-orange-600" },
    { title: "سلف نشطة", value: k.active_loans || 0, sub: Number(k.total_loan_balance || 0).toLocaleString() + " ر.س متبقية", icon: TrendingUp, to: "/hr/loans", color: "text-rose-600" },
    { title: "الأقسام", value: k.departments || 0, icon: Briefcase, to: "/hr/departments", color: "text-secondary" },
    { title: "وثائق قاربت على الانتهاء", value: k.expiring_documents || 0, icon: AlertTriangle, to: "/hr/alerts", color: "text-amber-600" },
    { title: "عقود قاربت على الانتهاء", value: k.expiring_contracts || 0, icon: FileSignature, to: "/hr/contracts", color: "text-amber-700" },
  ];

  const sev = (s: string) => s === "expired" || s === "critical" ? "destructive" : s === "warning" ? "outline" : "secondary";

  return (
    <div className="space-y-4">
      <ListPageHeader title="الموارد البشرية" showAdd={false} showPrint={false} showExport={false} showSearch={false} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
        {cards.map((c) => (
          <NavLink to={c.to} key={c.title}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{c.title}</CardTitle>
                <c.icon className={`h-5 w-5 ${c.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{c.value}</div>
                {c.sub && <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>}
              </CardContent>
            </Card>
          </NavLink>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-4 pb-4">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" />يتطلب إجراءً</CardTitle></CardHeader>
          <CardContent>
            <Tabs defaultValue="docs">
              <TabsList><TabsTrigger value="docs">وثائق ({alerts.length})</TabsTrigger><TabsTrigger value="leaves">إجازات معلّقة ({k.pending_leaves || 0})</TabsTrigger></TabsList>
              <TabsContent value="docs" className="space-y-2 max-h-72 overflow-auto">
                {alerts.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">لا توجد تنبيهات وثائق</p>}
                {alerts.slice(0, 10).map((d: any) => (
                  <div key={d.document_id} className="flex justify-between items-center p-2 border rounded-md text-sm">
                    <div>
                      <div className="font-medium">{d.employee_name}</div>
                      <div className="text-xs text-muted-foreground">{d.doc_type} — {d.doc_number}</div>
                    </div>
                    <Badge variant={sev(d.severity) as any}>{d.days_remaining < 0 ? `منتهي (${Math.abs(d.days_remaining)} يوم)` : `${d.days_remaining} يوم`}</Badge>
                  </div>
                ))}
                {alerts.length > 0 && <NavLink to="/hr/alerts" className="block text-center text-sm text-primary hover:underline mt-2">عرض الكل ←</NavLink>}
              </TabsContent>
              <TabsContent value="leaves">
                <NavLink to="/hr/leave-requests" className="block text-center text-sm text-primary hover:underline py-4">انتقل لإدارة طلبات الإجازات ←</NavLink>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" />أحدث الموظفين</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {recentEmp.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">لا يوجد</p>}
            {recentEmp.map(e => (
              <NavLink key={e.id} to={`/hr/employees/${e.id}`} className="flex justify-between items-center p-2 border rounded-md text-sm hover:bg-accent">
                <div><div className="font-medium">{e.full_name}</div><div className="text-xs text-muted-foreground font-mono">{e.employee_number}</div></div>
                <div className="text-xs text-muted-foreground">{e.hire_date}</div>
              </NavLink>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
