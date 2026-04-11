import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListPageHeader } from "@/components/ListPageHeader";

export default function SystemLogs() {
  return (
    <div className="space-y-4">
      <ListPageHeader
        title="سجلات النظام"
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "الإعدادات" },
          { label: "سجلات النظام" },
        ]}
        showAdd={false}
        showSearch={false}
      />

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
