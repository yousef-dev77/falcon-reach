import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { ListPageHeader } from "@/components/ListPageHeader";

export default function PurchaseInvoices() {
  return (
    <div className="space-y-4">
      <ListPageHeader
        title="فواتير المشتريات"
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "نظام المشتريات" },
          { label: "فواتير المشتريات" },
        ]}
        showAdd={false}
        showSearch={false}
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">أوامر الشراء</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">87</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">فواتير الشراء</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">245</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">مرتجعات الشراء</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
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
            <p className="text-sm">يمكنك إنشاء أوامر شراء، فواتير شراء، ومرتجعات شراء</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
