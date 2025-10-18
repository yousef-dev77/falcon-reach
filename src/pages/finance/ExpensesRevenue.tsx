import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";

export default function ExpensesRevenue() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">المصاريف والإيرادات</h1>
          <p className="text-muted-foreground">إدارة المصاريف والإيرادات</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          إضافة عملية
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <ArrowUp className="h-6 w-6 text-green-600" />
              <CardTitle>الإيرادات</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">150,000 ر.س</div>
            <p className="text-sm text-muted-foreground">هذا الشهر</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <ArrowDown className="h-6 w-6 text-red-600" />
              <CardTitle>المصاريف</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">85,000 ر.س</div>
            <p className="text-sm text-muted-foreground">هذا الشهر</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
