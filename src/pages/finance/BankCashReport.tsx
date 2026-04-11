import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Building2, Wallet, Search, FileDown, Printer } from "lucide-react";
import { format } from "date-fns";
import { ListPageHeader } from "@/components/ListPageHeader";

interface MovementLine {
  id: string;
  journal_entry_id: string;
  account_id: string;
  debit_amount: number | null;
  credit_amount: number | null;
  description: string | null;
  created_at: string;
  journal_entry: {
    entry_number: string;
    entry_date: string;
    description: string | null;
    is_posted: boolean | null;
    reference: string | null;
  };
}

interface AccountInfo {
  id: string;
  code: string;
  name: string;
  type: "bank" | "cash";
  entity_name: string;
}

export default function BankCashReport() {
  const [activeTab, setActiveTab] = useState("all");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch bank accounts with their GL account IDs
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts-for-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, code, bank_name, account_number, account_id, current_balance")
        .eq("is_active", true)
        .order("bank_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch cash boxes with their GL account IDs
  const { data: cashBoxes = [] } = useQuery({
    queryKey: ["cash-boxes-for-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_boxes")
        .select("id, code, name, account_id, current_balance")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Build a combined list of accounts for filtering
  const accountsList = useMemo<AccountInfo[]>(() => {
    const list: AccountInfo[] = [];
    bankAccounts.forEach((ba) => {
      if (ba.account_id) {
        list.push({
          id: ba.account_id,
          code: ba.code,
          name: `${ba.bank_name} - ${ba.account_number}`,
          type: "bank",
          entity_name: ba.bank_name,
        });
      }
    });
    cashBoxes.forEach((cb) => {
      if (cb.account_id) {
        list.push({
          id: cb.account_id,
          code: cb.code,
          name: cb.name,
          type: "cash",
          entity_name: cb.name,
        });
      }
    });
    return list;
  }, [bankAccounts, cashBoxes]);

  // Get relevant GL account IDs based on active tab and selection
  const relevantAccountIds = useMemo(() => {
    let filtered = accountsList;
    if (activeTab === "bank") {
      filtered = filtered.filter((a) => a.type === "bank");
    } else if (activeTab === "cash") {
      filtered = filtered.filter((a) => a.type === "cash");
    }
    if (selectedAccountId !== "all") {
      filtered = filtered.filter((a) => a.id === selectedAccountId);
    }
    return filtered.map((a) => a.id);
  }, [accountsList, activeTab, selectedAccountId]);

  // Fetch journal entry lines for the relevant accounts
  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["bank-cash-movements", relevantAccountIds, dateFrom, dateTo],
    queryFn: async () => {
      if (relevantAccountIds.length === 0) return [];

      let query = supabase
        .from("journal_entry_lines")
        .select(`
          id,
          journal_entry_id,
          account_id,
          debit_amount,
          credit_amount,
          description,
          created_at,
          journal_entry:journal_entries!inner(
            entry_number,
            entry_date,
            description,
            is_posted,
            reference
          )
        `)
        .in("account_id", relevantAccountIds)
        .eq("journal_entry.is_posted", true)
        .order("created_at", { ascending: true });

      if (dateFrom) {
        query = query.gte("journal_entry.entry_date", dateFrom);
      }
      if (dateTo) {
        query = query.lte("journal_entry.entry_date", dateTo);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as MovementLine[]) || [];
    },
    enabled: relevantAccountIds.length > 0,
  });

  // Filter by search query
  const filteredMovements = useMemo(() => {
    if (!searchQuery.trim()) return movements;
    const q = searchQuery.toLowerCase();
    return movements.filter(
      (m) =>
        m.journal_entry?.entry_number?.toLowerCase().includes(q) ||
        m.journal_entry?.description?.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q) ||
        m.journal_entry?.reference?.toLowerCase().includes(q)
    );
  }, [movements, searchQuery]);

  // Calculate running balance and totals
  const { movementsWithBalance, totalDebit, totalCredit } = useMemo(() => {
    let runningBalance = 0;
    let totalDebit = 0;
    let totalCredit = 0;

    const withBalance = filteredMovements.map((m) => {
      const debit = m.debit_amount || 0;
      const credit = m.credit_amount || 0;
      totalDebit += debit;
      totalCredit += credit;
      runningBalance += debit - credit;
      return { ...m, runningBalance };
    });

    return { movementsWithBalance: withBalance, totalDebit, totalCredit };
  }, [filteredMovements]);

  // Get the account info for a given account_id
  const getAccountInfo = (accountId: string) =>
    accountsList.find((a) => a.id === accountId);

  // Filter accounts for dropdown based on active tab
  const filteredAccountsList = useMemo(() => {
    if (activeTab === "bank") return accountsList.filter((a) => a.type === "bank");
    if (activeTab === "cash") return accountsList.filter((a) => a.type === "cash");
    return accountsList;
  }, [accountsList, activeTab]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <ListPageHeader
        title="تقرير حركة البنوك والصناديق"
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "النظام المالي" },
          { label: "تقرير حركة البنوك والصناديق" },
        ]}
        showAdd={false}
        showSearch={false}
      />
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 me-2" />
            طباعة
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              إجمالي المدين (الإيداعات)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {totalDebit.toLocaleString("ar-SA", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              إجمالي الدائن (السحوبات)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {totalCredit.toLocaleString("ar-SA", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              صافي الحركة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                totalDebit - totalCredit >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {(totalDebit - totalCredit).toLocaleString("ar-SA", {
                minimumFractionDigits: 2,
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
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
            <div className="space-y-2">
              <Label>الحساب</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="جميع الحسابات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحسابات</SelectItem>
                  {filteredAccountsList.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      <span className="flex items-center gap-2">
                        {acc.type === "bank" ? (
                          <Building2 className="h-3 w-3" />
                        ) : (
                          <Wallet className="h-3 w-3" />
                        )}
                        {acc.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>بحث</Label>
              <div className="relative">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="رقم القيد، الوصف، المرجع..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ps-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedAccountId("all"); }}>
        <TabsList>
          <TabsTrigger value="all">
            الكل
          </TabsTrigger>
          <TabsTrigger value="bank">
            <Building2 className="h-4 w-4 me-2" />
            البنوك
          </TabsTrigger>
          <TabsTrigger value="cash">
            <Wallet className="h-4 w-4 me-2" />
            الصناديق
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">
                  جاري تحميل الحركات...
                </div>
              ) : relevantAccountIds.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  لا توجد حسابات مرتبطة بالبنوك أو الصناديق.
                  <br />
                  تأكد من ربط حساب دفتر أستاذ (GL Account) لكل بنك أو صندوق في شاشة الصناديق والبنوك.
                </div>
              ) : movementsWithBalance.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  لا توجد حركات مسجلة للفترة المحددة
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">التاريخ</TableHead>
                      <TableHead className="w-[140px]">رقم القيد</TableHead>
                      <TableHead>الحساب</TableHead>
                      <TableHead>البيان</TableHead>
                      <TableHead className="w-[100px]">المرجع</TableHead>
                      <TableHead className="w-[130px] text-left">مدين</TableHead>
                      <TableHead className="w-[130px] text-left">دائن</TableHead>
                      <TableHead className="w-[140px] text-left">الرصيد</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movementsWithBalance.map((m) => {
                      const accInfo = getAccountInfo(m.account_id);
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="text-sm">
                            {m.journal_entry?.entry_date
                              ? format(new Date(m.journal_entry.entry_date), "yyyy/MM/dd")
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">
                              {m.journal_entry?.entry_number}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {accInfo?.type === "bank" ? (
                                <Badge variant="outline" className="text-xs">
                                  <Building2 className="h-3 w-3 me-1" />
                                  بنك
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">
                                  <Wallet className="h-3 w-3 me-1" />
                                  صندوق
                                </Badge>
                              )}
                              <span className="text-sm">{accInfo?.entity_name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {m.description || m.journal_entry?.description || "-"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {m.journal_entry?.reference || "-"}
                          </TableCell>
                          <TableCell className="text-left font-mono">
                            {(m.debit_amount || 0) > 0 ? (
                              <span className="text-green-600">
                                {(m.debit_amount || 0).toLocaleString("ar-SA", {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="text-left font-mono">
                            {(m.credit_amount || 0) > 0 ? (
                              <span className="text-red-600">
                                {(m.credit_amount || 0).toLocaleString("ar-SA", {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell
                            className={`text-left font-mono font-semibold ${
                              m.runningBalance >= 0 ? "text-green-700" : "text-red-700"
                            }`}
                          >
                            {m.runningBalance.toLocaleString("ar-SA", {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {/* Totals Row */}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={5} className="text-left">
                        الإجمالي
                      </TableCell>
                      <TableCell className="text-left font-mono text-green-700">
                        {totalDebit.toLocaleString("ar-SA", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-left font-mono text-red-700">
                        {totalCredit.toLocaleString("ar-SA", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell
                        className={`text-left font-mono ${
                          totalDebit - totalCredit >= 0 ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {(totalDebit - totalCredit).toLocaleString("ar-SA", {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Scenario Explanation Card */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">كيف يعمل هذا التقرير؟</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>المصدر:</strong> يعرض هذا التقرير جميع الحركات من <strong>قيود اليومية المرحّلة</strong> المرتبطة
            بحسابات دفتر الأستاذ (GL) الخاصة بالبنوك والصناديق.
          </p>
          <p>
            <strong>الربط:</strong> كل بنك/صندوق في شاشة "الصناديق والبنوك" يجب أن يكون مرتبطاً بحساب في شجرة الحسابات.
            التقرير يسحب الحركات بناءً على هذا الربط.
          </p>
          <p>
            <strong>كشوفات البنك (Bank Statements):</strong> هي شاشة منفصلة لإدخال بيانات الكشف الوارد من البنك الخارجي،
            وتُستخدم في عملية <strong>المطابقة البنكية</strong> فقط. كشوفات البنك مرتبطة بـ <strong>الحساب البنكي</strong> مباشرة
            (وليس بأنواع القيود/الدفاتر).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
