import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Edit, FileType, Zap } from "lucide-react";
import { ListPageHeader } from "@/components/ListPageHeader";

interface JournalType {
  id: string;
  code: string;
  name: string;
  type_category: string;
  is_auto_generated: boolean;
  is_active: boolean;
  default_debit_account_id: string | null;
  default_credit_account_id: string | null;
  bank_account_id: string | null;
  cash_box_id: string | null;
}

interface Account {
  id: string;
  code: string;
  name: string;
}

interface BankAccount {
  id: string;
  code: string;
  bank_name: string;
  account_number: string;
}

interface CashBox {
  id: string;
  code: string;
  name: string;
}

const categoryLabels: Record<string, string> = {
  general: "عام",
  adjustment: "تسوية",
  closing: "إقفال",
  automatic: "آلي",
  opening: "افتتاحي",
  bank: "بنك",
  cash: "صندوق",
  sales: "مبيعات",
  purchases: "مشتريات",
};

const categoryBadgeVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  general: "default",
  adjustment: "secondary",
  closing: "destructive",
  automatic: "outline",
  opening: "default",
  bank: "secondary",
  cash: "secondary",
  sales: "default",
  purchases: "outline",
};

export default function JournalTypes() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<JournalType | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type_category: "general",
    is_auto_generated: false,
    is_active: true,
    default_debit_account_id: "",
    default_credit_account_id: "",
    bank_account_id: "",
    cash_box_id: "",
  });

  const queryClient = useQueryClient();

  const { data: journalTypes, isLoading } = useQuery({
    queryKey: ["journal-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_types")
        .select("*")
        .order("code");
      if (error) throw error;
      return data as JournalType[];
    },
  });

  const { data: accounts } = useQuery({
    queryKey: ["accounts-for-journal-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, code, name")
        .eq("is_active", true)
        .eq("allow_manual_entry", true)
        .order("code");
      if (error) throw error;
      return data as Account[];
    },
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts-for-journals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, code, bank_name, account_number")
        .eq("is_active", true)
        .order("code");
      if (error) throw error;
      return data as BankAccount[];
    },
  });

  const { data: cashBoxes = [] } = useQuery({
    queryKey: ["cash-boxes-for-journals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_boxes")
        .select("id, code, name")
        .eq("is_active", true)
        .order("code");
      if (error) throw error;
      return data as CashBox[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingType) {
        const { error } = await supabase
          .from("journal_types")
          .update(data)
          .eq("id", editingType.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("journal_types").insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-types"] });
      toast.success(editingType ? "تم تحديث نوع الدفتر" : "تم إضافة نوع الدفتر");
      resetForm();
    },
    onError: (error) => {
      toast.error("حدث خطأ: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      type_category: "general",
      is_auto_generated: false,
      is_active: true,
      default_debit_account_id: "",
      default_credit_account_id: "",
      bank_account_id: "",
      cash_box_id: "",
    });
    setEditingType(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (type: JournalType) => {
    setEditingType(type);
    setFormData({
      code: type.code,
      name: type.name,
      type_category: type.type_category,
      is_auto_generated: type.is_auto_generated,
      is_active: type.is_active,
      default_debit_account_id: type.default_debit_account_id || "",
      default_credit_account_id: type.default_credit_account_id || "",
      bank_account_id: type.bank_account_id || "",
      cash_box_id: type.cash_box_id || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.type_category === 'bank' && !formData.bank_account_id) {
      toast.error("يجب اختيار حساب بنكي لدفتر من نوع بنك");
      return;
    }
    if (formData.type_category === 'cash' && !formData.cash_box_id) {
      toast.error("يجب اختيار صندوق نقدي لدفتر من نوع صندوق");
      return;
    }

    saveMutation.mutate({
      code: formData.code.toUpperCase(),
      name: formData.name,
      type_category: formData.type_category,
      is_auto_generated: formData.is_auto_generated,
      is_active: formData.is_active,
      default_debit_account_id: formData.default_debit_account_id || null,
      default_credit_account_id: formData.default_credit_account_id || null,
      bank_account_id: formData.type_category === 'bank' ? formData.bank_account_id : null,
      cash_box_id: formData.type_category === 'cash' ? formData.cash_box_id : null,
    });
  };

  const getCategoryBadge = (category: string) => (
    <Badge variant={categoryBadgeVariants[category] || "default"}>
      {categoryLabels[category] || category}
    </Badge>
  );

  // Get linked account name for display
  const getLinkedAccountName = (type: JournalType) => {
    if (type.type_category === 'bank' && type.bank_account_id) {
      const bank = bankAccounts.find(b => b.id === type.bank_account_id);
      return bank ? `${bank.bank_name} (${bank.account_number})` : '-';
    }
    if (type.type_category === 'cash' && type.cash_box_id) {
      const cash = cashBoxes.find(c => c.id === type.cash_box_id);
      return cash ? cash.name : '-';
    }
    return '-';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">الدفاتر اليومية</h1>
          <p className="text-muted-foreground mt-1">
            إدارة أنواع الدفاتر المحاسبية (عام، بنك، صندوق، مبيعات، مشتريات)
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="ml-2 h-4 w-4" />
              إضافة دفتر
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingType ? "تعديل الدفتر" : "إضافة دفتر جديد"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">الرمز</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="BNK1"
                    maxLength={10}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">الاسم</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="بنك الكريمي"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>نوع الدفتر</Label>
                <Select
                  value={formData.type_category}
                  onValueChange={(value) =>
                    setFormData({ ...formData, type_category: value, bank_account_id: "", cash_box_id: "" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">عام</SelectItem>
                    <SelectItem value="bank">بنك</SelectItem>
                    <SelectItem value="cash">صندوق</SelectItem>
                    <SelectItem value="sales">مبيعات</SelectItem>
                    <SelectItem value="purchases">مشتريات</SelectItem>
                    <SelectItem value="adjustment">تسوية</SelectItem>
                    <SelectItem value="opening">افتتاحي</SelectItem>
                    <SelectItem value="closing">إقفال</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Bank Account selector - shown only for bank type */}
              {formData.type_category === 'bank' && (
                <div className="space-y-2">
                  <Label>الحساب البنكي *</Label>
                  <Select
                    value={formData.bank_account_id}
                    onValueChange={(value) => setFormData({ ...formData, bank_account_id: value })}
                  >
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
              )}

              {/* Cash Box selector - shown only for cash type */}
              {formData.type_category === 'cash' && (
                <div className="space-y-2">
                  <Label>الصندوق النقدي *</Label>
                  <Select
                    value={formData.cash_box_id}
                    onValueChange={(value) => setFormData({ ...formData, cash_box_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الصندوق..." />
                    </SelectTrigger>
                    <SelectContent>
                      {cashBoxes.map((cash) => (
                        <SelectItem key={cash.id} value={cash.id}>
                          {cash.code} - {cash.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>الحساب المدين الافتراضي (اختياري)</Label>
                <Select
                  value={formData.default_debit_account_id || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, default_debit_account_id: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر حساب..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون</SelectItem>
                    {accounts?.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.code} - {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>الحساب الدائن الافتراضي (اختياري)</Label>
                <Select
                  value={formData.default_credit_account_id || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, default_credit_account_id: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر حساب..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون</SelectItem>
                    {accounts?.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.code} - {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_auto_generated"
                    checked={formData.is_auto_generated}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_auto_generated: checked })
                    }
                  />
                  <Label htmlFor="is_auto_generated">آلي (لا يمكن الإدخال يدوياً)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_active: checked })
                    }
                  />
                  <Label htmlFor="is_active">نشط</Label>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={resetForm}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "جاري الحفظ..." : "حفظ"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileType className="h-5 w-5" />
            قائمة الدفاتر اليومية
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">جاري التحميل...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الرمز</TableHead>
                  <TableHead>الاسم</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>الحساب المرتبط</TableHead>
                  <TableHead>آلي</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {journalTypes?.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell className="font-mono font-bold">{type.code}</TableCell>
                    <TableCell>{type.name}</TableCell>
                    <TableCell>{getCategoryBadge(type.type_category)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {getLinkedAccountName(type)}
                    </TableCell>
                    <TableCell>
                      {type.is_auto_generated && (
                        <Zap className="h-4 w-4 text-yellow-500" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={type.is_active ? "default" : "secondary"}>
                        {type.is_active ? "نشط" : "معطل"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(type)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {journalTypes?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      لا توجد دفاتر مسجلة
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
