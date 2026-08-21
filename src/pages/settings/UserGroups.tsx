import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ListPageHeader } from "@/components/ListPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Shield, Trash2, Users } from "lucide-react";
import { PermissionMatrix } from "@/components/settings/PermissionMatrix";
import { toast } from "@/hooks/use-toast";

interface Group {
  id: string;
  code: string;
  name: string;
  description: string | null;
  branch_id: string | null;
}

export default function UserGroups() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [permOpen, setPermOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [current, setCurrent] = useState<Group | null>(null);
  const [form, setForm] = useState({ code: "", name: "", description: "", branch_id: "all" });

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["user-groups"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("user_groups").select("*").order("created_at");
      if (error) throw error;
      return data as Group[];
    },
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["user-group-members"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("user_group_members").select("*");
      if (error) throw error;
      return data as { id: string; user_id: string; group_id: string }[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-simple"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
      if (error) throw error;
      return data as { id: string; full_name: string; email: string }[];
    },
  });

  const openAdd = () => {
    setCurrent(null);
    setForm({ code: "", name: "", description: "", branch_id: "all" });
    setFormOpen(true);
  };

  const openEdit = (g: Group) => {
    setCurrent(g);
    setForm({ code: g.code, name: g.name, description: g.description || "", branch_id: g.branch_id || "all" });
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast({ title: "بيانات ناقصة", description: "الرمز والاسم مطلوبان", variant: "destructive" });
      return;
    }
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      description: form.description || null,
      branch_id: form.branch_id === "all" ? null : form.branch_id,
    };
    const { error } = current
      ? await (supabase as any).from("user_groups").update(payload).eq("id", current.id)
      : await (supabase as any).from("user_groups").insert(payload);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["user-groups"] });
    setFormOpen(false);
    toast({ title: "تم الحفظ" });
  };

  const remove = async (g: Group) => {
    const { error } = await (supabase as any).from("user_groups").delete().eq("id", g.id);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["user-groups"] });
    toast({ title: "تم الحذف" });
  };

  const toggleMember = async (userId: string) => {
    if (!current) return;
    const existing = members.find((m) => m.group_id === current.id && m.user_id === userId);
    const { error } = existing
      ? await (supabase as any).from("user_group_members").delete().eq("id", existing.id)
      : await (supabase as any).from("user_group_members").insert({ group_id: current.id, user_id: userId });
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["user-group-members"] });
  };

  const memberCount = (groupId: string) => members.filter((m) => m.group_id === groupId).length;

  return (
    <div className="space-y-4">
      <ListPageHeader
        title="مجموعات الصلاحيات"
        subtitle="صلاحيات إضافية مشتركة لمستخدمين من أنواع مختلفة؛ لا تستبدل النوع الأساسي"
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "الإعدادات" },
          { label: "مجموعات الصلاحيات" },
        ]}
        onAdd={openAdd}
        addLabel="مجموعة جديدة"
        showSearch={false}
      />

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المجموعة</TableHead>
                <TableHead>الرمز</TableHead>
                <TableHead>الفرع</TableHead>
                <TableHead>الأعضاء</TableHead>
                <TableHead className="text-start">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5}>جاري التحميل...</TableCell></TableRow>
              ) : groups.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا توجد مجموعات بعد</TableCell></TableRow>
              ) : groups.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">{g.name}</TableCell>
                  <TableCell className="text-muted-foreground">{g.code}</TableCell>
                  <TableCell>
                    {g.branch_id ? (branches.find((b: any) => b.id === g.branch_id)?.name || "-") : <Badge variant="outline">جميع الفروع</Badge>}
                  </TableCell>
                  <TableCell><Badge variant="secondary">{memberCount(g.id)}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => { setCurrent(g); setPermOpen(true); }}>
                        <Shield className="h-4 w-4" /> الصلاحيات
                      </Button>
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => { setCurrent(g); setMembersOpen(true); }}>
                        <Users className="h-4 w-4" /> الأعضاء
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(g)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => remove(g)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{current ? "تعديل مجموعة" : "مجموعة جديدة"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>الرمز</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            <div className="space-y-2"><Label>الاسم</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>الفرع</Label>
              <Select value={form.branch_id} onValueChange={(v) => setForm({ ...form, branch_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الفروع</SelectItem>
                  {branches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>الوصف</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>إلغاء</Button>
            <Button onClick={save}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={permOpen} onOpenChange={setPermOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader><DialogTitle>صلاحيات المجموعة: {current?.name}</DialogTitle></DialogHeader>
          {current && <PermissionMatrix subjectType="group" subjectId={current.id} />}
        </DialogContent>
      </Dialog>

      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>أعضاء المجموعة: {current?.name}</DialogTitle></DialogHeader>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto">
            {profiles.map((p) => {
              const checked = !!members.find((m) => m.group_id === current?.id && m.user_id === p.id);
              return (
                <label key={p.id} className="flex items-center gap-3 rounded-[10px] border p-3 cursor-pointer hover:bg-muted/40">
                  <Checkbox checked={checked} onCheckedChange={() => toggleMember(p.id)} />
                  <div>
                    <div className="font-medium">{p.full_name}</div>
                    <div className="text-sm text-muted-foreground">{p.email}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
