import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ChevronDown, ChevronRight, Plus, Search, Edit, Trash2, Loader2 } from "lucide-react";
import { ListPageHeader } from "@/components/ListPageHeader";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type Account = {
  id: string;
  code: string;
  name: string;
  account_type: "asset" | "liability" | "equity" | "revenue" | "expense";
  internal_type: string;
  account_group: string | null;
  parent_id: string | null;
  level: number;
  is_active: boolean;
  allow_manual_entry: boolean;
  opening_balance: number;
  reconcile: boolean;
  currency_id: string | null;
  children?: Account[];
};

const accountTypeLabels: Record<string, string> = {
  asset: "أصول",
  liability: "التزامات",
  equity: "حقوق ملكية",
  revenue: "إيرادات",
  expense: "مصروفات",
};

const internalTypeLabels: Record<string, string> = {
  bank: "حساب بنكي",
  cash: "صندوق نقدية",
  receivable: "ذمم مدينة",
  payable: "ذمم دائنة",
  expense: "مصروفات",
  income: "إيرادات",
  equity: "رأس المال",
  current_asset: "أصول متداولة",
  fixed_asset: "أصول ثابتة",
  current_liability: "التزامات قصيرة الأجل",
  long_term_liability: "التزامات طويلة الأجل",
  other: "أخرى",
};

const accountTypeColors: Record<string, string> = {
  asset: "text-primary",
  liability: "text-secondary",
  equity: "text-accent",
  revenue: "text-green-600",
  expense: "text-red-600",
};

const accountGroups = [
  { value: "balance_sheet", label: "الميزانية العمومية" },
  { value: "income_statement", label: "قائمة الدخل" },
  { value: "cash_flow", label: "قائمة التدفقات النقدية" },
];

