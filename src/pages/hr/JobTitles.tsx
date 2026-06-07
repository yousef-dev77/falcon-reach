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

type Job = { id: string; name: string; code: string | null; department_id: string | null; description: string | null; is_active: boolean };
type Dept = { id: string; name: string };

export default function JobTitles() {
  const [data, setData] = useState<Job[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Job | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", code: "", department_id: "", description: "", is_active: true });

  const fetchData = async () => {
    setLoading(true);
    const [j, d] = await Promise.all([
      supabase.from("hr_job_titles").select("*").order("name"),
      supabase.from("hr_departments").select("id, name").eq("is_active", true),
    ]);
    if (j.data) setData(j.data); if (d.data) setDepts(d.data);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const openAdd = () => { setEditing(null); setForm({ name: "", code: "", department_id: "", description: "", is_active: true }); setOpen(true); };
  const openEdit = (r: Job) => { setEditing(r); setForm({ name: r.name, code: r.code || "", department_id: r.department_id || "", description: r.description || "", is_active: r.is_active }); setOpen(true); };

  const save = async () => {
    if (!form.name) return toast.error("الاسم مطلوب");
    const payload: any = { name: form.name, code: form.code || null, department_id: form.department_id || null, description: form.description || null, is_active: form.is_active };
    const res = editing ? await supabase.from("hr_job_titles").update(payload).eq("id", editing.id) : await supabase.from("hr_job_titles").insert(payload);
    if (res.error) toast.error(res.error.message); else { toast.success("تم"); setOpen(false); fetchData(); }
  };
  const del = async (id: string) => { if (!confirm("حذف؟")) return; const r = await supabase.from("hr_job_titles").delete().eq("id", id); if (r.error) toast.error(r.error.message); else fetchData(); };
  const filtered = data.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <ListPageHeader title="المسميات الوظيفية" breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "الموارد البشرية", href: "/hr" }, { label: "المسميات الوظيفية" }]} onAdd={openAdd} onRefresh={fetchData} searchValue={search} onSearchChange={setSearch} />
      <div className="bg-card border border-t-0 rounded-b-lg p-4">
        {loading ? <Loader2 className="animate-spin mx-auto" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>الكود</TableHead><TableHead>القسم</TableHead><TableHead>نشط</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.code || "-"}</TableCell>
                  <TableCell>{depts.find(d => d.id === r.department_id)?.name || "-"}</TableCell>
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
          <DialogHeader><DialogTitle>{editing ? "تعديل" : "إضافة"} مسمى وظيفي</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>الاسم *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>الكود</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
            <div><Label>القسم</Label>
              <Select value={form.department_id || "none"} onValueChange={v => setForm({ ...form, department_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">بدون</SelectItem>{depts.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>الوصف</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} /><Label>نشط</Label></div>
            <div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={save}>حفظ</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
