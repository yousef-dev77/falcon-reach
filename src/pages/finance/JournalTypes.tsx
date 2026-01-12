import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
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

interface JournalType {
  id: string;
  code: string;
  name: string;
  type_category: string;
  is_auto_generated: boolean;
  is_active: boolean;
  default_debit_account_id: string | null;
  default_credit_account_id: string | null;
}

interface Account {
  id: string;
  code: string;
  name: string;
}

const categoryLabels: Record<string, string> = {
  general: "قيود يومية",
  adjustment: "قيود تسوية",
  closing: "قيود إقفال",
  automatic: "قيود آلية",
  opening: "قيود افتتاحية",
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

  const saveMutation = useMutation({
    mutationFn: async (data: {
      code: string;
      name: string;
      type_category: string;
      is_auto_generated: boolean;
      is_active: boolean;
      default_debit_account_id: string | null;
      default_credit_account_id: string | null;
    }) => {
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
      toast.success(editingType ? "تم تحديث نوع القيد" : "تم إضافة نوع القيد");
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
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      code: formData.code.toUpperCase(),
      name: formData.name,
      type_category: formData.type_category,
      is_auto_generated: formData.is_auto_generated,
      is_active: formData.is_active,
      default_debit_account_id: formData.default_debit_account_id || null,
      default_credit_account_id: formData.default_credit_account_id || null,
    });
  };

  const getCategoryBadge = (category: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      general: "default",
      adjustment: "secondary",
      closing: "destructive",
      automatic: "outline",
      opening: "default",
    };
    return (
      <Badge variant={variants[category] || "default"}>
        {categoryLabels[category] || category}
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">أنواع القيود</h1>
            <p className="text-muted-foreground mt-1">
              إدارة أنواع القيود المحاسبية
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="ml-2 h-4 w-4" />
                إضافة نوع قيد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingType ? "تعديل نوع القيد" : "إضافة نوع قيد جديد"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">الرمز</Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) =>
                        setFormData({ ...formData, code: e.target.value })
                      }
                      placeholder="GEN"
                      maxLength={10}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">الاسم</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="قيود يومية"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>التصنيف</Label>
                  <Select
                    value={formData.type_category}
                    onValueChange={(value) =>
                      setFormData({ ...formData, type_category: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">قيود يومية</SelectItem>
                      <SelectItem value="adjustment">قيود تسوية</SelectItem>
                      <SelectItem value="closing">قيود إقفال</SelectItem>
                      <SelectItem value="automatic">قيود آلية</SelectItem>
                      <SelectItem value="opening">قيود افتتاحية</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>الحساب المدين الافتراضي (اختياري)</Label>
                  <Select
                    value={formData.default_debit_account_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, default_debit_account_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر حساب..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">بدون</SelectItem>
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
                    value={formData.default_credit_account_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, default_credit_account_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر حساب..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">بدون</SelectItem>
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
                    <Label htmlFor="is_auto_generated">قيد آلي</Label>
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
              قائمة أنواع القيود
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
                    <TableHead>التصنيف</TableHead>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(type)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {journalTypes?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        لا توجد أنواع قيود مسجلة
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
