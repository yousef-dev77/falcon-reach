import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, DollarSign, TrendingUp, Users } from "lucide-react";

export default function SalesReports() {
  const reports = [
    { title: "المبيعات حسب العميل", icon: Users, color: "text-primary" },
    { title: "المبيعات حسب الصنف", icon: BarChart3, color: "text-secondary" },
    { title: "المبيعات خلال فترة", icon: DollarSign, color: "text-accent" },
    { title: "تقرير الأرباح", icon: TrendingUp, color: "text-green-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">تقارير المبيعات</h1>
        <p className="text-muted-foreground">التقارير التحليلية للمبيعات</p>
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
