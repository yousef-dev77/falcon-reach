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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Shield, Trash2, Lock } from "lucide-react";
import { PermissionMatrix } from "@/components/settings/PermissionMatrix";
import { toast } from "@/hooks/use-toast";

interface UserType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
}

export default function UserTypes() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [permOpen, setPermOpen] = useState(false);
  const [current, setCurrent] = useState<UserType | null>(null);
  const [form, setForm] = useState({ code: "", name: "", description: "" });

  const { data: types = [], isLoading } = useQuery({
    queryKey: ["user-types"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("user_types")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data as UserType[];
    },
  });

  const { data: counts = {} } = useQuery({
    queryKey: ["user-type-counts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("profiles").select("user_type_id");
      if (error) throw error;
      return (data || []).reduce((acc: Record<string, number>, p: any) => {
        if (p.user_type_id) acc[p.user_type_id] = (acc[p.user_type_id] || 0) + 1;
        return acc;
      }, {});
    },
  });

  const openAdd = () => {
    setCurrent(null);
    setForm({ code: "", name: "", description: "" });
    setFormOpen(true);
  };

  const openEdit = (t: UserType) => {
    setCurrent(t);
    setForm({ code: t.code, name: t.name, description: t.description || "" });
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast({ title: "بيانات ناقصة", description: "الرمز والاسم مطلوبان", variant: "destructive" });
      return;
    }
    const payload = { code: form.code.trim(), name: form.name.trim(), description: form.description || null };
    const { error } = current
      ? await (supabase as any).from("user_types").update(payload).eq("id", current.id)
      : await (supabase as any).from("user_types").insert(payload);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["user-types"] });
    setFormOpen(false);
    toast({ title: "تم الحفظ" });
  };

  const remove = async (t: UserType) => {
    if (t.is_system) {
      toast({ title: "غير مسموح", description: "لا يمكن حذف نوع نظامي", variant: "destructive" });
      return;
    }
    const { error } = await (supabase as any).from("user_types").delete().eq("id", t.id);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["user-types"] });
    toast({ title: "تم الحذف" });
  };

  return (
    <div className="space-y-4">
      <ListPageHeader
        title="أنواع المستخدمين"
        subtitle="قوالب صلاحيات جاهزة تُطبَّق على كل مستخدم حسب نوعه"
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "الإعدادات" },
          { label: "أنواع المستخدمين" },
        ]}
        onAdd={openAdd}
        addLabel="نوع مستخدم جديد"
        showSearch={false}
      />

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>النوع</TableHead>
                <TableHead>الرمز</TableHead>
                <TableHead>الوصف</TableHead>
                <TableHead>عدد المستخدمين</TableHead>
                <TableHead className="text-start">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5}>جاري التحميل...</TableCell></TableRow>
              ) : types.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {t.name}
                      {t.is_system && <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" />نظامي</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{t.code}</TableCell>
                  <TableCell className="text-muted-foreground">{t.description}</TableCell>
                  <TableCell><Badge variant="secondary">{counts[t.id] || 0}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => { setCurrent(t); setPermOpen(true); }}>
                        <Shield className="h-4 w-4" /> الصلاحيات
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(t)}><Edit className="h-4 w-4" /></Button>
                      {!t.is_system && (
                        <Button variant="ghost" size="sm" onClick={() => remove(t)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      )}
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
          <DialogHeader><DialogTitle>{current ? "تعديل نوع مستخدم" : "نوع مستخدم جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>الرمز</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={current?.is_system} />
            </div>
            <div className="space-y-2">
              <Label>الاسم</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>الوصف</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>إلغاء</Button>
            <Button onClick={save}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={permOpen} onOpenChange={setPermOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader><DialogTitle>صلاحيات النوع: {current?.name}</DialogTitle></DialogHeader>
          {current && <PermissionMatrix subjectType="user_type" subjectId={current.id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
