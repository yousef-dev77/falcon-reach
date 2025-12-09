import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Loader2, Eye, AlertCircle } from "lucide-react";
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
  cost_center_id: string | null;
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
  allow_manual_entry: boolean;
  is_active: boolean;
};

type FiscalPeriod = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_closed: boolean;
};

type CostCenter = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
};

export default function JournalEntries() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [postableAccounts, setPostableAccounts] = useState<Account[]>([]);
  const [fiscalPeriods, setFiscalPeriods] = useState<FiscalPeriod[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [viewingEntry, setViewingEntry] = useState<JournalEntry | null>(null);
  const [entryLines, setEntryLines] = useState<JournalEntryLine[]>([]);
  const [formData, setFormData] = useState({
    entry_date: new Date().toISOString().split("T")[0],
    description: "",
    reference: "",
    cost_center_id: "",
  });
  const [lines, setLines] = useState<{ account_id: string; debit_amount: number; credit_amount: number; description: string }[]>([
    { account_id: "", debit_amount: 0, credit_amount: 0, description: "" },
    { account_id: "", debit_amount: 0, credit_amount: 0, description: "" },
  ]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    fetchEntries();
    fetchAccounts();
    fetchFiscalPeriods();
    fetchCostCenters();
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
    const { data, error } = await supabase
      .from("accounts")
      .select("id, code, name, allow_manual_entry, is_active")
      .eq("is_active", true)
      .order("code");
    
    if (!error && data) {
      setAccounts(data);
      
      // Get accounts that have children (parent accounts)
      const { data: allAccounts } = await supabase
        .from("accounts")
        .select("id, parent_id");
      
      const parentIds = new Set(allAccounts?.filter(a => a.parent_id).map(a => a.parent_id) || []);
      
      // Postable accounts: allow_manual_entry = true AND no children
      const postable = data.filter(acc => 
        acc.allow_manual_entry && 
        acc.is_active && 
        !parentIds.has(acc.id)
      );
      setPostableAccounts(postable);
    }
  };

  const fetchFiscalPeriods = async () => {
    const { data } = await supabase
      .from("fiscal_periods")
      .select("*")
      .order("start_date", { ascending: false });
    if (data) setFiscalPeriods(data);
  };

  const fetchCostCenters = async () => {
    const { data } = await supabase
      .from("cost_centers")
      .select("id, code, name, is_active")
      .eq("is_active", true)
      .order("code");
    if (data) setCostCenters(data);
  };

  const fetchEntryLines = async (entryId: string) => {
    const { data, error } = await supabase
      .from("journal_entry_lines")
      .select("*")
      .eq("journal_entry_id", entryId);
    if (!error) setEntryLines(data || []);
  };

  const generateEntryNumber = (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const prefix = `JE-${year}${month}-`;
    
    // Find existing entries with same prefix
    const existingNumbers = entries
      .filter(e => e.entry_number.startsWith(prefix))
      .map(e => {
        const num = parseInt(e.entry_number.replace(prefix, ''));
        return isNaN(num) ? 0 : num;
      });
    
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    return `${prefix}${String(maxNumber + 1).padStart(4, '0')}`;
  };

  const validateEntry = (): boolean => {
    const errors: string[] = [];

    // Check fiscal period
    if (fiscalPeriods.length > 0) {
      const entryDate = new Date(formData.entry_date);
      const validPeriod = fiscalPeriods.find(p => {
        const start = new Date(p.start_date);
        const end = new Date(p.end_date);
        return entryDate >= start && entryDate <= end && !p.is_closed;
      });
      
      if (!validPeriod) {
        const closedPeriod = fiscalPeriods.find(p => {
          const start = new Date(p.start_date);
          const end = new Date(p.end_date);
          return entryDate >= start && entryDate <= end;
        });
        
        if (closedPeriod) {
          errors.push("الفترة المحاسبية مغلقة");
        } else {
          errors.push("التاريخ خارج الفترات المحاسبية المعرفة");
        }
      }
    }

    // Check debit = credit
    const totalDebit = lines.reduce((sum, l) => sum + (l.debit_amount || 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + (l.credit_amount || 0), 0);
    
    if (totalDebit !== totalCredit) {
      errors.push("مجموع المدين يجب أن يساوي مجموع الدائن");
    }

    if (totalDebit === 0) {
      errors.push("يجب إدخال مبالغ في القيد");
    }

    // Check valid lines
    const validLines = lines.filter((l) => l.account_id && (l.debit_amount > 0 || l.credit_amount > 0));
    if (validLines.length < 2) {
      errors.push("يجب إدخال سطرين على الأقل بحسابات صحيحة");
    }

    // Check that accounts are postable
    for (const line of validLines) {
      const account = postableAccounts.find(a => a.id === line.account_id);
      if (!account) {
        const fullAccount = accounts.find(a => a.id === line.account_id);
        if (fullAccount) {
          errors.push(`الحساب "${fullAccount.name}" غير قابل للقيد عليه`);
        }
      }
    }

    // Check that line doesn't have both debit and credit
    for (const line of lines) {
      if (line.debit_amount > 0 && line.credit_amount > 0) {
        errors.push("لا يمكن أن يكون السطر مدين ودائن في نفس الوقت");
        break;
      }
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("يجب تسجيل الدخول أولاً");
      return;
    }

    if (!validateEntry()) {
      return;
    }

    const validLines = lines.filter((l) => l.account_id && (l.debit_amount > 0 || l.credit_amount > 0));

    if (editingEntry) {
      const { error } = await supabase
        .from("journal_entries")
        .update({
          entry_date: formData.entry_date,
          description: formData.description.trim() || null,
          reference: formData.reference.trim() || null,
          cost_center_id: formData.cost_center_id || null,
        })
        .eq("id", editingEntry.id);

      if (error) {
        if (error.code === "23505") {
          toast.error("رقم القيد موجود مسبقاً");
        } else {
          toast.error("خطأ في تحديث القيد");
        }
        console.error(error);
      } else {
        await supabase.from("journal_entry_lines").delete().eq("journal_entry_id", editingEntry.id);
        await supabase.from("journal_entry_lines").insert(
          validLines.map((l) => ({
            journal_entry_id: editingEntry.id,
            account_id: l.account_id,
            debit_amount: l.debit_amount || 0,
            credit_amount: l.credit_amount || 0,
            description: l.description.trim() || null,
          }))
        );
        toast.success("تم تحديث القيد بنجاح");
        fetchEntries();
        resetForm();
      }
    } else {
      const newEntryNumber = generateEntryNumber();
      const { data: newEntry, error } = await supabase
        .from("journal_entries")
        .insert({
          entry_number: newEntryNumber,
          entry_date: formData.entry_date,
          description: formData.description.trim() || null,
          reference: formData.reference.trim() || null,
          cost_center_id: formData.cost_center_id || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          toast.error("رقم القيد موجود مسبقاً");
        } else {
          toast.error("خطأ في إضافة القيد");
        }
        console.error(error);
      } else {
        await supabase.from("journal_entry_lines").insert(
          validLines.map((l) => ({
            journal_entry_id: newEntry.id,
            account_id: l.account_id,
            debit_amount: l.debit_amount || 0,
            credit_amount: l.credit_amount || 0,
            description: l.description.trim() || null,
          }))
        );
        toast.success("تم إضافة القيد بنجاح");
        fetchEntries();
        resetForm();
      }
    }
  };

  const handleDelete = async (id: string) => {
    const entry = entries.find(e => e.id === id);
    if (entry?.is_posted) {
      toast.error("لا يمكن حذف قيد مرحّل");
      return;
    }

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

  const handleEdit = async (entry: JournalEntry) => {
    if (entry.is_posted) {
      toast.error("لا يمكن تعديل قيد مرحّل");
      return;
    }

    setEditingEntry(entry);
    setFormData({
      entry_date: entry.entry_date,
      description: entry.description || "",
      reference: entry.reference || "",
      cost_center_id: entry.cost_center_id || "",
    });
    
    const { data: entryLines } = await supabase
      .from("journal_entry_lines")
      .select("*")
      .eq("journal_entry_id", entry.id);
    
    if (entryLines && entryLines.length > 0) {
      setLines(entryLines.map(l => ({
        account_id: l.account_id,
        debit_amount: l.debit_amount || 0,
        credit_amount: l.credit_amount || 0,
        description: l.description || "",
      })));
    }
    
    setValidationErrors([]);
    setIsDialogOpen(true);
  };

  const handleView = async (entry: JournalEntry) => {
    setViewingEntry(entry);
    await fetchEntryLines(entry.id);
    setIsViewDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      entry_date: new Date().toISOString().split("T")[0],
      description: "",
      reference: "",
      cost_center_id: "",
    });
    setLines([
      { account_id: "", debit_amount: 0, credit_amount: 0, description: "" },
      { account_id: "", debit_amount: 0, credit_amount: 0, description: "" },
    ]);
    setEditingEntry(null);
    setValidationErrors([]);
    setIsDialogOpen(false);
  };

  const addLine = () => {
    setLines([...lines, { account_id: "", debit_amount: 0, credit_amount: 0, description: "" }]);
  };

  const updateLine = (index: number, field: string, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    
    // If setting debit, clear credit and vice versa
    if (field === "debit_amount" && value > 0) {
      newLines[index].credit_amount = 0;
    } else if (field === "credit_amount" && value > 0) {
      newLines[index].debit_amount = 0;
    }
    
    setLines(newLines);
    setValidationErrors([]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 2) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const getAccountName = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    return account ? `${account.code} - ${account.name}` : "-";
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
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingEntry ? "تعديل القيد" : "إضافة قيد جديد"}</DialogTitle>
            </DialogHeader>
            
            {validationErrors.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <div className="flex items-center gap-2 text-destructive mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">أخطاء التحقق:</span>
                </div>
                <ul className="list-disc list-inside text-sm text-destructive">
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {editingEntry && (
                <div className="bg-muted/50 p-3 rounded-lg">
                  <span className="text-sm text-muted-foreground">رقم القيد: </span>
                  <span className="font-medium">{editingEntry.entry_number}</span>
                </div>
              )}
              {!editingEntry && (
                <div className="bg-primary/10 p-3 rounded-lg">
                  <span className="text-sm text-muted-foreground">رقم القيد: </span>
                  <span className="font-medium text-primary">سيتم توليده تلقائياً</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>تاريخ القيد <span className="text-destructive">*</span></Label>
                  <Input
                    type="date"
                    value={formData.entry_date}
                    onChange={(e) => {
                      setFormData({ ...formData, entry_date: e.target.value });
                      setValidationErrors([]);
                    }}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>المرجع</Label>
                  <Input
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    maxLength={100}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>البيان</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    maxLength={255}
                    placeholder="وصف القيد المحاسبي"
                  />
                </div>
                <div className="space-y-2">
                  <Label>مركز التكلفة</Label>
                  <Select
                    value={formData.cost_center_id || "none"}
                    onValueChange={(value) => setFormData({ ...formData, cost_center_id: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="بدون مركز تكلفة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون مركز تكلفة</SelectItem>
                      {costCenters.map((cc) => (
                        <SelectItem key={cc.id} value={cc.id}>
                          {cc.code} - {cc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
                        <TableHead className="w-[40%]">الحساب</TableHead>
                        <TableHead>مدين</TableHead>
                        <TableHead>دائن</TableHead>
                        <TableHead>البيان</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((line, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Select
                              value={line.account_id || "none"}
                              onValueChange={(value) => updateLine(index, "account_id", value === "none" ? "" : value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="اختر حساب" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">اختر حساب</SelectItem>
                                {postableAccounts.map((acc) => (
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
                              min="0"
                              step="0.01"
                              value={line.debit_amount || ""}
                              onChange={(e) => updateLine(index, "debit_amount", parseFloat(e.target.value) || 0)}
                              className="w-28"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.credit_amount || ""}
                              onChange={(e) => updateLine(index, "credit_amount", parseFloat(e.target.value) || 0)}
                              className="w-28"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={line.description}
                              onChange={(e) => updateLine(index, "description", e.target.value)}
                              className="w-32"
                              maxLength={100}
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
                            <span className="text-destructive text-sm">
                              الفرق: {Math.abs(totalDebit - totalCredit).toLocaleString()}
                            </span>
                          )}
                          {totalDebit === totalCredit && totalDebit > 0 && (
                            <span className="text-green-600 text-sm">✓ متوازن</span>
                          )}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
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
                        {entry.is_posted ? "مرحّل" : "مسودة"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleView(entry)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {!entry.is_posted && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(entry)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>تفاصيل القيد</DialogTitle>
          </DialogHeader>
          {viewingEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">رقم القيد</Label>
                  <p className="font-medium">{viewingEntry.entry_number}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">التاريخ</Label>
                  <p className="font-medium">{format(new Date(viewingEntry.entry_date), "yyyy/MM/dd", { locale: ar })}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">البيان</Label>
                  <p className="font-medium">{viewingEntry.description || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">المرجع</Label>
                  <p className="font-medium">{viewingEntry.reference || "-"}</p>
                </div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الحساب</TableHead>
                      <TableHead>مدين</TableHead>
                      <TableHead>دائن</TableHead>
                      <TableHead>البيان</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entryLines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>{getAccountName(line.account_id)}</TableCell>
                        <TableCell>{line.debit_amount ? line.debit_amount.toLocaleString() : "-"}</TableCell>
                        <TableCell>{line.credit_amount ? line.credit_amount.toLocaleString() : "-"}</TableCell>
                        <TableCell>{line.description || "-"}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>الإجمالي</TableCell>
                      <TableCell>{entryLines.reduce((sum, l) => sum + (l.debit_amount || 0), 0).toLocaleString()}</TableCell>
                      <TableCell>{entryLines.reduce((sum, l) => sum + (l.credit_amount || 0), 0).toLocaleString()}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
