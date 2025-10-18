import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, FileText, PieChart, TrendingUp } from "lucide-react";

export default function FinancialReports() {
  const reports = [
    { title: "ميزان المراجعة", icon: BarChart3, color: "text-primary" },
    { title: "قائمة الدخل", icon: TrendingUp, color: "text-secondary" },
    { title: "الميزانية العمومية", icon: PieChart, color: "text-accent" },
    { title: "التدفقات النقدية", icon: FileText, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">التقارير المالية</h1>
        <p className="text-muted-foreground">القوائم والتقارير المالية</p>
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
