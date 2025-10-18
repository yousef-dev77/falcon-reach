import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";

export default function Customers() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">العملاء</h1>
          <p className="text-muted-foreground">إدارة بيانات العملاء</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          إضافة عميل
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="ابحث عن عميل..." className="pr-10" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            لا يوجد عملاء مسجلين
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
