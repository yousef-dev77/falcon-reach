import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";

export default function JournalEntries() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">القيود اليومية</h1>
          <p className="text-muted-foreground">سجل القيود المحاسبية</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          إضافة قيد جديد
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">قيود يدوية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">156</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">قيود آلية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">892</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">إجمالي القيود</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,048</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>سجل القيود</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <p className="mb-4">لا توجد قيود مسجلة. ابدأ بإضافة قيد جديد.</p>
            <p className="text-sm">سيتم عرض القيود اليدوية والآلية من المبيعات والمشتريات هنا مع إمكانية البحث والترشيح والطباعة</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
