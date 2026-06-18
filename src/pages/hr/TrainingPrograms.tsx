import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Loader2, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ListPageHeader } from "@/components/ListPageHeader";

const CATEGORIES: Record<string, string> = {
  technical: "تقني", soft_skills: "مهارات شخصية", management: "إداري", safety: "سلامة", other: "أخرى",
};

export default function TrainingPrograms() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState("");
  const empty = { program_name: "", category: "technical", description: "", trainer_name: "", trainer_type: "internal", duration_hours: 0, cost_per_attendee: 0, max_attendees: 20, is_active: true };
  const [form, setForm] = useState<any>(empty);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase.from("hr_training_programs").select("*").order("created_at", { ascending: false });
    setData(data || []);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const save = async () => {
    if (!form.program_name) return toast.error("اسم البرنامج مطلوب");
    const payload: any = { ...form };
    ["duration_hours", "cost_per_attendee", "max_attendees"].forEach(k => { payload[k] = Number(payload[k]) || 0; });
    delete payload.id; delete payload.created_at; delete payload.updated_at;
    const res = editing
      ? await supabase.from("hr_training_programs").update(payload).eq("id", editing.id)
      : await supabase.from("hr_training_programs").insert(payload);
    if (res.error) toast.error(res.error.message);
    else { toast.success("تم الحفظ"); setOpen(false); fetchData(); }
  };
  const del = async (id: string) => {
    if (!confirm("حذف البرنامج؟")) return;
    const r = await supabase.from("hr_training_programs").delete().eq("id", id);
    if (r.error) toast.error(r.error.message); else fetchData();
  };

  const filtered = data.filter(r => r.program_name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <ListPageHeader
        title="برامج التدريب"
        breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "الموارد البشرية", href: "/hr" }, { label: "برامج التدريب" }]}
        onAdd={() => { setEditing(null); setForm(empty); setOpen(true); }}
        onRefresh={fetchData}
        searchValue={search}
        onSearchChange={setSearch}
        addLabel="برنامج جديد"
      />
      <div className="bg-card border border-t-0 rounded-b-lg p-4">
        {loading ? <Loader2 className="animate-spin mx-auto" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>البرنامج</TableHead>
                <TableHead>الفئة</TableHead>
                <TableHead>المدرّب</TableHead>
                <TableHead>المدة (ساعات)</TableHead>
                <TableHead>التكلفة/متدرب</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.program_name}</TableCell>
                  <TableCell>{CATEGORIES[r.category] || r.category}</TableCell>
                  <TableCell>{r.trainer_name || "-"} <Badge variant="outline" className="ms-1 text-xs">{r.trainer_type === "internal" ? "داخلي" : "خارجي"}</Badge></TableCell>
                  <TableCell>{r.duration_hours}</TableCell>
                  <TableCell>{Number(r.cost_per_attendee).toLocaleString()} ر.س</TableCell>
                  <TableCell><Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "نشط" : "موقوف"}</Badge></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(r); setForm({ ...empty, ...r }); setOpen(true); }}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">لا توجد برامج</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5" />{editing ? "تعديل" : "برنامج تدريبي جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>اسم البرنامج *</Label><Input value={form.program_name} onChange={e => setForm({ ...form, program_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>الفئة</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>نوع المدرّب</Label>
                <Select value={form.trainer_type} onValueChange={v => setForm({ ...form, trainer_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="internal">داخلي</SelectItem><SelectItem value="external">خارجي</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>اسم المدرّب</Label><Input value={form.trainer_name} onChange={e => setForm({ ...form, trainer_name: e.target.value })} /></div>
              <div><Label>المدة (ساعات)</Label><Input type="number" value={form.duration_hours} onChange={e => setForm({ ...form, duration_hours: e.target.value })} /></div>
              <div><Label>التكلفة لكل متدرب (ر.س)</Label><Input type="number" value={form.cost_per_attendee} onChange={e => setForm({ ...form, cost_per_attendee: e.target.value })} /></div>
              <div><Label>الحد الأقصى للمتدربين</Label><Input type="number" value={form.max_attendees} onChange={e => setForm({ ...form, max_attendees: e.target.value })} /></div>
              <div className="flex items-end gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} /><Label>نشط</Label></div>
            </div>
            <div><Label>الوصف</Label><Textarea rows={2} value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={save}>حفظ</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
