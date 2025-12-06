import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight, Plus, Search, Edit, Trash2, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type Account = {
  id: string;
  code: string;
  name: string;
  account_type: "asset" | "liability" | "equity" | "revenue" | "expense";
  parent_id: string | null;
  level: number;
  is_active: boolean;
  children?: Account[];
};

const accountTypeLabels: Record<string, string> = {
  asset: "أصول",
  liability: "التزامات",
  equity: "حقوق ملكية",
  revenue: "إيرادات",
  expense: "مصروفات",
};

const accountTypeColors: Record<string, string> = {
  asset: "text-primary",
  liability: "text-secondary",
  equity: "text-accent",
  revenue: "text-green-600",
  expense: "text-red-600",
};

export default function Accounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    account_type: "asset" as Account["account_type"],
    parent_id: "",
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .order("code");

    if (error) {
      toast.error("خطأ في جلب الحسابات");
      console.error(error);
    } else {
      setAccounts(data || []);
    }
    setLoading(false);
  };

  const buildTree = (accounts: Account[]): Account[] => {
    const map = new Map<string, Account>();
    const roots: Account[] = [];

    accounts.forEach((acc) => {
      map.set(acc.id, { ...acc, children: [] });
    });

    accounts.forEach((acc) => {
      const node = map.get(acc.id)!;
      if (acc.parent_id && map.has(acc.parent_id)) {
        map.get(acc.parent_id)!.children!.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("يجب تسجيل الدخول أولاً");
      return;
    }

    const accountData = {
      code: formData.code,
      name: formData.name,
      account_type: formData.account_type,
      parent_id: formData.parent_id || null,
      level: formData.parent_id ? 2 : 1,
    };

    if (editingAccount) {
      const { error } = await supabase
        .from("accounts")
        .update(accountData)
        .eq("id", editingAccount.id);

      if (error) {
        toast.error("خطأ في تحديث الحساب");
        console.error(error);
      } else {
        toast.success("تم تحديث الحساب بنجاح");
        fetchAccounts();
        resetForm();
      }
    } else {
      const { error } = await supabase.from("accounts").insert(accountData);

      if (error) {
        toast.error("خطأ في إضافة الحساب");
        console.error(error);
      } else {
        toast.success("تم إضافة الحساب بنجاح");
        fetchAccounts();
        resetForm();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا الحساب؟")) return;

    const { error } = await supabase.from("accounts").delete().eq("id", id);

    if (error) {
      toast.error("خطأ في حذف الحساب");
      console.error(error);
    } else {
      toast.success("تم حذف الحساب بنجاح");
      fetchAccounts();
    }
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      account_type: account.account_type,
      parent_id: account.parent_id || "",
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ code: "", name: "", account_type: "asset", parent_id: "" });
    setEditingAccount(null);
    setIsDialogOpen(false);
  };

  const filteredAccounts = accounts.filter(
    (acc) =>
      acc.name.includes(searchQuery) || acc.code.includes(searchQuery)
  );

  const accountTree = buildTree(filteredAccounts);
  const parentAccounts = accounts.filter((acc) => acc.level === 1);

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
          <h1 className="text-3xl font-bold">شجرة الحسابات</h1>
          <p className="text-muted-foreground">إدارة الحسابات المالية بنظام شجري</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90" onClick={() => resetForm()}>
              <Plus className="ml-2 h-4 w-4" />
              إضافة حساب جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingAccount ? "تعديل الحساب" : "إضافة حساب جديد"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>رقم الحساب</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>اسم الحساب</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>نوع الحساب</Label>
                <Select
                  value={formData.account_type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, account_type: value as Account["account_type"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asset">أصول</SelectItem>
                    <SelectItem value="liability">التزامات</SelectItem>
                    <SelectItem value="equity">حقوق ملكية</SelectItem>
                    <SelectItem value="revenue">إيرادات</SelectItem>
                    <SelectItem value="expense">مصروفات</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>الحساب الرئيسي (اختياري)</Label>
                <Select
                  value={formData.parent_id || "none"}
                  onValueChange={(value) => setFormData({ ...formData, parent_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الحساب الرئيسي" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون حساب رئيسي</SelectItem>
                    {accounts.filter(acc => !editingAccount || acc.id !== editingAccount.id).map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.code} - {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  {editingAccount ? "تحديث" : "إضافة"}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  إلغاء
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ابحث عن حساب برقم الحساب أو الاسم..."
                className="pr-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {accountTree.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              لا توجد حسابات. ابدأ بإضافة حساب جديد.
            </div>
          ) : (
            <div className="space-y-2">
              {accountTree.map((account) => (
                <AccountTreeNode
                  key={account.id}
                  account={account}
                  level={0}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AccountTreeNode({
  account,
  level,
  onEdit,
  onDelete,
}: {
  account: Account;
  level: number;
  onEdit: (account: Account) => void;
  onDelete: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(level === 0);
  const hasChildren = account.children && account.children.length > 0;
  const paddingRight = `${level * 1.5}rem`;

  return (
    <div>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div
            className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors border"
            style={{ paddingRight }}
          >
            <div className="flex items-center gap-2">
              {hasChildren && (
                <div className="text-muted-foreground">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </div>
              )}
              {!hasChildren && <div className="w-4" />}
              <div>
                <div className="flex items-center gap-2">
                  <span className={`font-semibold ${accountTypeColors[account.account_type] || ""}`}>
                    {account.name}
                  </span>
                  <span className="text-sm text-muted-foreground">({account.code})</span>
                </div>
                <p className="text-xs text-muted-foreground">{accountTypeLabels[account.account_type]}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(account);
                }}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(account.id);
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </CollapsibleTrigger>
        {hasChildren && (
          <CollapsibleContent>
            <div className="mt-1 space-y-1">
              {account.children!.map((child) => (
                <AccountTreeNode
                  key={child.id}
                  account={child}
                  level={level + 1}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
}
