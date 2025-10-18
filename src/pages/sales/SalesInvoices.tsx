import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";

export default function SalesInvoices() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">فواتير المبيعات</h1>
          <p className="text-muted-foreground">إدارة فواتير المبيعات</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          فاتورة جديدة
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>سجل الفواتير</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            لا توجد فواتير مسجلة
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
