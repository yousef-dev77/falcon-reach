import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Edit, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ListPageHeader } from "@/components/ListPageHeader";

export default function SalaryComponents() {
  const [data, setData] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const empty = { code: "", name: "", component_type: "earning", calc_method: "fixed", default_value: 0, account_id: "", is_taxable: false, is_gosi_subject: false, is_active: true, sort_order: 0 };
  const [form, setForm] = useState<any>(empty);

  const fetchData = async () => {
    setLoading(true);
    const [c, a] = await Promise.all([
      supabase.from("hr_salary_components").select("*").order("sort_order"),
      supabase.from("accounts").select("id, code, name").eq("is_active", true).order("code"),
    ]);
    if (c.data) setData(c.data); if (a.data) setAccounts(a.data);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const openAdd = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (r: any) => { setEditing(r); setForm({ ...r, account_id: r.account_id || "" }); setOpen(true); };
  const save = async () => {
    if (!form.code || !form.name) return toast.error("الكود والاسم مطلوبان");
    const payload: any = { ...form, default_value: Number(form.default_value), sort_order: Number(form.sort_order), account_id: form.account_id || null };
    delete payload.id; delete payload.created_at; delete payload.updated_at;
    const res = editing ? await supabase.from("hr_salary_components").update(payload).eq("id", editing.id) : await supabase.from("hr_salary_components").insert(payload);
    if (res.error) toast.error(res.error.message); else { setOpen(false); fetchData(); }
  };
  const del = async (id: string) => { if (!confirm("حذف؟")) return; const r = await supabase.from("hr_salary_components").delete().eq("id", id); if (r.error) toast.error(r.error.message); else fetchData(); };

  return (
    <div>
      <ListPageHeader title="مكونات الراتب" breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "الموارد البشرية", href: "/hr" }, { label: "مكونات الراتب" }]} onAdd={openAdd} onRefresh={fetchData} showSearch={false} />
      <div className="bg-card border border-t-0 rounded-b-lg p-4">
        {loading ? <Loader2 className="animate-spin mx-auto" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>الكود</TableHead><TableHead>الاسم</TableHead><TableHead>النوع</TableHead><TableHead>طريقة الحساب</TableHead><TableHead>القيمة</TableHead><TableHead>الحساب</TableHead><TableHead>نشط</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell><Badge variant={r.component_type === "earning" ? "default" : "destructive"}>{r.component_type === "earning" ? "بدل/استحقاق" : "خصم"}</Badge></TableCell>
                  <TableCell>{r.calc_method === "fixed" ? "ثابت" : "% من الأساسي"}</TableCell>
                  <TableCell>{r.default_value}{r.calc_method === "percent_of_basic" ? "%" : " ر.س"}</TableCell>
                  <TableCell>{accounts.find(a => a.id === r.account_id)?.name || "-"}</TableCell>
                  <TableCell><Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "نشط" : "موقوف"}</Badge></TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "تعديل" : "إضافة"} مكون راتب</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>الكود *</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} /></div>
              <div><Label>الاسم *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>النوع</Label>
                <Select value={form.component_type} onValueChange={v => setForm({ ...form, component_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="earning">بدل/استحقاق</SelectItem><SelectItem value="deduction">خصم</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>طريقة الحساب</Label>
                <Select value={form.calc_method} onValueChange={v => setForm({ ...form, calc_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="fixed">ثابت</SelectItem><SelectItem value="percent_of_basic">% من الراتب الأساسي</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>القيمة الافتراضية</Label><Input type="number" value={form.default_value} onChange={e => setForm({ ...form, default_value: e.target.value })} /></div>
              <div><Label>ترتيب العرض</Label><Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} /></div>
            </div>
            <div><Label>الحساب المحاسبي</Label>
              <Select value={form.account_id || "none"} onValueChange={v => setForm({ ...form, account_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">بدون</SelectItem>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.is_gosi_subject} onCheckedChange={v => setForm({ ...form, is_gosi_subject: v })} /><Label>خاضع للتأمينات</Label></div>
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} /><Label>نشط</Label></div>
            <div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={save}>حفظ</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
