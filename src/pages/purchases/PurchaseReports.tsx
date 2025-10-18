import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Package, TrendingDown, UserPlus } from "lucide-react";

export default function PurchaseReports() {
  const reports = [
    { title: "المشتريات حسب المورد", icon: UserPlus, color: "text-primary" },
    { title: "المشتريات حسب الصنف", icon: Package, color: "text-secondary" },
    { title: "تحليل الأسعار", icon: BarChart3, color: "text-accent" },
    { title: "اتجاهات المشتريات", icon: TrendingDown, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">تقارير المشتريات</h1>
        <p className="text-muted-foreground">التقارير التحليلية للمشتريات</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((report) => (
          <Card key={report.title} className="cursor-pointer transition-shadow hover:shadow-lg">
            <CardHeader>
              <div className="flex items-center gap-3">
                <report.icon className={`h-8 w-8 ${report.color}`} />
                <CardTitle>{report.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">اضغط لعرض التقرير</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
