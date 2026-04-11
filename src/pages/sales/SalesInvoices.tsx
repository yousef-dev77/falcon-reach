import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { ListPageHeader } from "@/components/ListPageHeader";

export default function SalesInvoices() {
  return (
    <div className="space-y-4">
      <ListPageHeader
        title="فواتير المبيعات"
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "نظام المبيعات" },
          { label: "فواتير المبيعات" },
        ]}
        showAdd={false}
        showSearch={false}
      />

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">عروض البيع</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">أوامر المبيعات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">156</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">فواتير البيع</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">324</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">مرتجعات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>سجل الفواتير</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <p className="mb-2">لا توجد فواتير مسجلة</p>
            <p className="text-sm">يمكنك إنشاء عروض أسعار، أوامر مبيعات، فواتير بيع، ومرتجعات مبيعات</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
