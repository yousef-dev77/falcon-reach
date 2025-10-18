import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SystemLogs() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">سجلات النظام</h1>
        <p className="text-muted-foreground">تتبع العمليات وسجل التغييرات</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>سجل العمليات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            لا توجد سجلات متاحة
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
