import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Plus, Search } from "lucide-react";
import { useState } from "react";

export default function Accounts() {
  const accountsTree = [
    {
      name: "الأصول",
      code: "1",
      color: "text-primary",
      children: [
        {
          name: "الأصول المتداولة",
          code: "11",
          children: [
            { name: "الصندوق", code: "1101", balance: "125,000 ر.س" },
            { name: "البنوك", code: "1102", balance: "215,000 ر.س" },
            { name: "العملاء", code: "1103", balance: "89,500 ر.س" },
            { name: "المخزون", code: "1104", balance: "450,000 ر.س" },
          ],
        },
        {
          name: "الأصول الثابتة",
          code: "12",
          children: [
            { name: "الأراضي والمباني", code: "1201", balance: "2,500,000 ر.س" },
            { name: "الآلات والمعدات", code: "1202", balance: "850,000 ر.س" },
            { name: "السيارات", code: "1203", balance: "320,000 ر.س" },
          ],
        },
      ],
    },
    {
      name: "الالتزامات",
      code: "2",
      color: "text-secondary",
      children: [
        {
          name: "الالتزامات المتداولة",
          code: "21",
          children: [
            { name: "الموردين", code: "2101", balance: "145,000 ر.س" },
            { name: "أوراق الدفع", code: "2102", balance: "75,000 ر.س" },
          ],
        },
        {
          name: "الالتزامات طويلة الأجل",
          code: "22",
          children: [
            { name: "قروض بنكية", code: "2201", balance: "500,000 ر.س" },
          ],
        },
      ],
    },
    {
      name: "حقوق الملكية",
      code: "3",
      color: "text-accent",
      children: [
        { name: "رأس المال", code: "3001", balance: "1,000,000 ر.س" },
        { name: "الأرباح المحتجزة", code: "3002", balance: "450,000 ر.س" },
      ],
    },
    {
      name: "الإيرادات",
      code: "4",
      color: "text-green-600",
      children: [
        { name: "إيرادات المبيعات", code: "4001", balance: "850,000 ر.س" },
        { name: "إيرادات أخرى", code: "4002", balance: "25,000 ر.س" },
      ],
    },
    {
      name: "المصروفات",
      code: "5",
      color: "text-red-600",
      children: [
        {
          name: "مصروفات تشغيلية",
          code: "51",
          children: [
            { name: "الرواتب والأجور", code: "5101", balance: "180,000 ر.س" },
            { name: "الإيجارات", code: "5102", balance: "48,000 ر.س" },
            { name: "الكهرباء والماء", code: "5103", balance: "12,000 ر.س" },
          ],
        },
        {
          name: "مصروفات إدارية",
          code: "52",
          children: [
            { name: "مصروفات مكتبية", code: "5201", balance: "8,500 ر.س" },
            { name: "مصروفات صيانة", code: "5202", balance: "15,000 ر.س" },
          ],
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">شجرة الحسابات</h1>
          <p className="text-muted-foreground">إدارة الحسابات المالية بنظام شجري</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          إضافة حساب جديد
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder="ابحث عن حساب برقم الحساب أو الاسم..." className="pr-10" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {accountsTree.map((account) => (
              <AccountTreeNode key={account.code} account={account} level={0} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AccountTreeNode({ account, level }: { account: any; level: number }) {
  const [isOpen, setIsOpen] = useState(level === 0);
  const hasChildren = account.children && account.children.length > 0;
  const paddingRight = `${level * 1.5}rem`;

  return (
    <div>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div
            className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors border"
            style={{ paddingRight }}
          >
            <div className="flex items-center gap-2">
              {hasChildren && (
                <div className="text-muted-foreground">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </div>
              )}
              {!hasChildren && <div className="w-4" />}
              <div>
                <div className="flex items-center gap-2">
                  <span className={`font-semibold ${account.color || ""}`}>{account.name}</span>
                  <span className="text-sm text-muted-foreground">({account.code})</span>
                </div>
                {account.balance && (
                  <p className="text-sm text-muted-foreground mt-1">الرصيد: {account.balance}</p>
                )}
              </div>
            </div>
            {hasChildren && (
              <span className="text-xs bg-muted px-2 py-1 rounded">
                {account.children.length} {level === 0 ? "مجموعة" : "حساب"}
              </span>
            )}
          </div>
        </CollapsibleTrigger>
        {hasChildren && (
          <CollapsibleContent>
            <div className="mt-1 space-y-1">
              {account.children.map((child: any) => (
                <AccountTreeNode key={child.code} account={child} level={level + 1} />
              ))}
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
}
