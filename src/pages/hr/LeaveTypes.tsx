import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Edit, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ListPageHeader } from "@/components/ListPageHeader";

export default function LeaveTypes() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", code: "", default_days_per_year: 0, is_paid: true, requires_approval: true, is_active: true });
  const fetchData = async () => { setLoading(true); const r = await supabase.from("hr_leave_types").select("*").order("name"); if (r.data) setData(r.data); setLoading(false); };
  useEffect(() => { fetchData(); }, []);

  const openAdd = () => { setEditing(null); setForm({ name: "", code: "", default_days_per_year: 0, is_paid: true, requires_approval: true, is_active: true }); setOpen(true); };
  const openEdit = (r: any) => { setEditing(r); setForm(r); setOpen(true); };
  const save = async () => {
    if (!form.name) return toast.error("الاسم مطلوب");
    const payload: any = { ...form, default_days_per_year: Number(form.default_days_per_year) };
    delete payload.id; delete payload.created_at; delete payload.updated_at;
    const res = editing ? await supabase.from("hr_leave_types").update(payload).eq("id", editing.id) : await supabase.from("hr_leave_types").insert(payload);
    if (res.error) toast.error(res.error.message); else { setOpen(false); fetchData(); }
  };
  const del = async (id: string) => { if (!confirm("حذف؟")) return; const r = await supabase.from("hr_leave_types").delete().eq("id", id); if (r.error) toast.error(r.error.message); else fetchData(); };

  return (
    <div>
      <ListPageHeader title="أنواع الإجازات" breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "الموارد البشرية", href: "/hr" }, { label: "أنواع الإجازات" }]} onAdd={openAdd} onRefresh={fetchData} showSearch={false} />
      <div className="bg-card border border-t-0 rounded-b-lg p-4">
        {loading ? <Loader2 className="animate-spin mx-auto" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>الكود</TableHead><TableHead>الأيام السنوية</TableHead><TableHead>مدفوعة</TableHead><TableHead>تتطلب اعتماد</TableHead><TableHead>نشط</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="font-mono">{r.code}</TableCell>
                  <TableCell>{r.default_days_per_year}</TableCell>
                  <TableCell>{r.is_paid ? "نعم" : "لا"}</TableCell>
                  <TableCell>{r.requires_approval ? "نعم" : "لا"}</TableCell>
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
          <DialogHeader><DialogTitle>{editing ? "تعديل" : "إضافة"} نوع إجازة</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>الاسم *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>الكود</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
            <div><Label>الأيام السنوية</Label><Input type="number" value={form.default_days_per_year} onChange={e => setForm({ ...form, default_days_per_year: Number(e.target.value) })} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.is_paid} onCheckedChange={v => setForm({ ...form, is_paid: v })} /><Label>مدفوعة</Label></div>
            <div className="flex items-center gap-2"><Switch checked={form.requires_approval} onCheckedChange={v => setForm({ ...form, requires_approval: v })} /><Label>تتطلب اعتماد</Label></div>
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} /><Label>نشط</Label></div>
            <div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={save}>حفظ</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
