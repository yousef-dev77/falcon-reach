import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Loader2, Eye, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ListPageHeader } from "@/components/ListPageHeader";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

const TYPES: Record<string, string> = { annual: "سنوي", semi: "نصف سنوي", quarterly: "ربع سنوي", monthly: "شهري" };
const STATUS: Record<string, { label: string; variant: any }> = {
  draft: { label: "مسودة", variant: "secondary" },
  active: { label: "نشطة", variant: "default" },
  completed: { label: "مكتملة", variant: "outline" },
  closed: { label: "مغلقة", variant: "secondary" },
};

export default function PerformanceCycles() {
  const navigate = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState("");
  const empty = { cycle_name: "", cycle_type: "annual", start_date: "", end_date: "", status: "draft", notes: "" };
  const [form, setForm] = useState<any>(empty);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase.from("hr_performance_cycles").select("*").order("start_date", { ascending: false });
    setData(data || []);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const save = async () => {
    if (!form.cycle_name || !form.start_date || !form.end_date) return toast.error("الاسم والتواريخ مطلوبة");
    const payload: any = { ...form };
    delete payload.id; delete payload.created_at; delete payload.updated_at; delete payload.created_by;
    const res = editing
      ? await supabase.from("hr_performance_cycles").update(payload).eq("id", editing.id)
      : await supabase.from("hr_performance_cycles").insert(payload);
    if (res.error) toast.error(res.error.message);
    else { toast.success("تم الحفظ"); setOpen(false); fetchData(); }
  };
  const del = async (id: string) => {
    if (!confirm("حذف الدورة؟")) return;
    const r = await supabase.from("hr_performance_cycles").delete().eq("id", id);
    if (r.error) toast.error(r.error.message); else fetchData();
  };

  const filtered = data.filter(r => r.cycle_name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <ListPageHeader
        title="تقييم الأداء"
        breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "الموارد البشرية", href: "/hr" }, { label: "تقييم الأداء" }]}
        onAdd={() => { setEditing(null); setForm(empty); setOpen(true); }}
        onRefresh={fetchData}
        searchValue={search}
        onSearchChange={setSearch}
        addLabel="دورة تقييم جديدة"
      />
      <div className="bg-card border border-t-0 rounded-b-lg p-4">
        {loading ? <Loader2 className="animate-spin mx-auto" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>اسم الدورة</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>البداية</TableHead>
                <TableHead>النهاية</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.cycle_name}</TableCell>
                  <TableCell>{TYPES[r.cycle_type] || r.cycle_type}</TableCell>
                  <TableCell>{format(new Date(r.start_date), "yyyy/MM/dd")}</TableCell>
                  <TableCell>{format(new Date(r.end_date), "yyyy/MM/dd")}</TableCell>
                  <TableCell><Badge variant={STATUS[r.status]?.variant}>{STATUS[r.status]?.label || r.status}</Badge></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => navigate(`/hr/performance/${r.id}`)}><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(r); setForm({ ...empty, ...r }); setOpen(true); }}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد دورات تقييم</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Target className="h-5 w-5" />{editing ? "تعديل" : "دورة تقييم جديدة"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>اسم الدورة *</Label><Input value={form.cycle_name} onChange={e => setForm({ ...form, cycle_name: e.target.value })} placeholder="مثال: تقييم 2026" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>النوع</Label>
                <Select value={form.cycle_type} onValueChange={v => setForm({ ...form, cycle_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>الحالة</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>تاريخ البداية *</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><Label>تاريخ النهاية *</Label><Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div><Label>ملاحظات</Label><Textarea rows={2} value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
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
