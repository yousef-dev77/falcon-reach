import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDown, ArrowUp, DollarSign, Package, ShoppingCart, TrendingUp, Users, Wallet } from "lucide-react";
import { ListPageHeader } from "@/components/ListPageHeader";

export default function Dashboard() {
  const stats = [
    { title: "إجمالي الإيرادات", value: "450,000 ر.س", change: "+12.5%", icon: TrendingUp, color: "text-green-600" },
    { title: "إجمالي المصروفات", value: "285,000 ر.س", change: "+8.2%", icon: ArrowDown, color: "text-red-600" },
    { title: "صافي الربح", value: "165,000 ر.س", change: "+15.3%", icon: DollarSign, color: "text-primary" },
    { title: "رصيد الصناديق", value: "340,000 ر.س", change: "+5.1%", icon: Wallet, color: "text-secondary" },
  ];

  const salesStats = [
    { title: "فواتير المبيعات", value: "324", change: "+18%", icon: ShoppingCart },
    { title: "العملاء النشطين", value: "156", change: "+12%", icon: Users },
  ];

  const inventoryStats = [
    { title: "إجمالي الأصناف", value: "1,247", change: "+5%", icon: Package },
    { title: "قيمة المخزون", value: "890,000 ر.س", change: "+3%", icon: DollarSign },
  ];

  return (
    <div className="space-y-4">
      <ListPageHeader
        title="لوحة التحكم الرئيسية"
        breadcrumbs={[{ label: "الرئيسية" }]}
        showAdd={false}
        showSearch={false}
        showPrint={false}
        showExport={false}
        showRefresh={false}
      />

      {/* اللوحة المالية */}
      <div>
        <h2 className="text-xl font-bold mb-4">اللوحة المالية</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <ArrowUp className="h-3 w-3 text-green-600" />
                  {stat.change} عن الشهر الماضي
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* لوحة المبيعات */}
      <div>
        <h2 className="text-xl font-bold mb-4">لوحة المبيعات</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {salesStats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.change} هذا الشهر</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* لوحة المخزون */}
      <div>
        <h2 className="text-xl font-bold mb-4">لوحة متابعة المخزون</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {inventoryStats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className="h-5 w-5 text-secondary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.change} عن الشهر الماضي</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
