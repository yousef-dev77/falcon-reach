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

      <Card>
        <CardHeader>
          <CardTitle>سجل القيود</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            لا توجد قيود مسجلة. ابدأ بإضافة قيد جديد.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
