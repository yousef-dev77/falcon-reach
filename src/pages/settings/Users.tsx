import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";

export default function Users() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">المستخدمين والصلاحيات</h1>
          <p className="text-muted-foreground">إدارة المستخدمين وصلاحيات الوصول</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          إضافة مستخدم
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        {[
          { role: "مدير", count: 2, color: "text-primary" },
          { role: "محاسب", count: 5, color: "text-secondary" },
          { role: "أمين مخزون", count: 8, color: "text-accent" },
          { role: "بائع", count: 12, color: "text-green-600" },
        ].map((item) => (
          <Card key={item.role}>
            <CardHeader className="pb-3">
              <CardTitle className={`text-sm font-medium ${item.color}`}>{item.role}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{item.count}</div>
              <p className="text-xs text-muted-foreground">مستخدم نشط</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>قائمة المستخدمين</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <p className="mb-2">لا يوجد مستخدمين مسجلين</p>
            <p className="text-sm">يمكنك إنشاء مستخدمين وتحديد صلاحيات الوصول لكل شاشة والأدوار الوظيفية</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
