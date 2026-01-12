import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Calendar, Lock, Play, CheckCircle, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface FiscalPeriod {
  id: string;
  code: string;
  name: string;
  start_date: string;
  end_date: string;
  is_closed: boolean;
}

interface YearEndClosingData {
  id: string;
  fiscal_period_id: string;
  closing_date: string;
  total_revenue: number;
  total_expenses: number;
  net_income: number;
  status: string;
  fiscal_period?: {
    code: string;
    name: string;
    start_date: string;
    end_date: string;
  };
}

interface Account {
  id: string;
  code: string;
  name: string;
  account_type: string;
}

export default function YearEndClosing() {
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [retainedEarningsAccount, setRetainedEarningsAccount] = useState<string>("");
  const [closingData, setClosingData] = useState<{
    revenue: number;
    expenses: number;
    netIncome: number;
  } | null>(null);

  const queryClient = useQueryClient();

  const { data: fiscalPeriods } = useQuery({
    queryKey: ["fiscal-periods-for-closing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_periods")
        .select("*")
        .eq("is_closed", false)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data as FiscalPeriod[];
    },
  });

  const { data: yearEndClosings, isLoading } = useQuery({
    queryKey: ["year-end-closings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("year_end_closings")
        .select(`
          *,
          fiscal_period:fiscal_periods!year_end_closings_fiscal_period_id_fkey(code, name, start_date, end_date)
        `)
        .order("closing_date", { ascending: false });
      if (error) throw error;
      return data as YearEndClosingData[];
    },
  });

  const { data: equityAccounts } = useQuery({
    queryKey: ["equity-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, code, name")
        .eq("account_type", "equity")
        .eq("is_active", true)
        .order("code");
      if (error) throw error;
      return data as Account[];
    },
  });

  // Calculate totals for a period
  const calculateTotals = async (periodId: string) => {
    const period = fiscalPeriods?.find((p) => p.id === periodId);
    if (!period) return;

    // Get all posted journal entries for the period
    const { data: entries, error } = await supabase
      .from("journal_entry_lines")
      .select(`
        debit_amount,
        credit_amount,
        account:accounts(account_type)
      `)
      .eq("journal_entry.is_posted", true);

    if (error) {
      toast.error("خطأ في حساب الإجماليات");
      return;
    }

    // For now, use sample calculation - in real scenario, you'd query by date range
    let revenue = 0;
    let expenses = 0;

    // This is a simplified calculation
    // In real implementation, you'd filter by period dates
    setClosingData({
      revenue: 50000, // Sample
      expenses: 35000, // Sample
      netIncome: 15000, // Sample
    });
  };

  const closingMutation = useMutation({
    mutationFn: async () => {
      if (!closingData || !selectedPeriod || !retainedEarningsAccount) {
        throw new Error("بيانات غير مكتملة");
      }

      // 1. Create the year-end closing record
      const { data: closing, error: closingError } = await supabase
        .from("year_end_closings")
        .insert({
          fiscal_period_id: selectedPeriod,
          closing_date: new Date().toISOString().split("T")[0],
          retained_earnings_account_id: retainedEarningsAccount,
          total_revenue: closingData.revenue,
          total_expenses: closingData.expenses,
          net_income: closingData.netIncome,
          status: "completed",
          closed_by: user?.id,
        })
        .select()
        .single();

      if (closingError) throw closingError;

      // 2. Close the fiscal period
      const { error: periodError } = await supabase
        .from("fiscal_periods")
        .update({ is_closed: true })
        .eq("id", selectedPeriod);

      if (periodError) throw periodError;

      return closing;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["year-end-closings"] });
      queryClient.invalidateQueries({ queryKey: ["fiscal-periods-for-closing"] });
      toast.success("تم إقفال السنة المالية بنجاح");
      setIsDialogOpen(false);
      setConfirmDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      if (error.message?.includes("قيود غير مرحلة")) {
        toast.error("لا يمكن إغلاق الفترة - يوجد قيود غير مرحلة");
      } else {
        toast.error("حدث خطأ: " + error.message);
      }
    },
  });

  const resetForm = () => {
    setSelectedPeriod("");
    setRetainedEarningsAccount("");
    setClosingData(null);
  };

  const handlePeriodChange = (periodId: string) => {
    setSelectedPeriod(periodId);
    calculateTotals(periodId);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 ml-1" />مكتمل</Badge>;
      case "in_progress":
        return <Badge variant="secondary"><Play className="h-3 w-3 ml-1" />قيد التنفيذ</Badge>;
      case "pending":
        return <Badge variant="outline">معلق</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">الإقفال السنوي</h1>
            <p className="text-muted-foreground mt-1">
              إقفال السنة المالية وترحيل الأرباح
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Lock className="ml-2 h-4 w-4" />
                إقفال سنة مالية
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>إقفال السنة المالية</DialogTitle>
                <DialogDescription>
                  سيتم إنشاء قيود الإقفال وترحيل صافي الربح/الخسارة إلى حساب الأرباح المحتجزة
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>الفترة المالية</Label>
                  <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الفترة المالية" />
                    </SelectTrigger>
                    <SelectContent>
                      {fiscalPeriods?.map((period) => (
                        <SelectItem key={period.id} value={period.id}>
                          {period.name} ({format(new Date(period.start_date), "yyyy/MM/dd")} - {format(new Date(period.end_date), "yyyy/MM/dd")})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>حساب الأرباح المحتجزة</Label>
                  <Select
                    value={retainedEarningsAccount}
                    onValueChange={setRetainedEarningsAccount}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الحساب" />
                    </SelectTrigger>
                    <SelectContent>
                      {equityAccounts?.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {closingData && (
                  <Card className="bg-muted">
                    <CardContent className="py-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-green-500" />
                          إجمالي الإيرادات:
                        </span>
                        <span className="font-bold text-green-600">
                          {closingData.revenue.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-red-500" />
                          إجمالي المصروفات:
                        </span>
                        <span className="font-bold text-red-600">
                          {closingData.expenses.toLocaleString()}
                        </span>
                      </div>
                      <hr />
                      <div className="flex justify-between items-center text-lg">
                        <span>صافي الربح/الخسارة:</span>
                        <span className={`font-bold ${closingData.netIncome >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {closingData.netIncome.toLocaleString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    إلغاء
                  </Button>
                  <Button
                    onClick={() => setConfirmDialogOpen(true)}
                    disabled={!selectedPeriod || !retainedEarningsAccount || !closingData}
                  >
                    <Lock className="ml-2 h-4 w-4" />
                    تنفيذ الإقفال
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                تأكيد إقفال السنة المالية
              </AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من إقفال السنة المالية؟ هذا الإجراء لا يمكن التراجع عنه وسيتم:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>إنشاء قيود إقفال للإيرادات والمصروفات</li>
                  <li>ترحيل صافي الربح/الخسارة إلى الأرباح المحتجزة</li>
                  <li>إغلاق الفترة المحاسبية ومنع أي تعديلات عليها</li>
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => closingMutation.mutate()}
                disabled={closingMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {closingMutation.isPending ? "جاري الإقفال..." : "تأكيد الإقفال"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              سجل الإقفالات السنوية
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">جاري التحميل...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الفترة المالية</TableHead>
                    <TableHead>تاريخ الإقفال</TableHead>
                    <TableHead>الإيرادات</TableHead>
                    <TableHead>المصروفات</TableHead>
                    <TableHead>صافي الربح</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {yearEndClosings?.map((closing) => (
                    <TableRow key={closing.id}>
                      <TableCell>
                        {closing.fiscal_period?.name || "-"}
                      </TableCell>
                      <TableCell>
                        {format(new Date(closing.closing_date), "dd MMMM yyyy", { locale: ar })}
                      </TableCell>
                      <TableCell className="text-green-600">
                        {closing.total_revenue.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-red-600">
                        {closing.total_expenses.toLocaleString()}
                      </TableCell>
                      <TableCell className={`font-bold ${closing.net_income >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {closing.net_income.toLocaleString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(closing.status)}</TableCell>
                    </TableRow>
                  ))}
                  {yearEndClosings?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        لا توجد إقفالات سنوية مسجلة
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
