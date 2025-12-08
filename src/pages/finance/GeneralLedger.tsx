import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, Search, FileText, Loader2, Download, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";

type Account = {
  id: string;
  code: string;
  name: string;
  account_type: string;
  opening_balance: number;
  level: number;
};

type LedgerEntry = {
  id: string;
  entry_date: string;
  entry_number: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
  running_balance: number;
  is_posted: boolean;
};

export default function GeneralLedger() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  
  // Date filters
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  
  // Summary
  const [openingBalance, setOpeningBalance] = useState(0);
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoadingAccounts(true);
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("is_active", true)
      .order("code");

    if (error) {
      toast.error("خطأ في جلب الحسابات");
      console.error(error);
    } else {
      setAccounts(data || []);
    }
    setLoadingAccounts(false);
  };

  const fetchLedgerEntries = async () => {
    if (!selectedAccountId) {
      toast.error("يرجى اختيار حساب أولاً");
      return;
    }

    setLoading(true);
    
    // Find the selected account
    const account = accounts.find(a => a.id === selectedAccountId);
    setSelectedAccount(account || null);
    
    // Fetch journal entry lines for the selected account
    const { data, error } = await supabase
      .from("journal_entry_lines")
      .select(`
        id,
        debit_amount,
        credit_amount,
        description,
        journal_entries!inner(
          id,
          entry_date,
          entry_number,
          description,
          is_posted
        )
      `)
      .eq("account_id", selectedAccountId)
      .gte("journal_entries.entry_date", dateFrom)
      .lte("journal_entries.entry_date", dateTo)
      .order("journal_entries(entry_date)", { ascending: true });

    if (error) {
      toast.error("خطأ في جلب البيانات");
      console.error(error);
      setLoading(false);
      return;
    }

    // Calculate running balance
    let balance = account?.opening_balance || 0;
    const isDebitAccount = account?.account_type === 'asset' || account?.account_type === 'expense';
    
    setOpeningBalance(balance);
    
    let sumDebit = 0;
    let sumCredit = 0;

    const entries: LedgerEntry[] = (data || []).map((line: any) => {
      const debit = line.debit_amount || 0;
      const credit = line.credit_amount || 0;
      
      sumDebit += debit;
      sumCredit += credit;
      
      // For debit accounts (assets, expenses): balance increases with debit
      // For credit accounts (liabilities, equity, revenue): balance increases with credit
      if (isDebitAccount) {
        balance += debit - credit;
      } else {
        balance += credit - debit;
      }

      return {
        id: line.id,
        entry_date: line.journal_entries.entry_date,
        entry_number: line.journal_entries.entry_number,
        description: line.description || line.journal_entries.description || "",
        debit_amount: debit,
        credit_amount: credit,
        running_balance: balance,
        is_posted: line.journal_entries.is_posted,
      };
    });

    setLedgerEntries(entries);
    setTotalDebit(sumDebit);
    setTotalCredit(sumCredit);
    setClosingBalance(balance);
    setLoading(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLedgerEntries();
  };

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">الأستاذ العام</h1>
          <p className="text-muted-foreground">كشف حساب الأستاذ العام مع حركات القيود</p>
        </div>
        {ledgerEntries.length > 0 && (
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
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            بحث في الأستاذ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2 space-y-2">
              <Label>الحساب</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر حساباً" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <span className="flex items-center gap-2">
                        <span className="text-muted-foreground">{account.code}</span>
                        <span>{account.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
            <div className="md:col-span-4">
              <Button type="submit" className="w-full md:w-auto" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                ) : (
                  <Search className="h-4 w-4 ml-2" />
                )}
                عرض كشف الحساب
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {selectedAccount && ledgerEntries.length >= 0 && (
        <>
          {/* Account Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-3">
                  <FileText className="h-5 w-5" />
                  {selectedAccount.code} - {selectedAccount.name}
                </span>
                <Badge variant="outline">{accountTypeLabel(selectedAccount.account_type)}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">الرصيد الافتتاحي</p>
                  <p className="text-xl font-bold">{openingBalance.toLocaleString()} ر.س</p>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <p className="text-sm text-muted-foreground">إجمالي المدين</p>
                  <p className="text-xl font-bold text-green-600">{totalDebit.toLocaleString()} ر.س</p>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
                  <p className="text-sm text-muted-foreground">إجمالي الدائن</p>
                  <p className="text-xl font-bold text-red-600">{totalCredit.toLocaleString()} ر.س</p>
                </div>
                <div className="p-4 bg-primary/10 rounded-lg">
                  <p className="text-sm text-muted-foreground">الرصيد الختامي</p>
                  <p className={`text-xl font-bold ${closingBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {closingBalance.toLocaleString()} ر.س
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ledger Entries Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                حركات الحساب
                <Badge variant="secondary">{ledgerEntries.length} حركة</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ledgerEntries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  لا توجد حركات في الفترة المحددة
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>رقم القيد</TableHead>
                      <TableHead>البيان</TableHead>
                      <TableHead>مدين</TableHead>
                      <TableHead>دائن</TableHead>
                      <TableHead>الرصيد</TableHead>
                      <TableHead>الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Opening Balance Row */}
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={5} className="font-medium">رصيد افتتاحي</TableCell>
                      <TableCell className="font-bold">{openingBalance.toLocaleString()}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    {ledgerEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{format(new Date(entry.entry_date), "yyyy/MM/dd")}</TableCell>
                        <TableCell className="font-mono">{entry.entry_number}</TableCell>
                        <TableCell>{entry.description || "-"}</TableCell>
                        <TableCell className="text-green-600">
                          {entry.debit_amount > 0 ? entry.debit_amount.toLocaleString() : "-"}
                        </TableCell>
                        <TableCell className="text-red-600">
                          {entry.credit_amount > 0 ? entry.credit_amount.toLocaleString() : "-"}
                        </TableCell>
                        <TableCell className="font-medium">{entry.running_balance.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={entry.is_posted ? "default" : "secondary"}>
                            {entry.is_posted ? "مرحل" : "مسودة"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Closing Balance Row */}
                    <TableRow className="bg-primary/10 font-bold">
                      <TableCell colSpan={3}>الرصيد الختامي</TableCell>
                      <TableCell className="text-green-600">{totalDebit.toLocaleString()}</TableCell>
                      <TableCell className="text-red-600">{totalCredit.toLocaleString()}</TableCell>
                      <TableCell className={closingBalance >= 0 ? 'text-primary' : 'text-destructive'}>
                        {closingBalance.toLocaleString()}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!selectedAccount && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">حدد حساباً وفترة زمنية لعرض كشف الأستاذ</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
