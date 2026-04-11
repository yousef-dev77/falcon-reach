import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Eye, Trash2, FileText, ArrowLeft } from "lucide-react";
import { ListPageHeader } from "@/components/ListPageHeader";

interface BankStatement {
  id: string;
  bank_account_id: string;
  statement_date: string;
  statement_number: string | null;
  opening_balance: number;
  closing_balance: number;
  status: string | null;
  created_by: string;
  created_at: string;
  bank_account?: {
    id: string;
    code: string;
    bank_name: string;
    account_number: string;
  };
}

interface StatementLine {
  id: string;
  statement_id: string;
  transaction_date: string;
  description: string | null;
  reference: string | null;
  debit_amount: number | null;
  credit_amount: number | null;
  is_matched: boolean | null;
}

export default function BankStatements() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedStatement, setSelectedStatement] = useState<BankStatement | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLineDialogOpen, setIsLineDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLineId, setDeleteLineId] = useState<string | null>(null);

  // Fetch bank accounts
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts-for-statements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, code, bank_name, account_number")
        .eq("is_active", true)
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  // Fetch statements
  const { data: statements = [], isLoading } = useQuery({
    queryKey: ["bank-statements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_statements")
        .select(`
          *,
          bank_account:bank_accounts(id, code, bank_name, account_number)
        `)
        .order("statement_date", { ascending: false });
      if (error) throw error;
      return data as BankStatement[];
    },
  });

  // Fetch statement lines for selected statement
  const { data: statementLines = [], isLoading: linesLoading } = useQuery({
    queryKey: ["bank-statement-lines", selectedStatement?.id],
    queryFn: async () => {
      if (!selectedStatement) return [];
      const { data, error } = await supabase
        .from("bank_statement_lines")
        .select("*")
        .eq("statement_id", selectedStatement.id)
        .order("transaction_date", { ascending: true });
      if (error) throw error;
      return data as StatementLine[];
    },
    enabled: !!selectedStatement,
  });

  // Create statement mutation
  const createMutation = useMutation({
    mutationFn: async (values: any) => {
      const { error } = await supabase.from("bank_statements").insert([{
        ...values,
        created_by: user?.id,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-statements"] });
      toast.success("تم إنشاء كشف الحساب بنجاح");
      setIsCreateOpen(false);
    },
    onError: (error: any) => toast.error("حدث خطأ: " + error.message),
  });

  // Delete statement mutation
  const deleteStatementMutation = useMutation({
    mutationFn: async (id: string) => {
      // Delete lines first
      await supabase.from("bank_statement_lines").delete().eq("statement_id", id);
      const { error } = await supabase.from("bank_statements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-statements"] });
      toast.success("تم حذف الكشف بنجاح");
      setDeleteId(null);
      if (selectedStatement?.id === deleteId) setSelectedStatement(null);
    },
    onError: (error: any) => toast.error("حدث خطأ: " + error.message),
  });

  // Add line mutation
  const addLineMutation = useMutation({
    mutationFn: async (values: any) => {
      const { error } = await supabase.from("bank_statement_lines").insert([{
        ...values,
        statement_id: selectedStatement?.id,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-statement-lines", selectedStatement?.id] });
      toast.success("تم إضافة السطر بنجاح");
      setIsLineDialogOpen(false);
    },
    onError: (error: any) => toast.error("حدث خطأ: " + error.message),
  });

  // Delete line mutation
  const deleteLineMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bank_statement_lines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-statement-lines", selectedStatement?.id] });
      toast.success("تم حذف السطر");
      setDeleteLineId(null);
    },
    onError: (error: any) => toast.error("حدث خطأ: " + error.message),
  });

  const handleCreateStatement = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      bank_account_id: fd.get("bank_account_id"),
      statement_date: fd.get("statement_date"),
      statement_number: fd.get("statement_number") || null,
      opening_balance: parseFloat(fd.get("opening_balance") as string) || 0,
      closing_balance: parseFloat(fd.get("closing_balance") as string) || 0,
      status: "draft",
    });
  };

  const handleAddLine = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    addLineMutation.mutate({
      transaction_date: fd.get("transaction_date"),
      description: fd.get("description") || null,
      reference: fd.get("reference") || null,
      debit_amount: parseFloat(fd.get("debit_amount") as string) || 0,
      credit_amount: parseFloat(fd.get("credit_amount") as string) || 0,
    });
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "draft": return <Badge variant="outline">مسودة</Badge>;
      case "confirmed": return <Badge variant="default">مؤكد</Badge>;
      case "reconciled": return <Badge variant="secondary">تمت المطابقة</Badge>;
      default: return <Badge variant="outline">مسودة</Badge>;
    }
  };

  // Calculate totals for lines
  const totalDebit = statementLines.reduce((sum, l) => sum + (l.debit_amount || 0), 0);
  const totalCredit = statementLines.reduce((sum, l) => sum + (l.credit_amount || 0), 0);

  // Detail view for a specific statement
  if (selectedStatement) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedStatement(null)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                كشف حساب: {selectedStatement.bank_account?.bank_name}
              </h1>
              <p className="text-muted-foreground">
                {selectedStatement.statement_number && `رقم: ${selectedStatement.statement_number} • `}
                تاريخ: {format(new Date(selectedStatement.statement_date), "yyyy-MM-dd")}
              </p>
            </div>
          </div>
          <Button onClick={() => setIsLineDialogOpen(true)}>
            <Plus className="ml-2 h-4 w-4" />
            إضافة سطر
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">الرصيد الافتتاحي</p>
              <p className="text-xl font-bold">{selectedStatement.opening_balance.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">إجمالي المدين</p>
              <p className="text-xl font-bold text-red-600">{totalDebit.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">إجمالي الدائن</p>
              <p className="text-xl font-bold text-green-600">{totalCredit.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">الرصيد الختامي</p>
              <p className="text-xl font-bold">{selectedStatement.closing_balance.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Lines Table */}
        <Card>
          <CardHeader>
            <CardTitle>سطور الكشف</CardTitle>
          </CardHeader>
          <CardContent>
            {linesLoading ? (
              <div className="text-center py-8">جاري التحميل...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الوصف</TableHead>
                    <TableHead>المرجع</TableHead>
                    <TableHead>مدين</TableHead>
                    <TableHead>دائن</TableHead>
                    <TableHead>مطابقة</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statementLines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>{format(new Date(line.transaction_date), "yyyy-MM-dd")}</TableCell>
                      <TableCell>{line.description || "-"}</TableCell>
                      <TableCell>{line.reference || "-"}</TableCell>
                      <TableCell className="text-red-600">
                        {(line.debit_amount || 0) > 0 ? line.debit_amount?.toLocaleString() : "-"}
                      </TableCell>
                      <TableCell className="text-green-600">
                        {(line.credit_amount || 0) > 0 ? line.credit_amount?.toLocaleString() : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={line.is_matched ? "default" : "outline"}>
                          {line.is_matched ? "نعم" : "لا"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteLineId(line.id)}
                          disabled={line.is_matched === true}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {statementLines.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        لا توجد سطور. قم بإضافة عمليات كشف البنك.
                      </TableCell>
                    </TableRow>
                  )}
                  {statementLines.length > 0 && (
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell colSpan={3}>الإجمالي</TableCell>
                      <TableCell className="text-red-600">{totalDebit.toLocaleString()}</TableCell>
                      <TableCell className="text-green-600">{totalCredit.toLocaleString()}</TableCell>
                      <TableCell colSpan={2} />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Add Line Dialog */}
        <Dialog open={isLineDialogOpen} onOpenChange={setIsLineDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إضافة سطر كشف</DialogTitle>
              <DialogDescription>أدخل بيانات العملية البنكية من كشف البنك</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddLine} className="space-y-4">
              <div>
                <Label>تاريخ العملية</Label>
                <Input name="transaction_date" type="date" required defaultValue={format(new Date(), "yyyy-MM-dd")} />
              </div>
              <div>
                <Label>الوصف</Label>
                <Input name="description" placeholder="وصف العملية..." />
              </div>
              <div>
                <Label>المرجع</Label>
                <Input name="reference" placeholder="رقم الشيك أو المرجع..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>مدين (سحب)</Label>
                  <Input name="debit_amount" type="number" step="0.01" defaultValue="0" />
                </div>
                <div>
                  <Label>دائن (إيداع)</Label>
                  <Input name="credit_amount" type="number" step="0.01" defaultValue="0" />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={addLineMutation.isPending}>
                {addLineMutation.isPending ? "جاري الإضافة..." : "إضافة السطر"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Line Confirmation */}
        <AlertDialog open={!!deleteLineId} onOpenChange={() => setDeleteLineId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
              <AlertDialogDescription>هل أنت متأكد من حذف هذا السطر؟</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteLineId && deleteLineMutation.mutate(deleteLineId)}>
                حذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Main list view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">كشوفات الحسابات البنكية</h1>
          <p className="text-muted-foreground">
            إدخال كشوفات البنك الخارجية للمطابقة البنكية
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="ml-2 h-4 w-4" />
          كشف جديد
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            قائمة كشوفات البنك
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">جاري التحميل...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الكشف</TableHead>
                  <TableHead>البنك</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الرصيد الافتتاحي</TableHead>
                  <TableHead>الرصيد الختامي</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statements.map((stmt) => (
                  <TableRow key={stmt.id}>
                    <TableCell className="font-mono">{stmt.statement_number || "-"}</TableCell>
                    <TableCell>
                      {stmt.bank_account?.bank_name} ({stmt.bank_account?.account_number})
                    </TableCell>
                    <TableCell>{format(new Date(stmt.statement_date), "yyyy-MM-dd")}</TableCell>
                    <TableCell>{stmt.opening_balance.toLocaleString()}</TableCell>
                    <TableCell>{stmt.closing_balance.toLocaleString()}</TableCell>
                    <TableCell>{getStatusBadge(stmt.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setSelectedStatement(stmt)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(stmt.id)}
                          disabled={stmt.status === "reconciled"}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {statements.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      لا توجد كشوفات بنكية. قم بإنشاء كشف جديد.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Statement Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إنشاء كشف حساب بنكي جديد</DialogTitle>
            <DialogDescription>أدخل بيانات كشف الحساب البنكي الوارد من البنك</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateStatement} className="space-y-4">
            <div>
              <Label>الحساب البنكي *</Label>
              <Select name="bank_account_id" required>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الحساب البنكي..." />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((bank) => (
                    <SelectItem key={bank.id} value={bank.id}>
                      {bank.code} - {bank.bank_name} ({bank.account_number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>تاريخ الكشف *</Label>
                <Input name="statement_date" type="date" required defaultValue={format(new Date(), "yyyy-MM-dd")} />
              </div>
              <div>
                <Label>رقم الكشف</Label>
                <Input name="statement_number" placeholder="اختياري" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>الرصيد الافتتاحي</Label>
                <Input name="opening_balance" type="number" step="0.01" defaultValue="0" required />
              </div>
              <div>
                <Label>الرصيد الختامي</Label>
                <Input name="closing_balance" type="number" step="0.01" defaultValue="0" required />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
              {createMutation.isPending ? "جاري الإنشاء..." : "إنشاء الكشف"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف كشف الحساب وجميع سطوره. هل أنت متأكد؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteStatementMutation.mutate(deleteId)}>
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
