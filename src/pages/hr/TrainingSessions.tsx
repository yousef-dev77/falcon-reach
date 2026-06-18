import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit, Trash2, Loader2, Users, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ListPageHeader } from "@/components/ListPageHeader";
import { format } from "date-fns";

const STATUS: Record<string, { label: string; variant: any }> = {
  planned: { label: "مخطط", variant: "secondary" },
  ongoing: { label: "جاري", variant: "default" },
  completed: { label: "مكتمل", variant: "outline" },
  cancelled: { label: "ملغى", variant: "destructive" },
};

export default function TrainingSessions() {
  const [data, setData] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [emps, setEmps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState("");
  const empty = { program_id: "", session_code: "", start_date: "", end_date: "", location: "", status: "planned", branch_id: "", notes: "" };
  const [form, setForm] = useState<any>(empty);

  // Attendees panel
  const [attOpen, setAttOpen] = useState(false);
  const [attSession, setAttSession] = useState<any>(null);
  const [attendees, setAttendees] = useState<any[]>([]);

  const fetchData = async () => {
    setLoading(true);
    const [s, p, b, e] = await Promise.all([
      supabase.from("hr_training_sessions").select("*").order("start_date", { ascending: false }),
      supabase.from("hr_training_programs").select("id, program_name").eq("is_active", true),
      supabase.from("branches").select("id, name").eq("is_active", true),
      supabase.from("hr_employees").select("id, full_name, employee_number").eq("is_active", true).order("full_name"),
    ]);
    setData(s.data || []); setPrograms(p.data || []); setBranches(b.data || []); setEmps(e.data || []);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const save = async () => {
    if (!form.program_id || !form.start_date || !form.end_date) return toast.error("البرنامج والتواريخ مطلوبة");
    const payload: any = { ...form };
    if (!payload.branch_id) payload.branch_id = null;
    delete payload.id; delete payload.created_at; delete payload.updated_at;
    const res = editing
      ? await supabase.from("hr_training_sessions").update(payload).eq("id", editing.id)
      : await supabase.from("hr_training_sessions").insert(payload);
    if (res.error) toast.error(res.error.message);
    else { toast.success("تم الحفظ"); setOpen(false); fetchData(); }
  };
  const del = async (id: string) => {
    if (!confirm("حذف الجلسة؟")) return;
    const r = await supabase.from("hr_training_sessions").delete().eq("id", id);
    if (r.error) toast.error(r.error.message); else fetchData();
  };

  const openAttendees = async (session: any) => {
    setAttSession(session);
    const { data } = await supabase.from("hr_training_attendees").select("*").eq("session_id", session.id);
    setAttendees(data || []);
    setAttOpen(true);
  };

  const toggleAttendee = async (employee_id: string) => {
    const existing = attendees.find(a => a.employee_id === employee_id);
    if (existing) {
      await supabase.from("hr_training_attendees").delete().eq("id", existing.id);
    } else {
      await supabase.from("hr_training_attendees").insert({ session_id: attSession.id, employee_id });
    }
    const { data } = await supabase.from("hr_training_attendees").select("*").eq("session_id", attSession.id);
    setAttendees(data || []);
  };

  const updateAttendeeStatus = async (id: string, attendance_status: string) => {
    await supabase.from("hr_training_attendees").update({ attendance_status }).eq("id", id);
    const { data } = await supabase.from("hr_training_attendees").select("*").eq("session_id", attSession.id);
    setAttendees(data || []);
  };

  const filtered = data.filter(r => {
    const p = programs.find(x => x.id === r.program_id);
    return (p?.program_name + " " + r.session_code).toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div>
      <ListPageHeader
        title="جلسات التدريب"
        breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "الموارد البشرية", href: "/hr" }, { label: "جلسات التدريب" }]}
        onAdd={() => { setEditing(null); setForm(empty); setOpen(true); }}
        onRefresh={fetchData}
        searchValue={search}
        onSearchChange={setSearch}
        addLabel="جلسة جديدة"
      />
      <div className="bg-card border border-t-0 rounded-b-lg p-4">
        {loading ? <Loader2 className="animate-spin mx-auto" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الكود</TableHead>
                <TableHead>البرنامج</TableHead>
                <TableHead>من</TableHead>
                <TableHead>إلى</TableHead>
                <TableHead>المكان</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => {
                const p = programs.find(x => x.id === r.program_id);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">{r.session_code || "-"}</TableCell>
                    <TableCell className="font-medium">{p?.program_name || "-"}</TableCell>
                    <TableCell>{format(new Date(r.start_date), "yyyy/MM/dd")}</TableCell>
                    <TableCell>{format(new Date(r.end_date), "yyyy/MM/dd")}</TableCell>
                    <TableCell>{r.location || "-"}</TableCell>
                    <TableCell><Badge variant={STATUS[r.status]?.variant}>{STATUS[r.status]?.label || r.status}</Badge></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openAttendees(r)} title="المتدربون"><Users className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(r); setForm({ ...empty, ...r, branch_id: r.branch_id || "" }); setOpen(true); }}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">لا توجد جلسات</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" />{editing ? "تعديل جلسة" : "جلسة تدريب جديدة"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>البرنامج *</Label>
              <Select value={form.program_id} onValueChange={v => setForm({ ...form, program_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                <SelectContent>{programs.map(p => <SelectItem key={p.id} value={p.id}>{p.program_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>كود الجلسة</Label><Input value={form.session_code} onChange={e => setForm({ ...form, session_code: e.target.value })} className="font-mono" /></div>
            <div>
              <Label>الحالة</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>من *</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><Label>إلى *</Label><Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
            <div><Label>المكان</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
            <div>
              <Label>الفرع</Label>
              <Select value={form.branch_id || "none"} onValueChange={v => setForm({ ...form, branch_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">بدون</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>ملاحظات</Label><Textarea rows={2} value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={save}>حفظ</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={attOpen} onOpenChange={setAttOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>المتدربون</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {emps.map(e => {
              const att = attendees.find(a => a.employee_id === e.id);
              return (
                <div key={e.id} className="flex items-center gap-2 p-2 border rounded-md">
                  <Checkbox checked={!!att} onCheckedChange={() => toggleAttendee(e.id)} />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{e.full_name}</div>
                    <div className="text-xs text-muted-foreground">{e.employee_number}</div>
                  </div>
                  {att && (
                    <Select value={att.attendance_status} onValueChange={v => updateAttendeeStatus(att.id, v)}>
                      <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="enrolled">مسجَّل</SelectItem>
                        <SelectItem value="attended">حاضر</SelectItem>
                        <SelectItem value="absent">غائب</SelectItem>
                        <SelectItem value="completed">مكتمل</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
