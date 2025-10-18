import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, FileText, Package, TrendingDown } from "lucide-react";

export default function InventoryReports() {
  const reports = [
    { title: "تقرير الكميات الحالية", icon: Package, color: "text-primary" },
    { title: "حركة الصنف", icon: BarChart3, color: "text-secondary" },
    { title: "الأصناف القاربة على النفاد", icon: TrendingDown, color: "text-destructive" },
    { title: "تقرير الجرد", icon: FileText, color: "text-accent" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">تقارير المخزون</h1>
        <p className="text-muted-foreground">التقارير التحليلية للمخزون</p>
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
