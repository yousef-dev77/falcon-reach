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

type Dept = { id: string; name: string; code: string | null; parent_id: string | null; branch_id: string | null; is_active: boolean };
type Branch = { id: string; name: string };

export default function Departments() {
  const [data, setData] = useState<Dept[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Dept | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", code: "", parent_id: "", branch_id: "", is_active: true });

  const fetchData = async () => {
    setLoading(true);
    const [d, b] = await Promise.all([
      supabase.from("hr_departments").select("*").order("name"),
      supabase.from("branches").select("id, name").eq("is_active", true),
    ]);
    if (d.error) toast.error("خطأ في جلب الأقسام"); else setData(d.data || []);
    if (b.data) setBranches(b.data);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const openAdd = () => { setEditing(null); setForm({ name: "", code: "", parent_id: "", branch_id: "", is_active: true }); setOpen(true); };
  const openEdit = (row: Dept) => { setEditing(row); setForm({ name: row.name, code: row.code || "", parent_id: row.parent_id || "", branch_id: row.branch_id || "", is_active: row.is_active }); setOpen(true); };

  const save = async () => {
    if (!form.name) { toast.error("الاسم مطلوب"); return; }
    const payload: any = { name: form.name, code: form.code || null, parent_id: form.parent_id || null, branch_id: form.branch_id || null, is_active: form.is_active };
    const res = editing ? await supabase.from("hr_departments").update(payload).eq("id", editing.id) : await supabase.from("hr_departments").insert(payload);
    if (res.error) toast.error(res.error.message); else { toast.success("تم الحفظ"); setOpen(false); fetchData(); }
  };

  const del = async (id: string) => {
    if (!confirm("حذف هذا القسم؟")) return;
    const res = await supabase.from("hr_departments").delete().eq("id", id);
    if (res.error) toast.error(res.error.message); else { toast.success("تم الحذف"); fetchData(); }
  };

  const filtered = data.filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || (r.code || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-0">
      <ListPageHeader title="الأقسام" breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "الموارد البشرية", href: "/hr" }, { label: "الأقسام" }]} onAdd={openAdd} onRefresh={fetchData} searchValue={search} onSearchChange={setSearch} />
      <div className="bg-card border border-t-0 rounded-b-lg p-4">
        {loading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div> : (
          <Table>
            <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>الكود</TableHead><TableHead>القسم الأب</TableHead><TableHead>الفرع</TableHead><TableHead>نشط</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.code || "-"}</TableCell>
                  <TableCell>{data.find(d => d.id === r.parent_id)?.name || "-"}</TableCell>
                  <TableCell>{branches.find(b => b.id === r.branch_id)?.name || "كل الفروع"}</TableCell>
                  <TableCell><Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "نشط" : "موقوف"}</Badge></TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد بيانات</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "تعديل قسم" : "إضافة قسم"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>الاسم *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>الكود</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
            <div><Label>القسم الأب</Label>
              <Select value={form.parent_id || "none"} onValueChange={v => setForm({ ...form, parent_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">بدون</SelectItem>{data.filter(d => d.id !== editing?.id).map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>الفرع</Label>
              <Select value={form.branch_id || "none"} onValueChange={v => setForm({ ...form, branch_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">كل الفروع</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} /><Label>نشط</Label></div>
            <div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={save}>حفظ</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
