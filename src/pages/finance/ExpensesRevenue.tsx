import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, Plus, Edit, Trash2, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";

type ExpenseRevenue = {
  id: string;
  transaction_number: string;
  transaction_date: string;
  transaction_type: "expense" | "revenue";
  category: string | null;
  description: string | null;
  amount: number;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
};

export default function ExpensesRevenue() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<ExpenseRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<ExpenseRevenue | null>(null);
  const [formData, setFormData] = useState({
    transaction_number: "",
    transaction_date: new Date().toISOString().split("T")[0],
    transaction_type: "expense" as "expense" | "revenue",
    category: "",
    description: "",
    amount: 0,
    payment_method: "cash",
    reference: "",
    notes: "",
  });

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("expenses_revenues")
      .select("*")
      .order("transaction_date", { ascending: false });

    if (error) {
      toast.error("خطأ في جلب البيانات");
      console.error(error);
    } else {
      setTransactions((data || []) as ExpenseRevenue[]);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("يجب تسجيل الدخول أولاً");
      return;
    }

    const transactionData = {
      transaction_number: formData.transaction_number,
      transaction_date: formData.transaction_date,
      transaction_type: formData.transaction_type,
      category: formData.category || null,
      description: formData.description || null,
      amount: formData.amount,
      payment_method: formData.payment_method || null,
      reference: formData.reference || null,
      notes: formData.notes || null,
    };

    if (editingTransaction) {
      const { error } = await supabase
        .from("expenses_revenues")
        .update(transactionData)
        .eq("id", editingTransaction.id);

      if (error) {
        toast.error("خطأ في تحديث العملية");
        console.error(error);
      } else {
        toast.success("تم تحديث العملية بنجاح");
        fetchTransactions();
        resetForm();
      }
    } else {
      const { error } = await supabase.from("expenses_revenues").insert({
        ...transactionData,
        created_by: user.id,
      });

      if (error) {
        toast.error("خطأ في إضافة العملية");
        console.error(error);
      } else {
        toast.success("تم إضافة العملية بنجاح");
        fetchTransactions();
        resetForm();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه العملية؟")) return;

    const { error } = await supabase.from("expenses_revenues").delete().eq("id", id);

    if (error) {
      toast.error("خطأ في حذف العملية");
      console.error(error);
    } else {
      toast.success("تم حذف العملية بنجاح");
      fetchTransactions();
    }
  };

  const handleEdit = (transaction: ExpenseRevenue) => {
    setEditingTransaction(transaction);
    setFormData({
      transaction_number: transaction.transaction_number,
      transaction_date: transaction.transaction_date,
      transaction_type: transaction.transaction_type,
      category: transaction.category || "",
      description: transaction.description || "",
      amount: transaction.amount,
      payment_method: transaction.payment_method || "cash",
      reference: transaction.reference || "",
      notes: transaction.notes || "",
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      transaction_number: "",
      transaction_date: new Date().toISOString().split("T")[0],
      transaction_type: "expense",
      category: "",
      description: "",
      amount: 0,
      payment_method: "cash",
      reference: "",
      notes: "",
    });
    setEditingTransaction(null);
    setIsDialogOpen(false);
  };

  const openAddDialog = (type: "expense" | "revenue") => {
    resetForm();
    setFormData((prev) => ({ ...prev, transaction_type: type }));
    setIsDialogOpen(true);
  };

  // Calculate this month totals
  const now = new Date();
  const monthStart = startOfMonth(now).toISOString().split("T")[0];
  const monthEnd = endOfMonth(now).toISOString().split("T")[0];

  const thisMonthTransactions = transactions.filter(
    (t) => t.transaction_date >= monthStart && t.transaction_date <= monthEnd
  );

  const totalRevenue = thisMonthTransactions
    .filter((t) => t.transaction_type === "revenue")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = thisMonthTransactions
    .filter((t) => t.transaction_type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const expenses = transactions.filter((t) => t.transaction_type === "expense");
  const revenues = transactions.filter((t) => t.transaction_type === "revenue");

  if (loading) {
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
          <h1 className="text-3xl font-bold">المصاريف والإيرادات</h1>
          <p className="text-muted-foreground">إدارة المصاريف والإيرادات</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90" onClick={() => resetForm()}>
              <Plus className="ml-2 h-4 w-4" />
              إضافة عملية
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingTransaction ? "تعديل العملية" : "إضافة عملية جديدة"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>رقم العملية</Label>
                  <Input
                    value={formData.transaction_number}
                    onChange={(e) => setFormData({ ...formData, transaction_number: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>التاريخ</Label>
                  <Input
                    type="date"
                    value={formData.transaction_date}
                    onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>نوع العملية</Label>
                <Select
                  value={formData.transaction_type}
                  onValueChange={(value) => setFormData({ ...formData, transaction_type: value as "expense" | "revenue" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">مصروف</SelectItem>
                    <SelectItem value="revenue">إيراد</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الفئة</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الفئة" />
                    </SelectTrigger>
                    <SelectContent>
                      {formData.transaction_type === "expense" ? (
                        <>
                          <SelectItem value="salaries">رواتب</SelectItem>
                          <SelectItem value="rent">إيجار</SelectItem>
                          <SelectItem value="utilities">كهرباء وماء</SelectItem>
                          <SelectItem value="maintenance">صيانة</SelectItem>
                          <SelectItem value="marketing">تسويق</SelectItem>
                          <SelectItem value="office">مكتبية</SelectItem>
                          <SelectItem value="other">أخرى</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="sales">مبيعات</SelectItem>
                          <SelectItem value="services">خدمات</SelectItem>
                          <SelectItem value="investments">استثمارات</SelectItem>
                          <SelectItem value="other">أخرى</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>المبلغ</Label>
                  <Input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>الوصف</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>طريقة الدفع</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">نقدي</SelectItem>
                    <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                    <SelectItem value="check">شيك</SelectItem>
                    <SelectItem value="credit_card">بطاقة ائتمان</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  {editingTransaction ? "تحديث" : "إضافة"}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  إلغاء
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openAddDialog("revenue")}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <ArrowUp className="h-6 w-6 text-green-600" />
              <CardTitle>الإيرادات</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalRevenue.toLocaleString()} ر.س</div>
            <p className="text-sm text-muted-foreground">هذا الشهر</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openAddDialog("expense")}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <ArrowDown className="h-6 w-6 text-red-600" />
              <CardTitle>المصاريف</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalExpense.toLocaleString()} ر.س</div>
            <p className="text-sm text-muted-foreground">هذا الشهر</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>صافي الدخل</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalRevenue - totalExpense >= 0 ? "text-green-600" : "text-red-600"}`}>
              {(totalRevenue - totalExpense).toLocaleString()} ر.س
            </div>
            <p className="text-sm text-muted-foreground">هذا الشهر</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">الكل ({transactions.length})</TabsTrigger>
          <TabsTrigger value="expenses">المصاريف ({expenses.length})</TabsTrigger>
          <TabsTrigger value="revenues">الإيرادات ({revenues.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <TransactionTable
            transactions={transactions}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </TabsContent>
        <TabsContent value="expenses">
          <TransactionTable
            transactions={expenses}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </TabsContent>
        <TabsContent value="revenues">
          <TransactionTable
            transactions={revenues}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TransactionTable({
  transactions,
  onEdit,
  onDelete,
}: {
  transactions: ExpenseRevenue[];
  onEdit: (t: ExpenseRevenue) => void;
  onDelete: (id: string) => void;
}) {
  const categoryLabels: Record<string, string> = {
    salaries: "رواتب",
    rent: "إيجار",
    utilities: "كهرباء وماء",
    maintenance: "صيانة",
    marketing: "تسويق",
    office: "مكتبية",
    sales: "مبيعات",
    services: "خدمات",
    investments: "استثمارات",
    other: "أخرى",
  };

  if (transactions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          لا توجد عمليات مسجلة
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>رقم العملية</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>الفئة</TableHead>
              <TableHead>الوصف</TableHead>
              <TableHead>المبلغ</TableHead>
              <TableHead>الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.transaction_number}</TableCell>
                <TableCell>{format(new Date(t.transaction_date), "yyyy/MM/dd")}</TableCell>
                <TableCell>
                  <Badge variant={t.transaction_type === "revenue" ? "default" : "destructive"}>
                    {t.transaction_type === "revenue" ? "إيراد" : "مصروف"}
                  </Badge>
                </TableCell>
                <TableCell>{t.category ? categoryLabels[t.category] || t.category : "-"}</TableCell>
                <TableCell>{t.description || "-"}</TableCell>
                <TableCell className={t.transaction_type === "revenue" ? "text-green-600" : "text-red-600"}>
                  {t.amount.toLocaleString()} ر.س
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(t)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(t.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
