import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function GeneralSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">الإعدادات العامة</h1>
        <p className="text-muted-foreground">إعدادات النظام العامة</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>معلومات الشركة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">اسم الشركة</Label>
              <Input id="company-name" placeholder="أدخل اسم الشركة" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax-number">الرقم الضريبي</Label>
              <Input id="tax-number" placeholder="أدخل الرقم الضريبي" />
            </div>
            <Button className="bg-primary hover:bg-primary/90">حفظ التغييرات</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>السنة المالية</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fiscal-year">السنة المالية الحالية</Label>
              <Input id="fiscal-year" type="date" />
            </div>
            <Button className="bg-primary hover:bg-primary/90">حفظ التغييرات</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
