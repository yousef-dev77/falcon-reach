import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, FileText, CheckCircle, AlertCircle, Building2 } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface BankStatement {
  id: string;
  bank_account_id: string;
  statement_date: string;
  statement_number: string;
  opening_balance: number;
  closing_balance: number;
  status: string;
  bank_account?: {
    code: string;
    bank_name: string;
    account_number: string;
    current_balance: number;
  };
}

interface BankReconciliation {
  id: string;
  bank_account_id: string;
  reconciliation_date: string;
  statement_balance: number;
  book_balance: number;
  difference: number;
  status: string;
  notes: string;
  bank_account?: {
    code: string;
    bank_name: string;
    account_number: string;
    current_balance: number;
  };
}

export default function BankReconciliation() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("statements");
  const [isStatementDialogOpen, setIsStatementDialogOpen] = useState(false);
  const [isReconciliationDialogOpen, setIsReconciliationDialogOpen] = useState(false);
  const [statementForm, setStatementForm] = useState({
    bank_account_id: "",
    statement_date: new Date().toISOString().split("T")[0],
    statement_number: "",
    opening_balance: "0",
    closing_balance: "0",
  });
  const [reconciliationForm, setReconciliationForm] = useState({
    bank_account_id: "",
    reconciliation_date: new Date().toISOString().split("T")[0],
    statement_balance: "0",
    book_balance: "0",
    notes: "",
  });

  const queryClient = useQueryClient();

  const { data: bankAccounts } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("is_active", true)
        .order("bank_name");
      if (error) throw error;
      return data as BankAccount[];
    },
  });

  const { data: statements, isLoading: statementsLoading } = useQuery({
    queryKey: ["bank-statements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_statements")
        .select(`
          *,
          bank_account:bank_accounts(code, bank_name, account_number, current_balance)
        `)
        .order("statement_date", { ascending: false });
      if (error) throw error;
      return data as BankStatement[];
    },
  });

  const { data: reconciliations, isLoading: reconciliationsLoading } = useQuery({
    queryKey: ["bank-reconciliations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_reconciliations")
        .select(`
          *,
          bank_account:bank_accounts(code, bank_name, account_number, current_balance)
        `)
        .order("reconciliation_date", { ascending: false });
      if (error) throw error;
      return data as BankReconciliation[];
    },
  });

  const saveStatementMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("bank_statements").insert({
        ...data,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-statements"] });
      toast.success("تم إضافة كشف البنك بنجاح");
      setIsStatementDialogOpen(false);
      setStatementForm({
        bank_account_id: "",
        statement_date: new Date().toISOString().split("T")[0],
        statement_number: "",
        opening_balance: "0",
        closing_balance: "0",
      });
    },
    onError: (error) => {
      toast.error("حدث خطأ: " + error.message);
    },
  });

  const saveReconciliationMutation = useMutation({
    mutationFn: async (data: any) => {
      const difference = parseFloat(data.statement_balance) - parseFloat(data.book_balance);
      const { error } = await supabase.from("bank_reconciliations").insert({
        ...data,
        difference,
        status: difference === 0 ? "completed" : "pending",
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-reconciliations"] });
      toast.success("تم حفظ التسوية بنجاح");
      setIsReconciliationDialogOpen(false);
      setReconciliationForm({
        bank_account_id: "",
        reconciliation_date: new Date().toISOString().split("T")[0],
        statement_balance: "0",
        book_balance: "0",
        notes: "",
      });
    },
    onError: (error) => {
      toast.error("حدث خطأ: " + error.message);
    },
  });

  const handleStatementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveStatementMutation.mutate({
      bank_account_id: statementForm.bank_account_id,
      statement_date: statementForm.statement_date,
      statement_number: statementForm.statement_number,
      opening_balance: parseFloat(statementForm.opening_balance),
      closing_balance: parseFloat(statementForm.closing_balance),
    });
  };

  const handleReconciliationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveReconciliationMutation.mutate({
      bank_account_id: reconciliationForm.bank_account_id,
      reconciliation_date: reconciliationForm.reconciliation_date,
      statement_balance: parseFloat(reconciliationForm.statement_balance),
      book_balance: parseFloat(reconciliationForm.book_balance),
      notes: reconciliationForm.notes,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 ml-1" />مكتملة</Badge>;
      case "in_progress":
        return <Badge variant="secondary">قيد العمل</Badge>;
      case "pending":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 ml-1" />معلقة</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">التسوية البنكية</h1>
            <p className="text-muted-foreground mt-1">
              مطابقة كشوف البنك مع القيود المحاسبية
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="statements">كشوف البنك</TabsTrigger>
            <TabsTrigger value="reconciliations">التسويات</TabsTrigger>
          </TabsList>

          <TabsContent value="statements" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={isStatementDialogOpen} onOpenChange={setIsStatementDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="ml-2 h-4 w-4" />
                    إضافة كشف بنك
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>إضافة كشف بنك جديد</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleStatementSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>الحساب البنكي</Label>
                      <Select
                        value={statementForm.bank_account_id}
                        onValueChange={(value) =>
                          setStatementForm({ ...statementForm, bank_account_id: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="اختر الحساب البنكي" />
                        </SelectTrigger>
                        <SelectContent>
                          {bankAccounts?.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.bank_name} - {account.account_number}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>تاريخ الكشف</Label>
                        <Input
                          type="date"
                          value={statementForm.statement_date}
                          onChange={(e) =>
                            setStatementForm({ ...statementForm, statement_date: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>رقم الكشف</Label>
                        <Input
                          value={statementForm.statement_number}
                          onChange={(e) =>
                            setStatementForm({ ...statementForm, statement_number: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>الرصيد الافتتاحي</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={statementForm.opening_balance}
                          onChange={(e) =>
                            setStatementForm({ ...statementForm, opening_balance: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>الرصيد الختامي</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={statementForm.closing_balance}
                          onChange={(e) =>
                            setStatementForm({ ...statementForm, closing_balance: e.target.value })
                          }
                          required
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button type="button" variant="outline" onClick={() => setIsStatementDialogOpen(false)}>
                        إلغاء
                      </Button>
                      <Button type="submit" disabled={saveStatementMutation.isPending}>
                        {saveStatementMutation.isPending ? "جاري الحفظ..." : "حفظ"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  كشوف البنك
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statementsLoading ? (
                  <div className="text-center py-8">جاري التحميل...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>البنك</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>رقم الكشف</TableHead>
                        <TableHead>الرصيد الافتتاحي</TableHead>
                        <TableHead>الرصيد الختامي</TableHead>
                        <TableHead>الحالة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statements?.map((statement) => (
                        <TableRow key={statement.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              {statement.bank_account?.bank_name}
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(new Date(statement.statement_date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>{statement.statement_number || "-"}</TableCell>
                          <TableCell>{statement.opening_balance.toLocaleString()}</TableCell>
                          <TableCell>{statement.closing_balance.toLocaleString()}</TableCell>
                          <TableCell>{getStatusBadge(statement.status)}</TableCell>
                        </TableRow>
                      ))}
                      {statements?.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            لا توجد كشوف بنكية مسجلة
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reconciliations" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={isReconciliationDialogOpen} onOpenChange={setIsReconciliationDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="ml-2 h-4 w-4" />
                    تسوية جديدة
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>إنشاء تسوية بنكية جديدة</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleReconciliationSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>الحساب البنكي</Label>
                      <Select
                        value={reconciliationForm.bank_account_id}
                        onValueChange={(value) => {
                          const account = bankAccounts?.find((a) => a.id === value);
                          setReconciliationForm({
                            ...reconciliationForm,
                            bank_account_id: value,
                            book_balance: account?.current_balance?.toString() || "0",
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="اختر الحساب البنكي" />
                        </SelectTrigger>
                        <SelectContent>
                          {bankAccounts?.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.bank_name} - {account.account_number}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>تاريخ التسوية</Label>
                      <Input
                        type="date"
                        value={reconciliationForm.reconciliation_date}
                        onChange={(e) =>
                          setReconciliationForm({ ...reconciliationForm, reconciliation_date: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>رصيد كشف البنك</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={reconciliationForm.statement_balance}
                          onChange={(e) =>
                            setReconciliationForm({ ...reconciliationForm, statement_balance: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>رصيد الدفاتر</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={reconciliationForm.book_balance}
                          onChange={(e) =>
                            setReconciliationForm({ ...reconciliationForm, book_balance: e.target.value })
                          }
                          required
                        />
                      </div>
                    </div>

                    <Card className="bg-muted">
                      <CardContent className="py-3">
                        <div className="flex justify-between items-center">
                          <span>الفرق:</span>
                          <span className={`font-bold ${parseFloat(reconciliationForm.statement_balance) - parseFloat(reconciliationForm.book_balance) !== 0 ? "text-destructive" : "text-green-600"}`}>
                            {(parseFloat(reconciliationForm.statement_balance || "0") - parseFloat(reconciliationForm.book_balance || "0")).toLocaleString()}
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="space-y-2">
                      <Label>ملاحظات</Label>
                      <Textarea
                        value={reconciliationForm.notes}
                        onChange={(e) =>
                          setReconciliationForm({ ...reconciliationForm, notes: e.target.value })
                        }
                        placeholder="أي ملاحظات إضافية..."
                      />
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button type="button" variant="outline" onClick={() => setIsReconciliationDialogOpen(false)}>
                        إلغاء
                      </Button>
                      <Button type="submit" disabled={saveReconciliationMutation.isPending}>
                        {saveReconciliationMutation.isPending ? "جاري الحفظ..." : "حفظ"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  سجل التسويات
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reconciliationsLoading ? (
                  <div className="text-center py-8">جاري التحميل...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>البنك</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>رصيد الكشف</TableHead>
                        <TableHead>رصيد الدفاتر</TableHead>
                        <TableHead>الفرق</TableHead>
                        <TableHead>الحالة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reconciliations?.map((rec) => (
                        <TableRow key={rec.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              {rec.bank_account?.bank_name}
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(new Date(rec.reconciliation_date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>{rec.statement_balance.toLocaleString()}</TableCell>
                          <TableCell>{rec.book_balance.toLocaleString()}</TableCell>
                          <TableCell className={rec.difference !== 0 ? "text-destructive font-bold" : "text-green-600"}>
                            {rec.difference.toLocaleString()}
                          </TableCell>
                          <TableCell>{getStatusBadge(rec.status)}</TableCell>
                        </TableRow>
                      ))}
                      {reconciliations?.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            لا توجد تسويات مسجلة
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
