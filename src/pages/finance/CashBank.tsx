import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Plus, Wallet } from "lucide-react";

export default function CashBank() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">الصناديق والبنوك</h1>
          <p className="text-muted-foreground">إدارة الحسابات النقدية والبنكية</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          إضافة حساب
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Wallet className="h-6 w-6 text-primary" />
              <CardTitle>الصناديق النقدية</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">125,000 ر.س</div>
            <p className="text-sm text-muted-foreground">الرصيد الإجمالي</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-secondary" />
              <CardTitle>الحسابات البنكية</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">215,000 ر.س</div>
            <p className="text-sm text-muted-foreground">الرصيد الإجمالي</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
