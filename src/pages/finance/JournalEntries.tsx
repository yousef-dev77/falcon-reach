import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Loader2, Eye } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

type JournalEntry = {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string | null;
  reference: string | null;
  is_posted: boolean;
  created_at: string;
};

type JournalEntryLine = {
  id: string;
  journal_entry_id: string;
  account_id: string;
  debit_amount: number;
  credit_amount: number;
  description: string | null;
};

type Account = {
  id: string;
  code: string;
  name: string;
};

export default function JournalEntries() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [viewingEntry, setViewingEntry] = useState<JournalEntry | null>(null);
  const [entryLines, setEntryLines] = useState<JournalEntryLine[]>([]);
  const [formData, setFormData] = useState({
    entry_number: "",
    entry_date: new Date().toISOString().split("T")[0],
    description: "",
    reference: "",
  });
  const [lines, setLines] = useState<{ account_id: string; debit_amount: number; credit_amount: number; description: string }[]>([
    { account_id: "", debit_amount: 0, credit_amount: 0, description: "" },
    { account_id: "", debit_amount: 0, credit_amount: 0, description: "" },
  ]);

  useEffect(() => {
    fetchEntries();
    fetchAccounts();
  }, []);

  const fetchEntries = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("journal_entries")
      .select("*")
      .order("entry_date", { ascending: false });

    if (error) {
      toast.error("خطأ في جلب القيود");
      console.error(error);
    } else {
      setEntries(data || []);
    }
    setLoading(false);
  };

  const fetchAccounts = async () => {
    const { data, error } = await supabase.from("accounts").select("id, code, name").order("code");
    if (!error) setAccounts(data || []);
  };

  const fetchEntryLines = async (entryId: string) => {
    const { data, error } = await supabase
      .from("journal_entry_lines")
      .select("*")
      .eq("journal_entry_id", entryId);
    if (!error) setEntryLines(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("يجب تسجيل الدخول أولاً");
      return;
    }

    const totalDebit = lines.reduce((sum, l) => sum + (l.debit_amount || 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + (l.credit_amount || 0), 0);

    if (totalDebit !== totalCredit) {
      toast.error("مجموع المدين يجب أن يساوي مجموع الدائن");
      return;
    }

    if (totalDebit === 0) {
      toast.error("يجب إدخال مبالغ في القيد");
      return;
    }

    const validLines = lines.filter((l) => l.account_id && (l.debit_amount > 0 || l.credit_amount > 0));
    if (validLines.length < 2) {
      toast.error("يجب إدخال سطرين على الأقل");
      return;
    }

    if (editingEntry) {
      const { error } = await supabase
        .from("journal_entries")
        .update({
          entry_number: formData.entry_number,
          entry_date: formData.entry_date,
          description: formData.description || null,
          reference: formData.reference || null,
        })
        .eq("id", editingEntry.id);

      if (error) {
        toast.error("خطأ في تحديث القيد");
        console.error(error);
      } else {
        // Delete old lines and insert new ones
        await supabase.from("journal_entry_lines").delete().eq("journal_entry_id", editingEntry.id);
        await supabase.from("journal_entry_lines").insert(
          validLines.map((l) => ({
            journal_entry_id: editingEntry.id,
            account_id: l.account_id,
            debit_amount: l.debit_amount || 0,
            credit_amount: l.credit_amount || 0,
            description: l.description || null,
          }))
        );
        toast.success("تم تحديث القيد بنجاح");
        fetchEntries();
        resetForm();
      }
    } else {
      const { data: newEntry, error } = await supabase
        .from("journal_entries")
        .insert({
          entry_number: formData.entry_number,
          entry_date: formData.entry_date,
          description: formData.description || null,
          reference: formData.reference || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        toast.error("خطأ في إضافة القيد");
        console.error(error);
      } else {
        await supabase.from("journal_entry_lines").insert(
          validLines.map((l) => ({
            journal_entry_id: newEntry.id,
            account_id: l.account_id,
            debit_amount: l.debit_amount || 0,
            credit_amount: l.credit_amount || 0,
            description: l.description || null,
          }))
        );
        toast.success("تم إضافة القيد بنجاح");
        fetchEntries();
        resetForm();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا القيد؟")) return;

    await supabase.from("journal_entry_lines").delete().eq("journal_entry_id", id);
    const { error } = await supabase.from("journal_entries").delete().eq("id", id);

    if (error) {
      toast.error("خطأ في حذف القيد");
      console.error(error);
    } else {
      toast.success("تم حذف القيد بنجاح");
      fetchEntries();
    }
  };

  const handleView = async (entry: JournalEntry) => {
    setViewingEntry(entry);
    await fetchEntryLines(entry.id);
    setIsViewDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      entry_number: "",
      entry_date: new Date().toISOString().split("T")[0],
      description: "",
      reference: "",
    });
    setLines([
      { account_id: "", debit_amount: 0, credit_amount: 0, description: "" },
      { account_id: "", debit_amount: 0, credit_amount: 0, description: "" },
    ]);
    setEditingEntry(null);
    setIsDialogOpen(false);
  };

  const addLine = () => {
    setLines([...lines, { account_id: "", debit_amount: 0, credit_amount: 0, description: "" }]);
  };

  const updateLine = (index: number, field: string, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const removeLine = (index: number) => {
    if (lines.length > 2) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const totalDebit = lines.reduce((sum, l) => sum + (l.debit_amount || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (l.credit_amount || 0), 0);

  const manualEntries = entries.filter((e) => !e.reference);
  const autoEntries = entries.filter((e) => e.reference);

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
          <h1 className="text-3xl font-bold">القيود اليومية</h1>
          <p className="text-muted-foreground">سجل القيود المحاسبية</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90" onClick={() => resetForm()}>
              <Plus className="ml-2 h-4 w-4" />
              إضافة قيد جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingEntry ? "تعديل القيد" : "إضافة قيد جديد"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>رقم القيد</Label>
                  <Input
                    value={formData.entry_number}
                    onChange={(e) => setFormData({ ...formData, entry_number: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>تاريخ القيد</Label>
                  <Input
                    type="date"
                    value={formData.entry_date}
                    onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>البيان</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>المرجع</Label>
                <Input
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>سطور القيد</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addLine}>
                    <Plus className="h-4 w-4 ml-1" />
                    إضافة سطر
                  </Button>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الحساب</TableHead>
                        <TableHead>مدين</TableHead>
                        <TableHead>دائن</TableHead>
                        <TableHead>البيان</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((line, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Select
                              value={line.account_id}
                              onValueChange={(value) => updateLine(index, "account_id", value)}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue placeholder="اختر حساب" />
                              </SelectTrigger>
                              <SelectContent>
                                {accounts.map((acc) => (
                                  <SelectItem key={acc.id} value={acc.id}>
                                    {acc.code} - {acc.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={line.debit_amount || ""}
                              onChange={(e) => updateLine(index, "debit_amount", parseFloat(e.target.value) || 0)}
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={line.credit_amount || ""}
                              onChange={(e) => updateLine(index, "credit_amount", parseFloat(e.target.value) || 0)}
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={line.description}
                              onChange={(e) => updateLine(index, "description", e.target.value)}
                              className="w-32"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLine(index)}
                              disabled={lines.length <= 2}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50">
                        <TableCell className="font-bold">الإجمالي</TableCell>
                        <TableCell className="font-bold">{totalDebit.toLocaleString()}</TableCell>
                        <TableCell className="font-bold">{totalCredit.toLocaleString()}</TableCell>
                        <TableCell colSpan={2}>
                          {totalDebit !== totalCredit && (
                            <span className="text-destructive text-sm">الفرق: {Math.abs(totalDebit - totalCredit).toLocaleString()}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={totalDebit !== totalCredit}>
                  {editingEntry ? "تحديث" : "إضافة"}
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
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">قيود يدوية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{manualEntries.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">قيود آلية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{autoEntries.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">إجمالي القيود</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{entries.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>سجل القيود</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              لا توجد قيود مسجلة. ابدأ بإضافة قيد جديد.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم القيد</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>البيان</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.entry_number}</TableCell>
                    <TableCell>{format(new Date(entry.entry_date), "yyyy/MM/dd", { locale: ar })}</TableCell>
                    <TableCell>{entry.description || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={entry.is_posted ? "default" : "secondary"}>
                        {entry.is_posted ? "مرحل" : "غير مرحل"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleView(entry)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Entry Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>تفاصيل القيد</DialogTitle>
          </DialogHeader>
          {viewingEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">رقم القيد:</span> {viewingEntry.entry_number}
                </div>
                <div>
                  <span className="text-muted-foreground">التاريخ:</span> {format(new Date(viewingEntry.entry_date), "yyyy/MM/dd")}
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">البيان:</span> {viewingEntry.description || "-"}
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الحساب</TableHead>
                    <TableHead>مدين</TableHead>
                    <TableHead>دائن</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entryLines.map((line) => {
                    const account = accounts.find((a) => a.id === line.account_id);
                    return (
                      <TableRow key={line.id}>
                        <TableCell>{account ? `${account.code} - ${account.name}` : "-"}</TableCell>
                        <TableCell>{line.debit_amount > 0 ? line.debit_amount.toLocaleString() : "-"}</TableCell>
                        <TableCell>{line.credit_amount > 0 ? line.credit_amount.toLocaleString() : "-"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
