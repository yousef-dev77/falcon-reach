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

      <Card>
        <CardHeader>
          <CardTitle>قائمة المستخدمين</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            لا يوجد مستخدمين مسجلين
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
