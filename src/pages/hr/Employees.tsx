import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Edit, Trash2, Loader2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ListPageHeader } from "@/components/ListPageHeader";
import { useNavigate } from "react-router-dom";

type Employee = any;

export default function Employees() {
  const navigate = useNavigate();
  const [data, setData] = useState<Employee[]>([]);
  const [depts, setDepts] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [search, setSearch] = useState("");
  const empty = { employee_number: "", full_name: "", full_name_en: "", national_id: "", nationality: "SA", gender: "male", date_of_birth: "", phone: "", email: "", address: "", hire_date: new Date().toISOString().slice(0, 10), contract_type: "permanent", contract_end_date: "", branch_id: "", department_id: "", job_title_id: "", basic_salary: 0, bank_name: "", bank_iban: "", gosi_number: "", is_subject_to_gosi: true, is_active: true, user_id: "" };
  const [form, setForm] = useState<any>(empty);

  const fetchData = async () => {
    setLoading(true);
    const [e, d, j, b, u] = await Promise.all([
      supabase.from("hr_employees").select("*").order("employee_number"),
      supabase.from("hr_departments").select("id, name").eq("is_active", true),
      supabase.from("hr_job_titles").select("id, name").eq("is_active", true),
      supabase.from("branches").select("id, name").eq("is_active", true),
      supabase.from("profiles").select("id, full_name, email"),
    ]);
    if (e.data) setData(e.data); if (d.data) setDepts(d.data); if (j.data) setJobs(j.data); if (b.data) setBranches(b.data); if (u.data) setUsers(u.data);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const openAdd = async () => {
    setEditing(null);
    // auto-generate employee number
    const { count } = await supabase.from("hr_employees").select("id", { count: "exact", head: true });
    setForm({ ...empty, employee_number: `EMP-${String((count || 0) + 1).padStart(4, "0")}` });
    setOpen(true);
  };
  const openEdit = (r: Employee) => {
    setEditing(r);
    setForm({ ...empty, ...r, date_of_birth: r.date_of_birth || "", contract_end_date: r.contract_end_date || "" });
    setOpen(true);
  };

  const save = async () => {
    if (!form.full_name || !form.hire_date) return toast.error("الاسم وتاريخ التعيين مطلوبان");
    const payload: any = { ...form };
    ["branch_id", "department_id", "job_title_id", "user_id"].forEach(k => { if (!payload[k]) payload[k] = null; });
    ["date_of_birth", "contract_end_date"].forEach(k => { if (!payload[k]) payload[k] = null; });
    payload.basic_salary = Number(payload.basic_salary) || 0;
    delete payload.id; delete payload.created_at; delete payload.updated_at; delete payload.created_by;
    const res = editing ? await supabase.from("hr_employees").update(payload).eq("id", editing.id) : await supabase.from("hr_employees").insert(payload);
    if (res.error) toast.error(res.error.message); else { toast.success("تم الحفظ"); setOpen(false); fetchData(); }
  };

  const del = async (id: string) => { if (!confirm("حذف الموظف؟")) return; const r = await supabase.from("hr_employees").delete().eq("id", id); if (r.error) toast.error(r.error.message); else fetchData(); };

  const filtered = data.filter(r => r.full_name?.toLowerCase().includes(search.toLowerCase()) || r.employee_number?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <ListPageHeader title="الموظفين" breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "الموارد البشرية", href: "/hr" }, { label: "الموظفين" }]} onAdd={openAdd} onRefresh={fetchData} searchValue={search} onSearchChange={setSearch} addLabel="إضافة موظف" />
      <div className="bg-card border border-t-0 rounded-b-lg p-4">
        {loading ? <Loader2 className="animate-spin mx-auto" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>الرقم</TableHead><TableHead>الاسم</TableHead><TableHead>الجنسية</TableHead><TableHead>القسم</TableHead><TableHead>الوظيفة</TableHead><TableHead>الراتب الأساسي</TableHead><TableHead>الحالة</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.employee_number}</TableCell>
                  <TableCell className="font-medium">{r.full_name}</TableCell>
                  <TableCell>{r.nationality}</TableCell>
                  <TableCell>{depts.find(d => d.id === r.department_id)?.name || "-"}</TableCell>
                  <TableCell>{jobs.find(j => j.id === r.job_title_id)?.name || "-"}</TableCell>
                  <TableCell>{Number(r.basic_salary).toLocaleString()} ر.س</TableCell>
                  <TableCell><Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "نشط" : "موقوف"}</Badge></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => navigate(`/hr/employees/${r.id}`)} title="عرض الملف"><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">لا يوجد موظفين</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "تعديل موظف" : "إضافة موظف"}</DialogTitle></DialogHeader>
          <Tabs defaultValue="personal">
            <TabsList className="grid grid-cols-4">
              <TabsTrigger value="personal">شخصي</TabsTrigger>
              <TabsTrigger value="contract">العقد</TabsTrigger>
              <TabsTrigger value="salary">الراتب</TabsTrigger>
              <TabsTrigger value="bank">البنك</TabsTrigger>
            </TabsList>
            <TabsContent value="personal" className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>رقم الموظف *</Label><Input value={form.employee_number} onChange={e => setForm({ ...form, employee_number: e.target.value })} /></div>
                <div><Label>الاسم الكامل *</Label><Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
                <div><Label>Full Name (EN)</Label><Input value={form.full_name_en} onChange={e => setForm({ ...form, full_name_en: e.target.value })} /></div>
                <div><Label>الهوية / الإقامة</Label><Input value={form.national_id} onChange={e => setForm({ ...form, national_id: e.target.value })} /></div>
                <div><Label>الجنسية</Label><Input value={form.nationality} onChange={e => setForm({ ...form, nationality: e.target.value })} /></div>
                <div><Label>الجنس</Label>
                  <Select value={form.gender} onValueChange={v => setForm({ ...form, gender: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="male">ذكر</SelectItem><SelectItem value="female">أنثى</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>تاريخ الميلاد</Label><Input type="date" value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} /></div>
                <div><Label>الجوال</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                <div className="col-span-2"><Label>البريد</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                <div className="col-span-2"><Label>العنوان</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
              </div>
            </TabsContent>
            <TabsContent value="contract" className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>تاريخ التعيين *</Label><Input type="date" value={form.hire_date} onChange={e => setForm({ ...form, hire_date: e.target.value })} /></div>
                <div><Label>نوع العقد</Label>
                  <Select value={form.contract_type} onValueChange={v => setForm({ ...form, contract_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="permanent">دائم</SelectItem>
                      <SelectItem value="temporary">مؤقت</SelectItem>
                      <SelectItem value="part_time">دوام جزئي</SelectItem>
                      <SelectItem value="contractor">متعاقد</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>تاريخ انتهاء العقد</Label><Input type="date" value={form.contract_end_date} onChange={e => setForm({ ...form, contract_end_date: e.target.value })} /></div>
                <div><Label>الفرع</Label>
                  <Select value={form.branch_id || "none"} onValueChange={v => setForm({ ...form, branch_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="none">بدون</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>القسم</Label>
                  <Select value={form.department_id || "none"} onValueChange={v => setForm({ ...form, department_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="none">بدون</SelectItem>{depts.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>المسمى الوظيفي</Label>
                  <Select value={form.job_title_id || "none"} onValueChange={v => setForm({ ...form, job_title_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="none">بدون</SelectItem>{jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label>ربط بحساب المستخدم (لتفعيل بوابتي)</Label>
                  <Select value={form.user_id || "none"} onValueChange={v => setForm({ ...form, user_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="بدون ربط" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون ربط</SelectItem>
                      {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name} ({u.email})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">اربط الموظف بحساب مستخدم ليتمكن من الوصول إلى "بوابتي" وتقديم طلبات الإجازات.</p>
                </div>
                <div className="col-span-2 flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} /><Label>نشط</Label></div>
              </div>
            </TabsContent>
            <TabsContent value="salary" className="space-y-3">
              <div><Label>الراتب الأساسي (ر.س)</Label><Input type="number" value={form.basic_salary} onChange={e => setForm({ ...form, basic_salary: e.target.value })} /></div>
              <div className="flex items-center gap-2"><Switch checked={form.is_subject_to_gosi} onCheckedChange={v => setForm({ ...form, is_subject_to_gosi: v })} /><Label>خاضع للتأمينات الاجتماعية (GOSI)</Label></div>
              <div><Label>رقم التأمينات</Label><Input value={form.gosi_number} onChange={e => setForm({ ...form, gosi_number: e.target.value })} /></div>
              <p className="text-xs text-muted-foreground">يمكن إضافة البدلات والخصومات لاحقاً من شاشة "هيكل الرواتب"</p>
            </TabsContent>
            <TabsContent value="bank" className="space-y-3">
              <div><Label>اسم البنك</Label><Input value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} /></div>
              <div><Label>الآيبان IBAN</Label><Input value={form.bank_iban} onChange={e => setForm({ ...form, bank_iban: e.target.value })} className="font-mono" /></div>
            </TabsContent>
          </Tabs>
          <div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={save}>حفظ</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
