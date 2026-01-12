import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Truck, Building2, Wallet, Search, FileText } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

type LedgerType = "customers" | "suppliers" | "bank_accounts" | "cash_boxes";

interface LedgerEntry {
  id: string;
  entry_date: string;
  entry_number: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
  balance: number;
  reference: string;
}

export default function SubLedger() {
  const [ledgerType, setLedgerType] = useState<LedgerType>("customers");
  const [selectedEntity, setSelectedEntity] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Fetch customers
  const { data: customers } = useQuery({
    queryKey: ["customers-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, code, name, account_id")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: ledgerType === "customers",
  });

  // Fetch suppliers
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, code, name, account_id")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: ledgerType === "suppliers",
  });

  // Fetch bank accounts
  const { data: bankAccounts } = useQuery({
    queryKey: ["bank-accounts-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, code, bank_name, account_number, account_id")
        .eq("is_active", true)
        .order("bank_name");
      if (error) throw error;
      return data;
    },
    enabled: ledgerType === "bank_accounts",
  });

  // Fetch cash boxes
  const { data: cashBoxes } = useQuery({
    queryKey: ["cash-boxes-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_boxes")
        .select("id, code, name, account_id")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: ledgerType === "cash_boxes",
  });

  // Get account_id based on selected entity
  const getAccountId = () => {
    switch (ledgerType) {
      case "customers":
        return customers?.find((c) => c.id === selectedEntity)?.account_id;
      case "suppliers":
        return suppliers?.find((s) => s.id === selectedEntity)?.account_id;
      case "bank_accounts":
        return bankAccounts?.find((b) => b.id === selectedEntity)?.account_id;
      case "cash_boxes":
        return cashBoxes?.find((c) => c.id === selectedEntity)?.account_id;
    }
  };

  // Fetch ledger entries
  const { data: ledgerEntries, isLoading } = useQuery({
    queryKey: ["sub-ledger", ledgerType, selectedEntity, dateFrom, dateTo],
    queryFn: async () => {
      const accountId = getAccountId();
      if (!accountId) return [];

      let query = supabase
        .from("journal_entry_lines")
        .select(`
          id,
          debit_amount,
          credit_amount,
          description,
          journal_entry:journal_entries(
            id,
            entry_date,
            entry_number,
            description,
            reference,
            is_posted
          )
        `)
        .eq("account_id", accountId)
        .eq("journal_entry.is_posted", true)
        .order("journal_entry(entry_date)", { ascending: true });

      const { data, error } = await query;
      if (error) throw error;

      // Calculate running balance
      let balance = 0;
      return data
        .filter((entry) => entry.journal_entry !== null)
        .map((entry) => {
          const debit = entry.debit_amount || 0;
          const credit = entry.credit_amount || 0;
          balance += debit - credit;
          return {
            id: entry.id,
            entry_date: entry.journal_entry?.entry_date,
            entry_number: entry.journal_entry?.entry_number,
            description: entry.description || entry.journal_entry?.description,
            reference: entry.journal_entry?.reference,
            debit_amount: debit,
            credit_amount: credit,
            balance,
          };
        });
    },
    enabled: !!selectedEntity && !!getAccountId(),
  });

  const getEntityOptions = () => {
    switch (ledgerType) {
      case "customers":
        return customers?.map((c) => ({ id: c.id, label: `${c.code} - ${c.name}` })) || [];
      case "suppliers":
        return suppliers?.map((s) => ({ id: s.id, label: `${s.code} - ${s.name}` })) || [];
      case "bank_accounts":
        return bankAccounts?.map((b) => ({ id: b.id, label: `${b.bank_name} - ${b.account_number}` })) || [];
      case "cash_boxes":
        return cashBoxes?.map((c) => ({ id: c.id, label: `${c.code} - ${c.name}` })) || [];
    }
  };

  const totals = ledgerEntries?.reduce(
    (acc, entry) => ({
      debit: acc.debit + (entry.debit_amount || 0),
      credit: acc.credit + (entry.credit_amount || 0),
    }),
    { debit: 0, credit: 0 }
  ) || { debit: 0, credit: 0 };

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">دفتر الأستاذ المساعد</h1>
          <p className="text-muted-foreground mt-1">
            كشف حساب تفصيلي للعملاء والموردين والبنوك والصناديق
          </p>
        </div>

        <Tabs value={ledgerType} onValueChange={(v) => { setLedgerType(v as LedgerType); setSelectedEntity(""); }}>
          <TabsList className="grid grid-cols-4 w-full max-w-xl">
            <TabsTrigger value="customers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              العملاء
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              الموردين
            </TabsTrigger>
            <TabsTrigger value="bank_accounts" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              البنوك
            </TabsTrigger>
            <TabsTrigger value="cash_boxes" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              الصناديق
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  اختيار الحساب
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>اختر الحساب</Label>
                    <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر..." />
                      </SelectTrigger>
                      <SelectContent>
                        {getEntityOptions().map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
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
                  <div className="flex items-end">
                    <Button className="w-full">
                      <FileText className="ml-2 h-4 w-4" />
                      عرض الكشف
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {selectedEntity && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>كشف الحساب</CardTitle>
                  <CardDescription>
                    {getEntityOptions().find((o) => o.id === selectedEntity)?.label}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-8">جاري التحميل...</div>
                  ) : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>التاريخ</TableHead>
                            <TableHead>رقم القيد</TableHead>
                            <TableHead>البيان</TableHead>
                            <TableHead>المرجع</TableHead>
                            <TableHead className="text-left">مدين</TableHead>
                            <TableHead className="text-left">دائن</TableHead>
                            <TableHead className="text-left">الرصيد</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ledgerEntries?.map((entry) => (
                            <TableRow key={entry.id}>
                              <TableCell>
                                {entry.entry_date ? format(new Date(entry.entry_date), "dd/MM/yyyy") : "-"}
                              </TableCell>
                              <TableCell className="font-mono">{entry.entry_number}</TableCell>
                              <TableCell>{entry.description || "-"}</TableCell>
                              <TableCell>{entry.reference || "-"}</TableCell>
                              <TableCell className="text-left">
                                {entry.debit_amount > 0 ? entry.debit_amount.toLocaleString() : "-"}
                              </TableCell>
                              <TableCell className="text-left">
                                {entry.credit_amount > 0 ? entry.credit_amount.toLocaleString() : "-"}
                              </TableCell>
                              <TableCell className={`text-left font-bold ${entry.balance < 0 ? "text-destructive" : ""}`}>
                                {entry.balance.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ))}
                          {(!ledgerEntries || ledgerEntries.length === 0) && (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-8">
                                لا توجد حركات على هذا الحساب
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                        {ledgerEntries && ledgerEntries.length > 0 && (
                          <tfoot>
                            <TableRow className="bg-muted font-bold">
                              <TableCell colSpan={4}>الإجمالي</TableCell>
                              <TableCell className="text-left">{totals.debit.toLocaleString()}</TableCell>
                              <TableCell className="text-left">{totals.credit.toLocaleString()}</TableCell>
                              <TableCell className={`text-left ${(totals.debit - totals.credit) < 0 ? "text-destructive" : ""}`}>
                                {(totals.debit - totals.credit).toLocaleString()}
                              </TableCell>
                            </TableRow>
                          </tfoot>
                        )}
                      </Table>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </Tabs>
    </div>
  );
}
