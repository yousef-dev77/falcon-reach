import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Loader2, FileSignature, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ListPageHeader } from "@/components/ListPageHeader";
import { format, differenceInDays } from "date-fns";

const TYPES: Record<string, string> = {
  definite: "محدد المدة",
  indefinite: "غير محدد المدة",
  probation: "تحت التجربة",
  part_time: "دوام جزئي",
};
const STATUS: Record<string, { label: string; variant: any }> = {
  draft: { label: "مسودة", variant: "secondary" },
  active: { label: "ساري", variant: "default" },
  expired: { label: "منتهي", variant: "destructive" },
  terminated: { label: "مُنهَى", variant: "destructive" },
  renewed: { label: "مُجدَّد", variant: "outline" },
};

export default function Contracts() {
  const [data, setData] = useState<any[]>([]);
  const [emps, setEmps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState("");
  const empty = {
    contract_number: "",
    employee_id: "",
    contract_type: "indefinite",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: "",
    basic_salary: 0,
    housing_allowance: 0,
    transportation_allowance: 0,
    other_allowances: 0,
    working_hours_per_week: 48,
    annual_leave_days: 21,
    probation_months: 3,
    status: "draft",
    terms: "",
    signed_date: "",
  };
  const [form, setForm] = useState<any>(empty);

  const fetchData = async () => {
    setLoading(true);
    const [c, e] = await Promise.all([
      supabase.from("hr_contracts").select("*").order("created_at", { ascending: false }),
      supabase.from("hr_employees").select("id, full_name, employee_number").eq("is_active", true).order("full_name"),
    ]);
    if (c.data) setData(c.data);
    if (e.data) setEmps(e.data);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const openAdd = async () => {
    setEditing(null);
    const { data: num } = await supabase.rpc("next_contract_number");
    setForm({ ...empty, contract_number: num || "" });
    setOpen(true);
  };
  const openEdit = (r: any) => {
    setEditing(r);
    setForm({ ...empty, ...r, end_date: r.end_date || "", signed_date: r.signed_date || "" });
    setOpen(true);
  };
  const save = async () => {
    if (!form.employee_id || !form.contract_number || !form.start_date) {
      return toast.error("الموظف ورقم العقد وتاريخ البداية مطلوبة");
    }
    const payload: any = { ...form };
    ["end_date", "signed_date"].forEach(k => { if (!payload[k]) payload[k] = null; });
    ["basic_salary", "housing_allowance", "transportation_allowance", "other_allowances", "working_hours_per_week", "annual_leave_days", "probation_months"]
      .forEach(k => { payload[k] = Number(payload[k]) || 0; });
    delete payload.id; delete payload.created_at; delete payload.updated_at; delete payload.created_by;
    const res = editing
      ? await supabase.from("hr_contracts").update(payload).eq("id", editing.id)
      : await supabase.from("hr_contracts").insert(payload);
    if (res.error) toast.error(res.error.message);
    else { toast.success("تم الحفظ"); setOpen(false); fetchData(); }
  };
  const del = async (id: string) => {
    if (!confirm("حذف العقد؟")) return;
    const r = await supabase.from("hr_contracts").delete().eq("id", id);
    if (r.error) toast.error(r.error.message); else fetchData();
  };

  const filtered = data.filter(r => {
    const emp = emps.find(e => e.id === r.employee_id);
    const text = `${r.contract_number} ${emp?.full_name || ""}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });

  const expiringBadge = (end?: string, status?: string) => {
    if (!end || status !== "active") return null;
    const days = differenceInDays(new Date(end), new Date());
    if (days < 0) return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />منتهي</Badge>;
    if (days <= 30) return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />ينتهي خلال {days} يوم</Badge>;
    if (days <= 60) return <Badge variant="outline" className="gap-1 border-amber-500 text-amber-700">{days} يوم متبقية</Badge>;
    return null;
  };

  return (
    <div>
      <ListPageHeader
        title="عقود الموظفين"
        breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "الموارد البشرية", href: "/hr" }, { label: "العقود" }]}
        onAdd={openAdd}
        onRefresh={fetchData}
        searchValue={search}
        onSearchChange={setSearch}
        addLabel="عقد جديد"
      />
      <div className="bg-card border border-t-0 rounded-b-lg p-4">
        {loading ? <Loader2 className="animate-spin mx-auto" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم العقد</TableHead>
                <TableHead>الموظف</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>البداية</TableHead>
                <TableHead>النهاية</TableHead>
                <TableHead>الراتب الأساسي</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>تنبيه</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => {
                const emp = emps.find(e => e.id === r.employee_id);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">{r.contract_number}</TableCell>
                    <TableCell className="font-medium">{emp?.full_name || "-"}</TableCell>
                    <TableCell>{TYPES[r.contract_type] || r.contract_type}</TableCell>
                    <TableCell>{format(new Date(r.start_date), "yyyy/MM/dd")}</TableCell>
                    <TableCell>{r.end_date ? format(new Date(r.end_date), "yyyy/MM/dd") : "—"}</TableCell>
                    <TableCell>{Number(r.basic_salary).toLocaleString()} ر.س</TableCell>
                    <TableCell><Badge variant={STATUS[r.status]?.variant}>{STATUS[r.status]?.label || r.status}</Badge></TableCell>
                    <TableCell>{expiringBadge(r.end_date, r.status)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">لا توجد عقود</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileSignature className="h-5 w-5" />{editing ? "تعديل عقد" : "عقد جديد"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>رقم العقد *</Label><Input value={form.contract_number} onChange={e => setForm({ ...form, contract_number: e.target.value })} className="font-mono" /></div>
            <div>
              <Label>الموظف *</Label>
              <Select value={form.employee_id || ""} onValueChange={v => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                <SelectContent>{emps.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name} ({e.employee_number})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>نوع العقد</Label>
              <Select value={form.contract_type} onValueChange={v => setForm({ ...form, contract_type: v })}>
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
            <div><Label>تاريخ النهاية</Label><Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
            <div><Label>الراتب الأساسي</Label><Input type="number" value={form.basic_salary} onChange={e => setForm({ ...form, basic_salary: e.target.value })} /></div>
            <div><Label>بدل سكن</Label><Input type="number" value={form.housing_allowance} onChange={e => setForm({ ...form, housing_allowance: e.target.value })} /></div>
            <div><Label>بدل مواصلات</Label><Input type="number" value={form.transportation_allowance} onChange={e => setForm({ ...form, transportation_allowance: e.target.value })} /></div>
            <div><Label>بدلات أخرى</Label><Input type="number" value={form.other_allowances} onChange={e => setForm({ ...form, other_allowances: e.target.value })} /></div>
            <div><Label>ساعات العمل/أسبوع</Label><Input type="number" value={form.working_hours_per_week} onChange={e => setForm({ ...form, working_hours_per_week: e.target.value })} /></div>
            <div><Label>أيام الإجازة السنوية</Label><Input type="number" value={form.annual_leave_days} onChange={e => setForm({ ...form, annual_leave_days: e.target.value })} /></div>
            <div><Label>أشهر التجربة</Label><Input type="number" value={form.probation_months} onChange={e => setForm({ ...form, probation_months: e.target.value })} /></div>
            <div><Label>تاريخ التوقيع</Label><Input type="date" value={form.signed_date} onChange={e => setForm({ ...form, signed_date: e.target.value })} /></div>
            <div className="col-span-2"><Label>شروط وملاحظات العقد</Label><Textarea rows={3} value={form.terms} onChange={e => setForm({ ...form, terms: e.target.value })} /></div>
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
