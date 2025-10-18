import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Package, ShoppingCart, TrendingUp, Users, Wallet } from "lucide-react";

export default function Dashboard() {
  const stats = [
    {
      title: "إجمالي المبيعات",
      value: "125,000 ر.س",
      change: "+12.5%",
      icon: DollarSign,
      color: "text-primary",
    },
    {
      title: "إجمالي المشتريات",
      value: "85,000 ر.س",
      change: "+8.2%",
      icon: ShoppingCart,
      color: "text-secondary",
    },
    {
      title: "المخزون الحالي",
      value: "2,450 صنف",
      change: "-3.1%",
      icon: Package,
      color: "text-accent",
    },
    {
      title: "الرصيد النقدي",
      value: "340,000 ر.س",
      change: "+15.3%",
      icon: Wallet,
      color: "text-primary",
    },
    {
      title: "عدد العملاء",
      value: "1,256",
      change: "+24.5%",
      icon: Users,
      color: "text-secondary",
    },
    {
      title: "صافي الربح",
      value: "40,000 ر.س",
      change: "+18.7%",
      icon: TrendingUp,
      color: "text-accent",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">لوحة التحكم الرئيسية</h1>
        <p className="text-muted-foreground">نظرة عامة على أداء النظام</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title} className="transition-shadow hover:shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className={`text-xs ${stat.change.startsWith("+") ? "text-green-600" : "text-red-600"}`}>
                {stat.change} من الشهر الماضي
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>أحدث الفواتير</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between border-b pb-2">
                  <div>
                    <p className="font-medium">فاتورة #{1000 + i}</p>
                    <p className="text-sm text-muted-foreground">عميل {i}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{(Math.random() * 5000 + 1000).toFixed(0)} ر.س</p>
                    <p className="text-xs text-muted-foreground">اليوم</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>أصناف قاربت على النفاد</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between border-b pb-2">
                  <div>
                    <p className="font-medium">صنف #{i}</p>
                    <p className="text-sm text-muted-foreground">كود: PROD-{i}00</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-destructive">{Math.floor(Math.random() * 10)} قطعة</p>
                    <p className="text-xs text-muted-foreground">متبقي</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
