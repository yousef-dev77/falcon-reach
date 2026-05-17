import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ListPageHeader } from "@/components/ListPageHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function POSConfigs() {
  const [rows, setRows] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [cashBoxes, setCashBoxes] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [taxes, setTaxes] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({
    name: "", code: "", branch_id: "", warehouse_id: "", cash_box_id: "",
    bank_account_id: "", sales_account_id: "", default_tax_id: "",
    allow_discount: true, allow_price_edit: false, require_customer: false, is_active: true,
  });

  const load = async () => {
    const { data } = await supabase.from("pos_configs").select("*, branches(name), warehouses:warehouse_id, cash_boxes(name), bank_accounts(bank_name)").order("created_at", { ascending: false });
    setRows(data || []);
  };

  useEffect(() => {
    load();
    supabase.from("branches").select("*").eq("is_active", true).then(({ data }) => setBranches(data || []));
    supabase.from("warehouses" as any).select("*").then(({ data }) => setWarehouses((data as any) || []));
    supabase.from("cash_boxes").select("*").eq("is_active", true).then(({ data }) => setCashBoxes(data || []));
    supabase.from("bank_accounts").select("*").eq("is_active", true).then(({ data }) => setBanks(data || []));
    supabase.from("accounts").select("id,code,name").eq("is_active", true).then(({ data }) => setAccounts(data || []));
    supabase.from("taxes").select("*").then(({ data }) => setTaxes(data || []));
  }, []);

  const save = async () => {
    if (!form.name || !form.code) return toast.error("الاسم والكود مطلوبان");
    const payload = { ...form };
    Object.keys(payload).forEach(k => { if (payload[k] === "") payload[k] = null; });
    const { error } = await supabase.from("pos_configs").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("تم حفظ نقطة البيع");
    setOpen(false);
    setForm({ name: "", code: "", branch_id: "", warehouse_id: "", cash_box_id: "", bank_account_id: "", sales_account_id: "", default_tax_id: "", allow_discount: true, allow_price_edit: false, require_customer: false, is_active: true });
    load();
  };

  return (
    <div className="p-4 space-y-4">
      <ListPageHeader
        title="إعدادات نقاط البيع"
        breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "نقاط البيع" }, { label: "الإعدادات" }]}
        onAdd={() => setOpen(true)}
        onRefresh={load}
        addLabel="نقطة بيع جديدة"
      />

      <div className="bg-card border border-t-0 rounded-b-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الكود</TableHead>
              <TableHead>الاسم</TableHead>
              <TableHead>الفرع</TableHead>
              <TableHead>الصندوق</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono">{r.code}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.branches?.name || "—"}</TableCell>
                <TableCell>{r.cash_boxes?.name || "—"}</TableCell>
                <TableCell>
                  <Badge variant={r.is_active ? "default" : "secondary"}>
                    {r.is_active ? "نشط" : "متوقف"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">لا توجد نقاط بيع</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>نقطة بيع جديدة</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>الاسم *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>الكود *</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
            <div>
              <Label>الفرع</Label>
              <Select value={form.branch_id} onValueChange={v => setForm({ ...form, branch_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>المستودع</Label>
              <Select value={form.warehouse_id} onValueChange={v => setForm({ ...form, warehouse_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>{warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>الصندوق</Label>
              <Select value={form.cash_box_id} onValueChange={v => setForm({ ...form, cash_box_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>{cashBoxes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>الحساب البنكي (للشبكة)</Label>
              <Select value={form.bank_account_id} onValueChange={v => setForm({ ...form, bank_account_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>{banks.map(b => <SelectItem key={b.id} value={b.id}>{b.bank_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>حساب الإيرادات</Label>
              <Select value={form.sales_account_id} onValueChange={v => setForm({ ...form, sales_account_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>الضريبة الافتراضية</Label>
              <Select value={form.default_tax_id} onValueChange={v => setForm({ ...form, default_tax_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>{taxes.map(t => <SelectItem key={t.id} value={t.id}>{t.name} ({t.rate}%)</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.allow_discount} onCheckedChange={v => setForm({ ...form, allow_discount: v })} /><Label>السماح بالخصم</Label></div>
            <div className="flex items-center gap-2"><Switch checked={form.allow_price_edit} onCheckedChange={v => setForm({ ...form, allow_price_edit: v })} /><Label>تعديل السعر</Label></div>
            <div className="flex items-center gap-2"><Switch checked={form.require_customer} onCheckedChange={v => setForm({ ...form, require_customer: v })} /><Label>عميل مطلوب</Label></div>
          </div>
          <DialogFooter><Button onClick={save}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
