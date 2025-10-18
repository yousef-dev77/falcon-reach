import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowDownUp, ArrowUpCircle, ArrowDownCircle, Building2, Plus, Wallet, FileCheck } from "lucide-react";

export default function CashBank() {
  const cashBoxes = [
    { name: "الصندوق الرئيسي", balance: "85,000 ر.س", branch: "الفرع الأول", status: "نشط" },
    { name: "صندوق المبيعات", balance: "30,000 ر.س", branch: "الفرع الأول", status: "نشط" },
    { name: "صندوق الفرع الثاني", balance: "10,000 ر.س", branch: "الفرع الثاني", status: "نشط" },
  ];

  const bankAccounts = [
    { name: "البنك الأهلي - الحساب الجاري", number: "12345678", balance: "125,000 ر.س", status: "نشط" },
    { name: "بنك الراجحي - حساب التوفير", number: "87654321", balance: "55,000 ر.س", status: "نشط" },
    { name: "بنك الرياض - الحساب الجاري", number: "45678912", balance: "35,000 ر.س", status: "نشط" },
  ];

  const transactions = [
    { type: "إيداع", from: "الصندوق الرئيسي", to: "البنك الأهلي", amount: "50,000 ر.س", date: "2025-10-18", status: "مكتمل" },
    { type: "سحب", from: "بنك الراجحي", to: "الصندوق الرئيسي", amount: "25,000 ر.س", date: "2025-10-17", status: "مكتمل" },
    { type: "تحويل", from: "البنك الأهلي", to: "بنك الرياض", amount: "15,000 ر.س", date: "2025-10-16", status: "قيد المعالجة" },
  ];

  const reconciliations = [
    { bank: "البنك الأهلي", period: "أكتوبر 2025", status: "مكتمل", date: "2025-10-15", difference: "0 ر.س" },
    { bank: "بنك الراجحي", period: "سبتمبر 2025", status: "قيد المراجعة", date: "2025-09-30", difference: "1,250 ر.س" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">الصناديق والبنوك</h1>
          <p className="text-muted-foreground">إدارة الحسابات النقدية والبنكية والعمليات المالية</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Wallet className="h-6 w-6 text-primary" />
              <CardTitle>الصناديق النقدية</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">125,000 ر.س</div>
            <p className="text-sm text-muted-foreground">الرصيد الإجمالي • 3 صناديق</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-secondary" />
              <CardTitle>الحسابات البنكية</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">215,000 ر.س</div>
            <p className="text-sm text-muted-foreground">الرصيد الإجمالي • 3 حسابات</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="cash" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="cash">
            <Wallet className="h-4 w-4 ml-2" />
            الصناديق النقدية
          </TabsTrigger>
          <TabsTrigger value="bank">
            <Building2 className="h-4 w-4 ml-2" />
            الحسابات البنكية
          </TabsTrigger>
          <TabsTrigger value="operations">
            <ArrowDownUp className="h-4 w-4 ml-2" />
            العمليات المالية
          </TabsTrigger>
          <TabsTrigger value="reconciliation">
            <FileCheck className="h-4 w-4 ml-2" />
            التسويات البنكية
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cash" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>سجل الصناديق النقدية</CardTitle>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                إضافة صندوق
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cashBoxes.map((box, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <Wallet className="h-8 w-8 text-primary" />
                      <div>
                        <h4 className="font-semibold">{box.name}</h4>
                        <p className="text-sm text-muted-foreground">{box.branch}</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-xl font-bold">{box.balance}</div>
                      <p className="text-sm text-green-600">{box.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bank" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>سجل الحسابات البنكية</CardTitle>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                إضافة حساب بنكي
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {bankAccounts.map((account, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <Building2 className="h-8 w-8 text-secondary" />
                      <div>
                        <h4 className="font-semibold">{account.name}</h4>
                        <p className="text-sm text-muted-foreground">رقم الحساب: {account.number}</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-xl font-bold">{account.balance}</div>
                      <p className="text-sm text-green-600">{account.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operations" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>العمليات المالية (إيداع - سحب - تحويل)</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline">
                  <ArrowUpCircle className="h-4 w-4 mr-2 text-green-600" />
                  إيداع
                </Button>
                <Button size="sm" variant="outline">
                  <ArrowDownCircle className="h-4 w-4 mr-2 text-red-600" />
                  سحب
                </Button>
                <Button size="sm" variant="outline">
                  <ArrowDownUp className="h-4 w-4 mr-2" />
                  تحويل
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {transactions.map((trans, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${
                        trans.type === "إيداع" ? "bg-green-100" : 
                        trans.type === "سحب" ? "bg-red-100" : "bg-blue-100"
                      }`}>
                        {trans.type === "إيداع" && <ArrowUpCircle className="h-5 w-5 text-green-600" />}
                        {trans.type === "سحب" && <ArrowDownCircle className="h-5 w-5 text-red-600" />}
                        {trans.type === "تحويل" && <ArrowDownUp className="h-5 w-5 text-blue-600" />}
                      </div>
                      <div>
                        <h4 className="font-semibold">{trans.type}</h4>
                        <p className="text-sm text-muted-foreground">من: {trans.from} → إلى: {trans.to}</p>
                        <p className="text-xs text-muted-foreground">{trans.date}</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-lg font-bold">{trans.amount}</div>
                      <p className={`text-sm ${trans.status === "مكتمل" ? "text-green-600" : "text-yellow-600"}`}>
                        {trans.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reconciliation" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>التسويات البنكية</CardTitle>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                إضافة تسوية جديدة
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reconciliations.map((rec, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <FileCheck className="h-8 w-8 text-primary" />
                      <div>
                        <h4 className="font-semibold">{rec.bank}</h4>
                        <p className="text-sm text-muted-foreground">فترة: {rec.period}</p>
                        <p className="text-xs text-muted-foreground">تاريخ: {rec.date}</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className={`text-sm font-semibold ${rec.status === "مكتمل" ? "text-green-600" : "text-yellow-600"}`}>
                        {rec.status}
                      </p>
                      <p className="text-sm text-muted-foreground">الفرق: {rec.difference}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
