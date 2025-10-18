import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Plus } from "lucide-react";

export default function Branches() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">الفروع</h1>
          <p className="text-muted-foreground">إدارة فروع الشركة</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          إضافة فرع
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <MapPin className="h-6 w-6 text-primary" />
                <CardTitle>الفرع {i}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">الرياض، المملكة العربية السعودية</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
