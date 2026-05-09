import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ListPageHeader } from "@/components/ListPageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { usePostableAccounts } from "@/hooks/useSystemSettings";

interface Tax {
  id: string;
  code: string;
  name: string;
  rate: number;
  tax_type: string;
  is_inclusive: boolean;
  output_account_id: string | null;
  input_account_id: string | null;
  is_active: boolean;
  description: string | null;
}

export default function Taxes() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tax | null>(null);
  const [form, setForm] = useState<Partial<Tax>>({ tax_type: "both", rate: 0, is_active: true, is_inclusive: false });

  const { data: accounts = [] } = usePostableAccounts();
  const { data: taxes = [], isLoading, refetch } = useQuery({
    queryKey: ["taxes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("taxes").select("*").order("rate", { ascending: false });
      if (error) throw error;
      return data as Tax[];
    },
  });

  const save = useMutation({
    mutationFn: async (payload: Partial<Tax>) => {
      if (editing) {
        const { error } = await supabase.from("taxes").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("taxes").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "تم التحديث" : "تم الإضافة");
      qc.invalidateQueries({ queryKey: ["taxes"] });
      setOpen(false);
      setEditing(null);
      setForm({ tax_type: "both", rate: 0, is_active: true, is_inclusive: false });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("taxes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["taxes"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = taxes.filter(t =>
    !search || t.name.includes(search) || t.code.includes(search)
  );

  return (
    <div className="space-y-4">
      <ListPageHeader
        title="إدارة الضرائب"
        breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "النظام المالي", href: "/finance/accounts" }, { label: "الضرائب" }]}
        searchValue={search}
        onSearchChange={setSearch}
        onAdd={() => { setEditing(null); setForm({ tax_type: "both", rate: 0, is_active: true, is_inclusive: false }); setOpen(true); }}
        onRefresh={() => refetch()}
      />

      <div className="bg-card border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الكود</TableHead>
              <TableHead>الاسم</TableHead>
              <TableHead>المعدل</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>شامل</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center">جاري التحميل...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center">لا توجد بيانات</TableCell></TableRow>
            ) : filtered.map(t => (
              <TableRow key={t.id}>
                <TableCell>{t.code}</TableCell>
                <TableCell>{t.name}</TableCell>
                <TableCell>{t.rate}%</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {t.tax_type === "sales" ? "مبيعات" : t.tax_type === "purchase" ? "مشتريات" : "كلاهما"}
                  </Badge>
                </TableCell>
                <TableCell>{t.is_inclusive ? "نعم" : "لا"}</TableCell>
                <TableCell>
                  <Badge variant={t.is_active ? "default" : "secondary"}>
                    {t.is_active ? "نشط" : "غير نشط"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(t); setForm(t); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => confirm("حذف؟") && del.mutate(t.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "تعديل ضريبة" : "ضريبة جديدة"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>الكود *</Label>
              <Input value={form.code || ""} onChange={e => setForm({ ...form, code: e.target.value })} />
            </div>
            <div>
              <Label>الاسم *</Label>
              <Input value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>المعدل (%) *</Label>
              <Input type="number" step="0.01" value={form.rate || 0} onChange={e => setForm({ ...form, rate: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>النوع</Label>
              <Select value={form.tax_type} onValueChange={v => setForm({ ...form, tax_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">مبيعات فقط</SelectItem>
                  <SelectItem value="purchase">مشتريات فقط</SelectItem>
                  <SelectItem value="both">كلاهما</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>حساب ضريبة المخرجات (مبيعات)</Label>
              <Select value={form.output_account_id || ""} onValueChange={v => setForm({ ...form, output_account_id: v || null })}>
                <SelectTrigger><SelectValue placeholder="اختر حساب" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>حساب ضريبة المدخلات (مشتريات)</Label>
              <Select value={form.input_account_id || ""} onValueChange={v => setForm({ ...form, input_account_id: v || null })}>
                <SelectTrigger><SelectValue placeholder="اختر حساب" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_inclusive || false} onCheckedChange={v => setForm({ ...form, is_inclusive: v })} />
              <Label>السعر شامل الضريبة</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active ?? true} onCheckedChange={v => setForm({ ...form, is_active: v })} />
              <Label>نشط</Label>
            </div>
            <div className="col-span-2">
              <Label>الوصف</Label>
              <Input value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={() => save.mutate(form)} disabled={!form.code || !form.name || save.isPending}>
              {save.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
