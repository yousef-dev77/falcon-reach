import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";

export default function Movements() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">الحركات المخزنية</h1>
          <p className="text-muted-foreground">سجل حركات المخزون</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          إضافة حركة
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>سجل الحركات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            لا توجد حركات مسجلة
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
