import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, FileText, PieChart, TrendingUp, DollarSign, Wallet } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function FinancialReports() {
  // Fetch accounts for trial balance
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts_report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  // Fetch journal entries
  const { data: journalEntries = [] } = useQuery({
    queryKey: ["journal_entries_report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("*")
        .order("entry_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Fetch cash and bank totals
  const { data: cashBoxes = [] } = useQuery({
    queryKey: ["cash_boxes_report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_boxes")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank_accounts_report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  const totalCash = cashBoxes.reduce((sum, box) => sum + (box.current_balance || 0), 0);
  const totalBank = bankAccounts.reduce((sum, acc) => sum + (acc.current_balance || 0), 0);

  // Group accounts by type
  const assetAccounts = accounts.filter(a => a.account_type === 'asset');
  const liabilityAccounts = accounts.filter(a => a.account_type === 'liability');
  const equityAccounts = accounts.filter(a => a.account_type === 'equity');
  const revenueAccounts = accounts.filter(a => a.account_type === 'revenue');
  const expenseAccounts = accounts.filter(a => a.account_type === 'expense');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">التقارير المالية</h1>
        <p className="text-muted-foreground">القوائم والتقارير المالية</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الحسابات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{accounts.length}</div>
            <p className="text-xs text-muted-foreground">حساب مسجل</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">القيود اليومية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{journalEntries.length}</div>
            <p className="text-xs text-muted-foreground">قيد محاسبي</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">النقدية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalCash.toLocaleString()} ر.س</div>
            <p className="text-xs text-muted-foreground">رصيد الصناديق</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">البنوك</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalBank.toLocaleString()} ر.س</div>
            <p className="text-xs text-muted-foreground">رصيد الحسابات البنكية</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="trial-balance" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="trial-balance">
            <BarChart3 className="h-4 w-4 ml-2" />
            ميزان المراجعة
          </TabsTrigger>
          <TabsTrigger value="income">
            <TrendingUp className="h-4 w-4 ml-2" />
            قائمة الدخل
          </TabsTrigger>
          <TabsTrigger value="balance-sheet">
            <PieChart className="h-4 w-4 ml-2" />
            الميزانية العمومية
          </TabsTrigger>
          <TabsTrigger value="cash-flow">
            <FileText className="h-4 w-4 ml-2" />
            التدفقات النقدية
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trial-balance">
          <Card>
            <CardHeader>
              <CardTitle>ميزان المراجعة</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الرمز</TableHead>
                    <TableHead>اسم الحساب</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>مدين</TableHead>
                    <TableHead>دائن</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.length > 0 ? accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>{account.code}</TableCell>
                      <TableCell>{account.name}</TableCell>
                      <TableCell>
                        {account.account_type === 'asset' && 'أصول'}
                        {account.account_type === 'liability' && 'خصوم'}
                        {account.account_type === 'equity' && 'حقوق ملكية'}
                        {account.account_type === 'revenue' && 'إيرادات'}
                        {account.account_type === 'expense' && 'مصروفات'}
                      </TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>-</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        لا توجد حسابات مسجلة
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="income">
          <Card>
            <CardHeader>
              <CardTitle>قائمة الدخل</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-3 text-green-600 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  الإيرادات
                </h3>
                {revenueAccounts.length > 0 ? (
                  <Table>
                    <TableBody>
                      {revenueAccounts.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell>{account.code}</TableCell>
                          <TableCell>{account.name}</TableCell>
                          <TableCell className="text-left">0 ر.س</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground">لا توجد حسابات إيرادات</p>
                )}
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-3 text-red-600 flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  المصروفات
                </h3>
                {expenseAccounts.length > 0 ? (
                  <Table>
                    <TableBody>
                      {expenseAccounts.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell>{account.code}</TableCell>
                          <TableCell>{account.name}</TableCell>
                          <TableCell className="text-left">0 ر.س</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground">لا توجد حسابات مصروفات</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balance-sheet">
          <Card>
            <CardHeader>
              <CardTitle>الميزانية العمومية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-3 text-blue-600">الأصول</h3>
                {assetAccounts.length > 0 ? (
                  <Table>
                    <TableBody>
                      {assetAccounts.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell>{account.code}</TableCell>
                          <TableCell>{account.name}</TableCell>
                          <TableCell className="text-left">0 ر.س</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground">لا توجد حسابات أصول</p>
                )}
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-3 text-orange-600">الخصوم</h3>
                {liabilityAccounts.length > 0 ? (
                  <Table>
                    <TableBody>
                      {liabilityAccounts.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell>{account.code}</TableCell>
                          <TableCell>{account.name}</TableCell>
                          <TableCell className="text-left">0 ر.س</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground">لا توجد حسابات خصوم</p>
                )}
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-3 text-purple-600">حقوق الملكية</h3>
                {equityAccounts.length > 0 ? (
                  <Table>
                    <TableBody>
                      {equityAccounts.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell>{account.code}</TableCell>
                          <TableCell>{account.name}</TableCell>
                          <TableCell className="text-left">0 ر.س</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground">لا توجد حسابات حقوق ملكية</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cash-flow">
          <Card>
            <CardHeader>
              <CardTitle>قائمة التدفقات النقدية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      الصناديق النقدية
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {cashBoxes.length > 0 ? (
                      <div className="space-y-2">
                        {cashBoxes.map((box) => (
                          <div key={box.id} className="flex justify-between">
                            <span>{box.name}</span>
                            <span className="font-medium">{box.current_balance?.toLocaleString()} ر.س</span>
                          </div>
                        ))}
                        <div className="border-t pt-2 flex justify-between font-bold">
                          <span>الإجمالي</span>
                          <span>{totalCash.toLocaleString()} ر.س</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">لا توجد صناديق</p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      الحسابات البنكية
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {bankAccounts.length > 0 ? (
                      <div className="space-y-2">
                        {bankAccounts.map((acc) => (
                          <div key={acc.id} className="flex justify-between">
                            <span>{acc.bank_name}</span>
                            <span className="font-medium">{acc.current_balance?.toLocaleString()} ر.س</span>
                          </div>
                        ))}
                        <div className="border-t pt-2 flex justify-between font-bold">
                          <span>الإجمالي</span>
                          <span>{totalBank.toLocaleString()} ر.س</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">لا توجد حسابات بنكية</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
