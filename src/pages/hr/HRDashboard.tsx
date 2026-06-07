import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, Wallet, FileText, Briefcase, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ListPageHeader } from "@/components/ListPageHeader";
import { NavLink } from "react-router-dom";

export default function HRDashboard() {
  const [stats, setStats] = useState({
    employees: 0,
    departments: 0,
    activeLeaves: 0,
    currentPayroll: 0,
    pendingLeaves: 0,
    activeLoans: 0,
  });

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [emp, dept, leaves, payroll, pendLeaves, loans] = await Promise.all([
        supabase.from("hr_employees").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("hr_departments").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("hr_leave_requests").select("id", { count: "exact", head: true }).eq("status", "approved").lte("start_date", today).gte("end_date", today),
        supabase.from("hr_payroll_runs").select("total_net").eq("year", new Date().getFullYear()).eq("month", new Date().getMonth() + 1).maybeSingle(),
        supabase.from("hr_leave_requests").select("id", { count: "exact", head: true }).eq("status", "submitted"),
        supabase.from("hr_loans").select("id", { count: "exact", head: true }).eq("status", "active"),
      ]);
      setStats({
        employees: emp.count || 0,
        departments: dept.count || 0,
        activeLeaves: leaves.count || 0,
        currentPayroll: Number(payroll.data?.total_net || 0),
        pendingLeaves: pendLeaves.count || 0,
        activeLoans: loans.count || 0,
      });
    })();
  }, []);

  const cards = [
    { title: "إجمالي الموظفين", value: stats.employees, icon: Users, to: "/hr/employees", color: "text-primary" },
    { title: "الأقسام", value: stats.departments, icon: Briefcase, to: "/hr/departments", color: "text-secondary" },
    { title: "موظفون في إجازة اليوم", value: stats.activeLeaves, icon: Calendar, to: "/hr/leave-requests", color: "text-amber-600" },
    { title: "صافي رواتب الشهر", value: stats.currentPayroll.toLocaleString("ar-SA") + " ر.س", icon: Wallet, to: "/hr/payroll", color: "text-green-600" },
    { title: "طلبات إجازة معلّقة", value: stats.pendingLeaves, icon: FileText, to: "/hr/leave-requests", color: "text-orange-600" },
    { title: "سلف نشطة", value: stats.activeLoans, icon: TrendingUp, to: "/hr/loans", color: "text-rose-600" },
  ];

  return (
    <div className="space-y-4">
      <ListPageHeader title="الموارد البشرية" showAdd={false} showPrint={false} showExport={false} showSearch={false} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
        {cards.map((c) => (
          <NavLink to={c.to} key={c.title}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{c.title}</CardTitle>
                <c.icon className={`h-5 w-5 ${c.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{c.value}</div>
              </CardContent>
            </Card>
          </NavLink>
        ))}
      </div>
    </div>
  );
}
