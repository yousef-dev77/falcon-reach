import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function GeneralLedger() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">الأستاذ العام</h1>
        <p className="text-muted-foreground">كشف حساب الأستاذ العام</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>سجل الأستاذ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            حدد حساباً لعرض كشف الأستاذ الخاص به
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
