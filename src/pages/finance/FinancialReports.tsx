import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  BarChart3, 
  FileText, 
  PieChart, 
  TrendingUp, 
  DollarSign, 
  Wallet,
  Download,
  Printer,
  Loader2,
  RefreshCw
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { format, startOfYear, endOfYear } from "date-fns";
import { ListPageHeader } from "@/components/ListPageHeader";

type AccountWithBalance = {
  id: string;
  code: string;
  name: string;
  account_type: string;
  level: number;
  opening_balance: number;
  debit_total: number;
  credit_total: number;
  closing_balance: number;
};

export default function FinancialReports() {
  const [dateFrom, setDateFrom] = useState(format(startOfYear(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfYear(new Date()), "yyyy-MM-dd"));

  // Fetch accounts
  const { data: accounts = [], isLoading: loadingAccounts, refetch } = useQuery({
    queryKey: ["financial_reports_accounts", dateFrom, dateTo],
    queryFn: async () => {
      // Get all accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from("accounts")
        .select("*")
        .eq("is_active", true)
        .order("code");
      
      if (accountsError) throw accountsError;

      // Get journal entry lines with their entries
      const { data: linesData, error: linesError } = await supabase
        .from("journal_entry_lines")
        .select(`
          account_id,
          debit_amount,
          credit_amount,
          journal_entries!inner(entry_date, is_posted)
        `)
        .gte("journal_entries.entry_date", dateFrom)
        .lte("journal_entries.entry_date", dateTo);

      if (linesError) throw linesError;

      // Calculate balances for each account
      const accountBalances: Record<string, { debit: number; credit: number }> = {};
      
      (linesData || []).forEach((line: any) => {
        if (!accountBalances[line.account_id]) {
          accountBalances[line.account_id] = { debit: 0, credit: 0 };
        }
        accountBalances[line.account_id].debit += line.debit_amount || 0;
        accountBalances[line.account_id].credit += line.credit_amount || 0;
      });

      // Merge with accounts
      return (accountsData || []).map(account => {
        const balances = accountBalances[account.id] || { debit: 0, credit: 0 };
        const opening = account.opening_balance || 0;
        const isDebitAccount = account.account_type === 'asset' || account.account_type === 'expense';
        
        let closingBalance: number;
        if (isDebitAccount) {
          closingBalance = opening + balances.debit - balances.credit;
        } else {
          closingBalance = opening + balances.credit - balances.debit;
        }

        return {
          ...account,
          debit_total: balances.debit,
          credit_total: balances.credit,
          closing_balance: closingBalance,
        } as AccountWithBalance;
      });
    },
  });

  // Fetch cash and bank totals
  const { data: cashBoxes = [] } = useQuery({
    queryKey: ["cash_boxes_report"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cash_boxes").select("*").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank_accounts_report"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts").select("*").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  // Group accounts by type
  const assetAccounts = accounts.filter(a => a.account_type === 'asset');
  const liabilityAccounts = accounts.filter(a => a.account_type === 'liability');
  const equityAccounts = accounts.filter(a => a.account_type === 'equity');
  const revenueAccounts = accounts.filter(a => a.account_type === 'revenue');
  const expenseAccounts = accounts.filter(a => a.account_type === 'expense');

  // Calculate totals
  const totalDebit = accounts.reduce((sum, a) => sum + a.debit_total, 0);
  const totalCredit = accounts.reduce((sum, a) => sum + a.credit_total, 0);
  
  const totalAssets = assetAccounts.reduce((sum, a) => sum + a.closing_balance, 0);
  const totalLiabilities = liabilityAccounts.reduce((sum, a) => sum + a.closing_balance, 0);
  const totalEquity = equityAccounts.reduce((sum, a) => sum + a.closing_balance, 0);
  const totalRevenue = revenueAccounts.reduce((sum, a) => sum + a.closing_balance, 0);
  const totalExpenses = expenseAccounts.reduce((sum, a) => sum + a.closing_balance, 0);
  const netIncome = totalRevenue - totalExpenses;

  const totalCash = cashBoxes.reduce((sum, box) => sum + (box.current_balance || 0), 0);
  const totalBank = bankAccounts.reduce((sum, acc) => sum + (acc.current_balance || 0), 0);

  const accountTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      asset: "أصول",
      liability: "خصوم",
      equity: "حقوق ملكية",
      revenue: "إيرادات",
      expense: "مصروفات",
    };
    return labels[type] || type;
  };

  if (loadingAccounts) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <ListPageHeader
        title="التقارير المالية"
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "النظام المالي" },
          { label: "التقارير المالية" },
        ]}
        showAdd={false}
        showSearch={false}
      />
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 ml-2" />
            تصدير Excel
          </Button>
          <Button variant="outline" size="sm">
            <Printer className="h-4 w-4 ml-2" />
            طباعة
          </Button>
        </div>
      </div>

      {/* Date Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>من تاريخ</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>إلى تاريخ</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <Button onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 ml-2" />
              تحديث التقارير
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المدين</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalDebit.toLocaleString()} ر.س</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الدائن</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalCredit.toLocaleString()} ر.س</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">النقدية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{totalCash.toLocaleString()} ر.س</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">البنوك</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary">{totalBank.toLocaleString()} ر.س</div>
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

        {/* Trial Balance */}
        <TabsContent value="trial-balance">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>ميزان المراجعة</CardTitle>
                <Badge variant={totalDebit === totalCredit ? "default" : "destructive"}>
                  {totalDebit === totalCredit ? "متوازن" : "غير متوازن"}
                </Badge>
              </div>
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
                    <TableHead>الرصيد</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.filter(a => a.debit_total > 0 || a.credit_total > 0 || a.opening_balance !== 0).length > 0 ? (
                    <>
                      {accounts.filter(a => a.debit_total > 0 || a.credit_total > 0 || a.opening_balance !== 0).map((account) => (
                        <TableRow key={account.id}>
                          <TableCell className="font-mono">{account.code}</TableCell>
                          <TableCell>{account.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{accountTypeLabel(account.account_type)}</Badge>
                          </TableCell>
                          <TableCell className="text-green-600">
                            {account.debit_total > 0 ? account.debit_total.toLocaleString() : "-"}
                          </TableCell>
                          <TableCell className="text-red-600">
                            {account.credit_total > 0 ? account.credit_total.toLocaleString() : "-"}
                          </TableCell>
                          <TableCell className={account.closing_balance >= 0 ? "text-primary" : "text-destructive"}>
                            {account.closing_balance.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell colSpan={3}>الإجمالي</TableCell>
                        <TableCell className="text-green-600">{totalDebit.toLocaleString()}</TableCell>
                        <TableCell className="text-red-600">{totalCredit.toLocaleString()}</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </>
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        لا توجد حركات في الفترة المحددة
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Income Statement */}
        <TabsContent value="income">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>قائمة الدخل</CardTitle>
                <Badge variant={netIncome >= 0 ? "default" : "destructive"}>
                  {netIncome >= 0 ? "ربح" : "خسارة"}: {Math.abs(netIncome).toLocaleString()} ر.س
                </Badge>
              </div>
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
                          <TableCell className="font-mono">{account.code}</TableCell>
                          <TableCell>{account.name}</TableCell>
                          <TableCell className="text-left font-medium">
                            {account.closing_balance.toLocaleString()} ر.س
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-green-50 dark:bg-green-950/20 font-bold">
                        <TableCell colSpan={2}>إجمالي الإيرادات</TableCell>
                        <TableCell className="text-left text-green-600">
                          {totalRevenue.toLocaleString()} ر.س
                        </TableCell>
                      </TableRow>
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
                          <TableCell className="font-mono">{account.code}</TableCell>
                          <TableCell>{account.name}</TableCell>
                          <TableCell className="text-left font-medium">
                            {account.closing_balance.toLocaleString()} ر.س
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-red-50 dark:bg-red-950/20 font-bold">
                        <TableCell colSpan={2}>إجمالي المصروفات</TableCell>
                        <TableCell className="text-left text-red-600">
                          {totalExpenses.toLocaleString()} ر.س
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground">لا توجد حسابات مصروفات</p>
                )}
              </div>

              <div className="p-4 rounded-lg bg-primary/10 border">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold">صافي الدخل</span>
                  <span className={`text-2xl font-bold ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {netIncome.toLocaleString()} ر.س
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balance Sheet */}
        <TabsContent value="balance-sheet">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>الميزانية العمومية</CardTitle>
                <Badge variant={Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1 ? "default" : "destructive"}>
                  {Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1 ? "متوازنة" : "غير متوازنة"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Assets */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-primary">الأصول</h3>
                  {assetAccounts.length > 0 ? (
                    <Table>
                      <TableBody>
                        {assetAccounts.map((account) => (
                          <TableRow key={account.id}>
                            <TableCell className="font-mono text-xs">{account.code}</TableCell>
                            <TableCell>{account.name}</TableCell>
                            <TableCell className="text-left">
                              {account.closing_balance.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-primary/10 font-bold">
                          <TableCell colSpan={2}>إجمالي الأصول</TableCell>
                          <TableCell className="text-left text-primary">
                            {totalAssets.toLocaleString()} ر.س
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground">لا توجد حسابات أصول</p>
                  )}
                </div>

                {/* Liabilities & Equity */}
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-lg mb-3 text-orange-600">الخصوم</h3>
                    {liabilityAccounts.length > 0 ? (
                      <Table>
                        <TableBody>
                          {liabilityAccounts.map((account) => (
                            <TableRow key={account.id}>
                              <TableCell className="font-mono text-xs">{account.code}</TableCell>
                              <TableCell>{account.name}</TableCell>
                              <TableCell className="text-left">
                                {account.closing_balance.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-orange-50 dark:bg-orange-950/20 font-bold">
                            <TableCell colSpan={2}>إجمالي الخصوم</TableCell>
                            <TableCell className="text-left text-orange-600">
                              {totalLiabilities.toLocaleString()} ر.س
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-muted-foreground">لا توجد حسابات خصوم</p>
                    )}
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg mb-3 text-secondary">حقوق الملكية</h3>
                    {equityAccounts.length > 0 ? (
                      <Table>
                        <TableBody>
                          {equityAccounts.map((account) => (
                            <TableRow key={account.id}>
                              <TableCell className="font-mono text-xs">{account.code}</TableCell>
                              <TableCell>{account.name}</TableCell>
                              <TableCell className="text-left">
                                {account.closing_balance.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-secondary/10 font-bold">
                            <TableCell colSpan={2}>إجمالي حقوق الملكية</TableCell>
                            <TableCell className="text-left text-secondary">
                              {totalEquity.toLocaleString()} ر.س
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-muted-foreground">لا توجد حسابات حقوق ملكية</p>
                    )}
                  </div>

                  <div className="p-3 rounded-lg bg-muted font-bold">
                    <div className="flex justify-between">
                      <span>إجمالي الخصوم + حقوق الملكية</span>
                      <span>{(totalLiabilities + totalEquity).toLocaleString()} ر.س</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cash Flow */}
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
                          <span className="text-primary">{totalCash.toLocaleString()} ر.س</span>
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
                          <span className="text-secondary">{totalBank.toLocaleString()} ر.س</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">لا توجد حسابات بنكية</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="p-4 rounded-lg bg-primary/10 border">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold">إجمالي السيولة النقدية</span>
                  <span className="text-2xl font-bold text-primary">
                    {(totalCash + totalBank).toLocaleString()} ر.س
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
