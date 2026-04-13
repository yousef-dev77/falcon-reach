import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ChevronDown, ChevronRight, Plus, FolderOpen, Folder, FileText, Trash2, Pause, Loader2, Save, X } from "lucide-react";
import { ListPageHeader } from "@/components/ListPageHeader";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
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
  is_frozen: boolean | null;
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
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addParentId, setAddParentId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
      const { data, error } = await supabase.from("accounts").select("*").order("code");
      if (error) {
        if (error.code !== '42P01') toast.error("خطأ في جلب الحسابات");
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
    } catch (e) { /* ignore */ }
  };

  const buildTree = (accs: Account[]): Account[] => {
    const map = new Map<string, Account>();
    const roots: Account[] = [];
    accs.forEach((a) => map.set(a.id, { ...a, children: [] }));
    accs.forEach((a) => {
      const node = map.get(a.id)!;
      if (a.parent_id && map.has(a.parent_id)) {
        map.get(a.parent_id)!.children!.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  };

  const handleSelectAccount = (account: Account) => {
    setSelectedAccount(account);
    setIsEditing(false);
    setIsAdding(false);
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
  };

  const handleStartEdit = () => {
    setIsEditing(true);
    setIsAdding(false);
  };

  const handleAddChild = (parentId: string | null) => {
    const parent = parentId ? accounts.find(a => a.id === parentId) : null;
    setIsAdding(true);
    setIsEditing(false);
    setAddParentId(parentId);
    setSelectedAccount(null);
    setFormData({
      code: "",
      name: "",
      account_type: parent?.account_type || "asset",
      internal_type: "other",
      account_group: parent?.account_group || "",
      parent_id: parentId || "",
      allow_manual_entry: true,
      opening_balance: 0,
      reconcile: false,
      currency_id: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.error("يجب تسجيل الدخول أولاً"); return; }
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    const codeExists = accounts.some(a => a.code === formData.code && a.id !== selectedAccount?.id);
    if (codeExists) { toast.error("رقم الحساب موجود مسبقاً"); return; }

    const parentLevel = formData.parent_id
      ? (accounts.find(a => a.id === formData.parent_id)?.level || 0)
      : 0;

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

    if (isEditing && selectedAccount) {
      const hasChildren = accounts.some(a => a.parent_id === selectedAccount.id);
      if (hasChildren && formData.allow_manual_entry) {
        toast.error("لا يمكن السماح بالقيد على حساب له حسابات فرعية");
        return;
      }
      const { error } = await supabase.from("accounts").update(accountData).eq("id", selectedAccount.id);
      if (error) { toast.error("خطأ في تحديث الحساب"); }
      else {
        toast.success("تم تحديث الحساب بنجاح");
        fetchAccounts();
        setIsEditing(false);
      }
    } else {
      const { data, error } = await supabase.from("accounts").insert(accountData).select().single();
      if (error) { toast.error("خطأ في إضافة الحساب"); }
      else {
        toast.success("تم إضافة الحساب بنجاح");
        fetchAccounts();
        setIsAdding(false);
        if (data) handleSelectAccount(data as Account);
      }
    }
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    const hasChildren = accounts.some(a => a.parent_id === deletingId);
    if (hasChildren) { toast.error("لا يمكن حذف حساب له حسابات فرعية"); setDeletingId(null); return; }

    const { data: entries } = await supabase.from("journal_entry_lines").select("id").eq("account_id", deletingId).limit(1);
    if (entries && entries.length > 0) { toast.error("لا يمكن حذف حساب له قيود محاسبية"); setDeletingId(null); return; }

    const { error } = await supabase.from("accounts").delete().eq("id", deletingId);
    if (error) { toast.error("خطأ في حذف الحساب"); }
    else {
      toast.success("تم حذف الحساب بنجاح");
      if (selectedAccount?.id === deletingId) { setSelectedAccount(null); }
      fetchAccounts();
    }
    setDeletingId(null);
  };

  const handleFreeze = async (account: Account) => {
    const { error } = await supabase.from("accounts").update({ is_frozen: !account.is_frozen }).eq("id", account.id);
    if (error) toast.error("خطأ في تحديث الحساب");
    else { toast.success(account.is_frozen ? "تم إلغاء تجميد الحساب" : "تم تجميد الحساب"); fetchAccounts(); }
  };

  const filteredAccounts = accounts.filter(
    (acc) => acc.name.includes(searchQuery) || acc.code.includes(searchQuery)
  );
  const accountTree = buildTree(filteredAccounts);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const showDetails = selectedAccount || isAdding;
  const hasChildren = selectedAccount ? accounts.some(a => a.parent_id === selectedAccount.id) : false;
  const isLeaf = selectedAccount ? !hasChildren : false;

  return (
    <div className="space-y-4">
      <ListPageHeader
        title="شجرة الحسابات"
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "النظام المالي" },
          { label: "شجرة الحسابات" },
        ]}
        onAdd={() => handleAddChild(null)}
        addLabel="إضافة حساب"
        onRefresh={() => fetchAccounts()}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="بحث في الحسابات..."
      />

      <div className="flex gap-4 flex-col lg:flex-row">
        {/* Tree Panel */}
        <Card className="lg:w-1/2 w-full">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <FolderOpen className="h-5 w-5 text-primary" />
              <span>دليل الحسابات</span>
            </div>
          </div>
          <CardContent className="pt-4 max-h-[70vh] overflow-y-auto">
            {accountTree.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                لا توجد حسابات. ابدأ بإضافة حساب جديد.
              </div>
            ) : (
              <div className="space-y-0.5">
                {accountTree.map((account) => (
                  <TreeNode
                    key={account.id}
                    account={account}
                    level={0}
                    selectedId={selectedAccount?.id || null}
                    onSelect={handleSelectAccount}
                    onAddChild={handleAddChild}
                    onDelete={(id) => setDeletingId(id)}
                    onFreeze={handleFreeze}
                    allAccounts={accounts}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Details Panel */}
        <Card className="lg:w-1/2 w-full">
          <div className="p-4 border-b bg-primary text-primary-foreground rounded-t-lg">
            <h2 className="text-lg font-semibold text-center">
              {isAdding ? "إضافة حساب جديد" : selectedAccount ? "إدارة تفاصيل الحساب" : "اختر حساباً لعرض التفاصيل"}
            </h2>
          </div>
          <CardContent className="pt-6">
            {!showDetails ? (
              <div className="text-center py-20 text-muted-foreground">
                <FolderOpen className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p>اختر حساباً من الشجرة لعرض تفاصيله</p>
                <p className="text-sm mt-2">أو اضغط (+) لإضافة حساب جديد</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Row 1: Name */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>اسم الحساب (عربي) <span className="text-destructive">*</span></Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="مثال: الصندوق الرئيسي"
                      disabled={!isEditing && !isAdding}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>كود الحساب <span className="text-destructive">*</span></Label>
                    <Input
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      placeholder="مثال: 1111"
                      disabled={!isEditing && !isAdding}
                      required
                    />
                  </div>
                </div>

                {/* Row 2: Parent + Level */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>العلاقة مع الحساب الأب</Label>
                    <Select
                      value={formData.parent_id || "none"}
                      onValueChange={(v) => setFormData({ ...formData, parent_id: v === "none" ? "" : v })}
                      disabled={!isEditing && !isAdding}
                    >
                      <SelectTrigger><SelectValue placeholder="بدون حساب رئيسي" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">بدون حساب رئيسي</SelectItem>
                        {accounts.filter(a => a.id !== selectedAccount?.id).map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>رقم العقدة</Label>
                    <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30 h-10">
                      <span className="text-sm font-mono">
                        {selectedAccount?.level || (formData.parent_id ? (accounts.find(a => a.id === formData.parent_id)?.level || 0) + 1 : 1)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Row 3: Flags */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <Switch
                      id="is_leaf"
                      checked={formData.allow_manual_entry}
                      onCheckedChange={(v) => setFormData({ ...formData, allow_manual_entry: v })}
                      disabled={!isEditing && !isAdding}
                    />
                    <Label htmlFor="is_leaf" className="cursor-pointer">هل هو حساب فرعي (قابل للقيد)</Label>
                  </div>
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <Switch
                      id="reconcile"
                      checked={formData.reconcile}
                      onCheckedChange={(v) => setFormData({ ...formData, reconcile: v })}
                      disabled={!isEditing && !isAdding}
                    />
                    <Label htmlFor="reconcile" className="cursor-pointer">السماح بالتسوية</Label>
                  </div>
                </div>

                {/* Row 4: Account Type + Internal Type */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>نوع الحساب</Label>
                    <Select
                      value={formData.account_type}
                      onValueChange={(v) => setFormData({ ...formData, account_type: v as Account["account_type"] })}
                      disabled={!isEditing && !isAdding}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(accountTypeLabels).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>النوع التفصيلي</Label>
                    <Select
                      value={formData.internal_type}
                      onValueChange={(v) => setFormData({ ...formData, internal_type: v })}
                      disabled={!isEditing && !isAdding}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(internalTypeLabels).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row 5: Currency + Opening Balance */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>العملة</Label>
                    <Select
                      value={formData.currency_id || "none"}
                      onValueChange={(v) => setFormData({ ...formData, currency_id: v === "none" ? "" : v })}
                      disabled={!isEditing && !isAdding}
                    >
                      <SelectTrigger><SelectValue placeholder="العملة الافتراضية" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">العملة الافتراضية</SelectItem>
                        {currencies.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>
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
                      disabled={!isEditing && !isAdding}
                    />
                  </div>
                </div>

                {/* Row 6: Account Group */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>نوع التقرير</Label>
                    <Select
                      value={formData.account_group || "none"}
                      onValueChange={(v) => setFormData({ ...formData, account_group: v === "none" ? "" : v })}
                      disabled={!isEditing && !isAdding}
                    >
                      <SelectTrigger><SelectValue placeholder="اختر المجموعة" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">بدون مجموعة</SelectItem>
                        {accountGroups.map((g) => (
                          <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Action Buttons */}
                {(isEditing || isAdding) && (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button type="submit" className="flex-1 gap-2">
                      <Save className="h-4 w-4" />
                      {isAdding ? "حفظ" : "تحديث"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => { setIsEditing(false); setIsAdding(false); }} className="gap-2">
                      <X className="h-4 w-4" />
                      إلغاء
                    </Button>
                  </div>
                )}

                {selectedAccount && !isEditing && !isAdding && (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button type="button" onClick={handleStartEdit} className="flex-1">
                      تعديل الحساب
                    </Button>
                  </div>
                )}
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذا الحساب؟ لا يمكن التراجع.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ─────────────── Tree Node Component ─────────────── */

function TreeNode({
  account,
  level,
  selectedId,
  onSelect,
  onAddChild,
  onDelete,
  onFreeze,
  allAccounts,
}: {
  account: Account;
  level: number;
  selectedId: string | null;
  onSelect: (a: Account) => void;
  onAddChild: (parentId: string | null) => void;
  onDelete: (id: string) => void;
  onFreeze: (a: Account) => void;
  allAccounts: Account[];
}) {
  const [isOpen, setIsOpen] = useState(level < 2);
  const hasChildren = account.children && account.children.length > 0;
  const isLeaf = !hasChildren;
  const isSelected = selectedId === account.id;
  const paddingStart = `${level * 1.25 + 0.5}rem`;

  return (
    <div>
      <div
        className={`flex items-center justify-between py-2 px-2 rounded cursor-pointer transition-colors group ${
          isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50"
        }`}
        style={{ paddingInlineStart: paddingStart }}
        onClick={() => onSelect(account)}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {hasChildren ? (
            <button
              onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
              className="p-0.5 hover:bg-muted rounded"
            >
              {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
          ) : (
            <div className="w-5" />
          )}
          {hasChildren ? (
            isOpen ? <FolderOpen className="h-4 w-4 text-primary shrink-0" /> : <Folder className="h-4 w-4 text-primary shrink-0" />
          ) : (
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <span className={`text-sm truncate ${isSelected ? "font-semibold" : ""} ${account.is_frozen ? "text-muted-foreground line-through" : ""}`}>
            {account.name} - {account.code}
          </span>
        </div>

        {/* Action Buttons - visible on hover or when selected */}
        <div className={`flex items-center gap-0.5 shrink-0 ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
          <button
            onClick={(e) => { e.stopPropagation(); onAddChild(account.id); }}
            className="p-1 rounded hover:bg-primary/10 text-primary"
            title="إضافة حساب فرعي"
          >
            <Plus className="h-4 w-4" />
          </button>
          {isLeaf && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(account.id); }}
                className="p-1 rounded hover:bg-destructive/10 text-destructive"
                title="حذف"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onFreeze(account); }}
                className={`p-1 rounded ${account.is_frozen ? "text-green-600 hover:bg-green-50" : "text-orange-500 hover:bg-orange-50"}`}
                title={account.is_frozen ? "إلغاء التجميد" : "تجميد"}
              >
                <Pause className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {hasChildren && isOpen && (
        <div>
          {account.children!.map((child) => (
            <TreeNode
              key={child.id}
              account={child}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onFreeze={onFreeze}
              allAccounts={allAccounts}
            />
          ))}
        </div>
      )}
    </div>
  );
}
