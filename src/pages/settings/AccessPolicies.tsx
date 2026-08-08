import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ListPageHeader } from "@/components/ListPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, ShieldAlert, Link2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const ACTIONS = [
  { value: "view", label: "عرض" },
  { value: "create", label: "إضافة" },
  { value: "edit", label: "تعديل" },
  { value: "delete", label: "حذف" },
  { value: "approve", label: "اعتماد" },
  { value: "post", label: "ترحيل" },
  { value: "export", label: "تصدير" },
];

const RELATIONS = [
  { value: "owner", label: "مالك السجل" },
  { value: "manager", label: "مدير مباشر" },
  { value: "department_manager", label: "مدير القسم" },
  { value: "branch_manager", label: "مدير الفرع" },
  { value: "reviewer", label: "مراجع" },
  { value: "watcher", label: "مشاهد" },
];

const RESOURCE_TYPES = [
  { value: "branch", label: "فرع" },
  { value: "department", label: "قسم" },
  { value: "employee", label: "موظف" },
  { value: "warehouse", label: "مستودع" },
  { value: "cost_center", label: "مركز تكلفة" },
];

export default function AccessPolicies() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [relOpen, setRelOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    subject_type: "user_type",
    subject_id: "",
    screen_id: "all",
    action: "view",
    relation: "owner",
    effect: "allow",
    priority: 100,
  });
  const [relForm, setRelForm] = useState({ user_id: "", relation: "owner", resource_type: "branch", resource_id: "" });

  const { data: policies = [] } = useQuery({
    queryKey: ["access-policies"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("access_policies").select("*").order("priority");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: relations = [] } = useQuery({
    queryKey: ["resource-relations"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("resource_relations").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: screens = [] } = useQuery({
    queryKey: ["app-screens"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("app_screens").select("id, name, module").order("module");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: types = [] } = useQuery({
    queryKey: ["user-types"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("user_types").select("id, name").order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["user-groups"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("user_groups").select("id, name").order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-simple"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name").order("full_name");
      if (error) throw error;
      return data as any[];
    },
  });

  const subjectOptions =
    form.subject_type === "user_type" ? types : form.subject_type === "group" ? groups : profiles.map((p) => ({ id: p.id, name: p.full_name }));

  const subjectLabel = (p: any) => {
    const list = p.subject_type === "user_type" ? types : p.subject_type === "group" ? groups : profiles.map((x: any) => ({ id: x.id, name: x.full_name }));
    return list.find((s: any) => s.id === p.subject_id)?.name || "-";
  };

  const savePolicy = async () => {
    if (!form.name.trim() || !form.subject_id) {
      toast({ title: "بيانات ناقصة", description: "الاسم والجهة المستهدفة مطلوبان", variant: "destructive" });
      return;
    }
    const { error } = await (supabase as any).from("access_policies").insert({
      name: form.name.trim(),
      description: form.description || null,
      subject_type: form.subject_type,
      subject_id: form.subject_id,
      screen_id: form.screen_id === "all" ? null : form.screen_id,
      action: form.action,
      relation: form.effect === "allow" ? form.relation : null,
      effect: form.effect,
      priority: Number(form.priority) || 100,
    });
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["access-policies"] });
    setOpen(false);
    toast({ title: "تم إنشاء السياسة" });
  };

  const togglePolicy = async (id: string, is_active: boolean) => {
    await (supabase as any).from("access_policies").update({ is_active }).eq("id", id);
    await queryClient.invalidateQueries({ queryKey: ["access-policies"] });
  };

  const removePolicy = async (id: string) => {
    await (supabase as any).from("access_policies").delete().eq("id", id);
    await queryClient.invalidateQueries({ queryKey: ["access-policies"] });
  };

  const saveRelation = async () => {
    if (!relForm.user_id || !relForm.resource_id.trim()) {
      toast({ title: "بيانات ناقصة", description: "المستخدم ومعرّف السجل مطلوبان", variant: "destructive" });
      return;
    }
    const { error } = await (supabase as any).from("resource_relations").insert(relForm);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["resource-relations"] });
    setRelOpen(false);
    toast({ title: "تم ربط العلاقة" });
  };

  const removeRelation = async (id: string) => {
    await (supabase as any).from("resource_relations").delete().eq("id", id);
    await queryClient.invalidateQueries({ queryKey: ["resource-relations"] });
  };

  return (
    <div className="space-y-4">
      <ListPageHeader
        title="سياسات الوصول (RBAC + ReBAC)"
        subtitle="سياسات سماح/منع حسب الدور أو العلاقة بالسجل — سياسات المنع لها الأولوية دائماً"
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "الإعدادات" },
          { label: "سياسات الوصول" },
        ]}
        showSearch={false}
      />

      <Tabs defaultValue="policies">
        <TabsList>
          <TabsTrigger value="policies">السياسات</TabsTrigger>
          <TabsTrigger value="relations">علاقات السجلات</TabsTrigger>
        </TabsList>

        <TabsContent value="policies" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" /> السياسات ({policies.length})</CardTitle>
              <Button onClick={() => setOpen(true)}>سياسة جديدة</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>السياسة</TableHead>
                    <TableHead>الجهة</TableHead>
                    <TableHead>الشاشة</TableHead>
                    <TableHead>الإجراء</TableHead>
                    <TableHead>العلاقة</TableHead>
                    <TableHead>الأثر</TableHead>
                    <TableHead>الأولوية</TableHead>
                    <TableHead>مفعّلة</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">لا توجد سياسات — الصلاحيات تُطبَّق من الأنواع والمجموعات</TableCell></TableRow>
                  ) : policies.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{subjectLabel(p)}</TableCell>
                      <TableCell>{p.screen_id ? screens.find((s) => s.id === p.screen_id)?.name : <Badge variant="outline">كل الشاشات</Badge>}</TableCell>
                      <TableCell>{ACTIONS.find((a) => a.value === p.action)?.label}</TableCell>
                      <TableCell>{p.relation ? RELATIONS.find((r) => r.value === p.relation)?.label || p.relation : "-"}</TableCell>
                      <TableCell>
                        <Badge className={p.effect === "deny" ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}>
                          {p.effect === "deny" ? "منع" : "سماح"}
                        </Badge>
                      </TableCell>
                      <TableCell>{p.priority}</TableCell>
                      <TableCell><Switch checked={p.is_active} onCheckedChange={(v) => togglePolicy(p.id, v)} /></TableCell>
                      <TableCell><Button variant="ghost" size="sm" onClick={() => removePolicy(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="relations" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5" /> علاقات المستخدمين بالسجلات ({relations.length})</CardTitle>
              <Button onClick={() => setRelOpen(true)}>علاقة جديدة</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المستخدم</TableHead>
                    <TableHead>العلاقة</TableHead>
                    <TableHead>نوع السجل</TableHead>
                    <TableHead>معرّف السجل</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {relations.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا توجد علاقات مسجلة</TableCell></TableRow>
                  ) : relations.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{profiles.find((p) => p.id === r.user_id)?.full_name || r.user_id}</TableCell>
                      <TableCell>{RELATIONS.find((x) => x.value === r.relation)?.label || r.relation}</TableCell>
                      <TableCell>{RESOURCE_TYPES.find((x) => x.value === r.resource_type)?.label || r.resource_type}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.resource_id}</TableCell>
                      <TableCell><Button variant="ghost" size="sm" onClick={() => removeRelation(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>سياسة وصول جديدة</DialogTitle></DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2"><Label>اسم السياسة</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>نوع الجهة</Label>
              <Select value={form.subject_type} onValueChange={(v) => setForm({ ...form, subject_type: v, subject_id: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user_type">نوع مستخدم</SelectItem>
                  <SelectItem value="group">مجموعة</SelectItem>
                  <SelectItem value="user">مستخدم</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>الجهة</Label>
              <Select value={form.subject_id} onValueChange={(v) => setForm({ ...form, subject_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                <SelectContent>
                  {subjectOptions.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>الشاشة</Label>
              <Select value={form.screen_id} onValueChange={(v) => setForm({ ...form, screen_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الشاشات</SelectItem>
                  {screens.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>الإجراء</Label>
              <Select value={form.action} onValueChange={(v) => setForm({ ...form, action: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ACTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>الأثر</Label>
              <Select value={form.effect} onValueChange={(v) => setForm({ ...form, effect: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="allow">سماح (حسب العلاقة)</SelectItem>
                  <SelectItem value="deny">منع (له الأولوية)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.effect === "allow" && (
              <div className="space-y-2"><Label>العلاقة المطلوبة</Label>
                <Select value={form.relation} onValueChange={(v) => setForm({ ...form, relation: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{RELATIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2"><Label>الأولوية</Label>
              <Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} /></div>
            <div className="space-y-2 md:col-span-2"><Label>الوصف</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={savePolicy}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={relOpen} onOpenChange={setRelOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>ربط علاقة بسجل</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>المستخدم</Label>
              <Select value={relForm.user_id} onValueChange={(v) => setRelForm({ ...relForm, user_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر مستخدم" /></SelectTrigger>
                <SelectContent>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>العلاقة</Label>
              <Select value={relForm.relation} onValueChange={(v) => setRelForm({ ...relForm, relation: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RELATIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>نوع السجل</Label>
              <Select value={relForm.resource_type} onValueChange={(v) => setRelForm({ ...relForm, resource_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RESOURCE_TYPES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>معرّف السجل (UUID)</Label>
              <Input value={relForm.resource_id} onChange={(e) => setRelForm({ ...relForm, resource_id: e.target.value })} dir="ltr" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRelOpen(false)}>إلغاء</Button>
            <Button onClick={saveRelation}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
