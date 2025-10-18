import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";

export default function Accounts() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">شجرة الحسابات</h1>
          <p className="text-muted-foreground">إدارة الحسابات المالية</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          إضافة حساب جديد
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder="ابحث عن حساب..." className="pr-10" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {["الأصول", "الالتزامات", "حقوق الملكية", "الإيرادات", "المصروفات"].map((type, idx) => (
              <div key={idx} className="rounded-lg border p-4 hover:bg-muted/50">
                <h3 className="text-lg font-semibold">{type}</h3>
                <p className="text-sm text-muted-foreground">عرض الحسابات الفرعية</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