export default function Accounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currencies, setCurrencies] = useState<{ id: string; code: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    account_type: "asset" as Account["account_type"],
    internal_type: "other",
    account_group: "",
    parent_id: "",
    allow_manual_entry: true,
    opening_balance: 0,
    reconcile: false,
    currency_id: "",
  });

  useEffect(() => {
    fetchAccounts();
    fetchCurrencies();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .order("code");

      if (error) {
        if (error.code === '42P01') {
          // Table doesn't exist yet
          setAccounts([]);
        } else {
          toast.error("خطأ في جلب الحسابات");
          console.error(error);
        }
      } else {
        setAccounts((data || []) as Account[]);
      }
    } catch (e) {
      console.error("Connection error:", e);
    }
    setLoading(false);
  };

  const fetchCurrencies = async () => {
    try {
      const { data, error } = await supabase.from("currencies").select("id, code, name").eq("is_active", true);
      if (!error && data) setCurrencies(data);
    } catch (e) {
      // Table may not exist yet
      console.log("Currencies table not available");
    }
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

  const getParentLevel = (parentId: string | null): number => {
    if (!parentId) return 0;
    const parent = accounts.find(a => a.id === parentId);
    return parent ? parent.level : 0;
  };

  const validateCode = (code: string, excludeId?: string): boolean => {
    const exists = accounts.some(a => a.code === code && a.id !== excludeId);
    if (exists) {
      toast.error("رقم الحساب موجود مسبقاً");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("يجب تسجيل الدخول أولاً");
      return;
    }

    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    if (!validateCode(formData.code, editingAccount?.id)) {
      return;
    }

    const parentLevel = getParentLevel(formData.parent_id || null);
    const accountData = {
      code: formData.code.trim(),
      name: formData.name.trim(),
      account_type: formData.account_type,
      internal_type: formData.internal_type,
      account_group: formData.account_group || null,
      parent_id: formData.parent_id || null,
      level: parentLevel + 1,
      allow_manual_entry: formData.allow_manual_entry,
      opening_balance: formData.opening_balance || 0,
      reconcile: formData.reconcile,
      currency_id: formData.currency_id || null,
    };

    if (editingAccount) {
      // Check if trying to make a parent account postable
      const hasChildren = accounts.some(a => a.parent_id === editingAccount.id);
      if (hasChildren && formData.allow_manual_entry) {
        toast.error("لا يمكن السماح بالقيد على حساب له حسابات فرعية");
        return;
      }

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
    // Check if account has children
    const hasChildren = accounts.some(a => a.parent_id === id);
    if (hasChildren) {
      toast.error("لا يمكن حذف حساب له حسابات فرعية");
      return;
    }

    // Check if account has journal entries
    const { data: entries } = await supabase
      .from("journal_entry_lines")
      .select("id")
      .eq("account_id", id)
      .limit(1);

    if (entries && entries.length > 0) {
      toast.error("لا يمكن حذف حساب له قيود محاسبية");
      return;
    }

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
      internal_type: account.internal_type || "other",
      account_group: account.account_group || "",
      parent_id: account.parent_id || "",
      allow_manual_entry: account.allow_manual_entry ?? true,
      opening_balance: account.opening_balance || 0,
      reconcile: account.reconcile ?? false,
      currency_id: account.currency_id || "",
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      account_type: "asset",
      internal_type: "other",
      account_group: "",
      parent_id: "",
      allow_manual_entry: true,
      opening_balance: 0,
      reconcile: false,
      currency_id: "",
    });
    setEditingAccount(null);
    setIsDialogOpen(false);
  };

  const filteredAccounts = accounts.filter(
    (acc) =>
      acc.name.includes(searchQuery) || acc.code.includes(searchQuery)
  );

  const accountTree = buildTree(filteredAccounts);
  
  // Get accounts that can be parents (accounts without allow_manual_entry or have children potential)
  const getAvailableParents = () => {
    return accounts.filter(acc => {
      if (editingAccount && acc.id === editingAccount.id) return false;
      return true;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ListPageHeader
        title="شجرة الحسابات"
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "النظام المالي" },
          { label: "شجرة الحسابات" },
        ]}
        onAdd={() => { resetForm(); setIsDialogOpen(true); }}
        addLabel="إضافة حساب جديد"
        onRefresh={() => fetchAccounts()}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="بحث في الحسابات..."
      />
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <div className="hidden"><DialogTrigger /></div>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingAccount ? "تعديل الحساب" : "إضافة حساب جديد"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>رقم الحساب <span className="text-destructive">*</span></Label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="مثال: 1101"
                    required
                    maxLength={20}
                  />
                </div>
                <div className="space-y-2">
                  <Label>اسم الحساب <span className="text-destructive">*</span></Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="مثال: الصندوق الرئيسي"
                    required
                    maxLength={100}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                  <Label>النوع التفصيلي</Label>
                  <Select
                    value={formData.internal_type}
                    onValueChange={(value) => setFormData({ ...formData, internal_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(internalTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الحساب الرئيسي</Label>
                  <Select
                    value={formData.parent_id || "none"}
                    onValueChange={(value) => setFormData({ ...formData, parent_id: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الحساب الرئيسي" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون حساب رئيسي</SelectItem>
                      {getAvailableParents().map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.code} - {acc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>مجموعة الحساب</Label>
                  <Select
                    value={formData.account_group || "none"}
                    onValueChange={(value) => setFormData({ ...formData, account_group: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر المجموعة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون مجموعة</SelectItem>
                      {accountGroups.map((group) => (
                        <SelectItem key={group.value} value={group.value}>
                          {group.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>العملة</Label>
                  <Select
                    value={formData.currency_id || "none"}
                    onValueChange={(value) => setFormData({ ...formData, currency_id: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="العملة الافتراضية" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">العملة الافتراضية</SelectItem>
                      {currencies.map((currency) => (
                        <SelectItem key={currency.id} value={currency.id}>
                          {currency.code} - {currency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>الرصيد الافتتاحي</Label>
                  <Input
                    type="number"
                    value={formData.opening_balance || ""}
                    onChange={(e) => setFormData({ ...formData, opening_balance: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <Switch
                    id="allow_manual_entry"
                    checked={formData.allow_manual_entry}
                    onCheckedChange={(checked) => setFormData({ ...formData, allow_manual_entry: checked })}
                  />
                  <Label htmlFor="allow_manual_entry" className="cursor-pointer">
                    السماح بالقيد اليدوي
                  </Label>
                </div>
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <Switch
                    id="reconcile"
                    checked={formData.reconcile}
                    onCheckedChange={(checked) => setFormData({ ...formData, reconcile: checked })}
                  />
                  <Label htmlFor="reconcile" className="cursor-pointer">
                    تفعيل المطابقة
                  </Label>
                </div>
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
                  allAccounts={accounts}
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
  allAccounts,
}: {
  account: Account;
  level: number;
  onEdit: (account: Account) => void;
  onDelete: (id: string) => void;
  allAccounts: Account[];
}) {
  const [isOpen, setIsOpen] = useState(level === 0);
  const hasChildren = account.children && account.children.length > 0;
  const paddingRight = `${level * 1.5}rem`;
  const isPostable = account.allow_manual_entry && !hasChildren;

  return (
    <div>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div
            className={`flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors border ${
              isPostable ? "border-l-4 border-l-green-500" : ""
            }`}
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
                  <Badge variant="secondary" className="text-xs">
                    المستوى {account.level}
                  </Badge>
                  {isPostable && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                      قابل للقيد
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {accountTypeLabels[account.account_type]}
                  {account.internal_type && account.internal_type !== "other" && (
                    <> • {internalTypeLabels[account.internal_type]}</>
                  )}
                </p>
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
                  allAccounts={allAccounts}
                />
              ))}
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
}
