import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Warehouse } from "lucide-react";

export default function Warehouses() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">المستودعات</h1>
          <p className="text-muted-foreground">إدارة المستودعات والفروع</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          إضافة مستودع
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Warehouse className="h-6 w-6 text-primary" />
                <CardTitle>مستودع {i}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">الأصناف:</span>
                  <span className="font-bold">{Math.floor(Math.random() * 500 + 100)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">القيمة:</span>
                  <span className="font-bold">{(Math.random() * 100000 + 50000).toFixed(0)} ر.س</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
