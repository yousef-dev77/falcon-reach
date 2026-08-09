import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, AlertCircle, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "react-router-dom";

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: any;
  isBranchManager?: boolean;
  allowedBranchIds?: string[];
}

const roleLabels: Record<string, string> = {
  admin: "مدير النظام",
  branch_manager: "مدير الفرع",
  hr_manager: "مدير الموارد البشرية",
  employee_self_service: "بوابة الموظف فقط",
  accountant: "محاسب",
  sales_manager: "مدير مبيعات",
  inventory_manager: "مدير مخزون",
  cashier: "كاشير POS",
  user: "مستخدم",
};

const getInitialFormData = (user?: any) => ({
  full_name: user?.full_name || "",
  email: user?.email || "",
  phone: user?.phone || "",
  password: "",
  role: user?.user_roles?.[0]?.role || "user",
  is_global: user?.user_roles?.[0]?.is_global || false,
  user_type_id: user?.user_type_id || "",
  selectedGroups: [] as string[],
  selectedBranches: user?.user_branch_assignments?.map((b: any) => b.branch_id) || [],
  primaryBranchId:
    user?.user_branch_assignments?.find((b: any) => b.is_primary)?.branch_id || "",
  pin: "",
  can_override_pos: user?.can_override_pos || false,
  is_pos_active: user?.is_pos_active ?? true,
});

export function UserFormDialog({
  open,
  onOpenChange,
  user,
  isBranchManager = false,
  allowedBranchIds = [],
}: UserFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!user;

  const [formData, setFormData] = useState(getInitialFormData(user));

  useEffect(() => {
    if (open) setFormData(getInitialFormData(user));
  }, [open, user]);

  const availableRoles = isBranchManager
    ? Object.keys(roleLabels).filter((r) => r !== "admin" && r !== "branch_manager")
    : Object.keys(roleLabels);

  const { data: allBranches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const branches = isBranchManager
    ? allBranches.filter((b: any) => allowedBranchIds.includes(b.id))
    : allBranches;

  const { data: userTypes = [] } = useQuery({
    queryKey: ["user-types"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("user_types")
        .select("id, name, code, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["user-groups"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("user_groups")
        .select("id, name, code, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: memberships = [] } = useQuery({
    queryKey: ["user-group-memberships", user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as any[];
      const { data, error } = await (supabase as any)
        .from("user_group_members")
        .select("group_id")
        .eq("user_id", user.id);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user?.id && open,
  });

  useEffect(() => {
    if (open && isEditing) {
      setFormData((prev) => ({
        ...prev,
        selectedGroups: memberships.map((m: any) => m.group_id),
      }));
    }
  }, [open, isEditing, memberships]);

  const saveClassification = async (userId: string, data: typeof formData) => {
    await (supabase as any)
      .from("profiles")
      .update({ user_type_id: data.user_type_id || null })
      .eq("id", userId);

    await (supabase as any).from("user_group_members").delete().eq("user_id", userId);

    if (data.selectedGroups.length > 0) {
      const { error } = await (supabase as any).from("user_group_members").insert(
        data.selectedGroups.map((gid) => ({ user_id: userId, group_id: gid }))
      );
      if (error) throw error;
    }
  };

  const createUserMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("يجب تسجيل الدخول أولاً");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            email: data.email,
            password: data.password,
            full_name: data.full_name,
            phone: data.phone,
            role: data.role,
            is_global: data.is_global,
            selectedBranches: data.selectedBranches,
            primaryBranchId: data.primaryBranchId,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "فشل في إنشاء المستخدم");

      const newUserId = result.user?.id || result.id;

      if (newUserId) {
        await supabase
          .from("profiles")
          .update({
            can_override_pos: data.can_override_pos,
            is_pos_active: data.is_pos_active,
          } as any)
          .eq("id", newUserId);

        await saveClassification(newUserId, data);

        if (data.pin && data.pin.trim().length >= 4) {
          await supabase.rpc("set_user_pin" as any, {
            _user_id: newUserId,
            _pin: data.pin.trim(),
          });
        }
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      toast.success("تم إنشاء المستخدم بنجاح");
      onOpenChange(false);
    },
    onError: (error: any) => toast.error(error.message || "فشل في إنشاء المستخدم"),
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: data.full_name,
          phone: data.phone,
          can_override_pos: data.can_override_pos,
          is_pos_active: data.is_pos_active,
        } as any)
        .eq("id", user.id);
      if (profileError) throw profileError;

      if (data.pin && data.pin.trim().length >= 4) {
        const { error: pinErr } = await supabase.rpc("set_user_pin" as any, {
          _user_id: user.id,
          _pin: data.pin.trim(),
        });
        if (pinErr) throw pinErr;
      }

      const { error: roleError } = await supabase.from("user_roles").upsert(
        {
          user_id: user.id,
          role: data.role as any,
          is_global: data.is_global,
        },
        { onConflict: "user_id,role" }
      );
      if (roleError) throw roleError;

      await supabase.from("user_branch_assignments").delete().eq("user_id", user.id);

      if (data.selectedBranches.length > 0) {
        const { error: branchError } = await supabase
          .from("user_branch_assignments")
          .insert(
            data.selectedBranches.map((branchId: string) => ({
              user_id: user.id,
              branch_id: branchId,
              is_primary: branchId === data.primaryBranchId,
            }))
          );
        if (branchError) throw branchError;
      }

      await saveClassification(user.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      queryClient.invalidateQueries({ queryKey: ["effective-screen-permissions"] });
      toast.success("تم تحديث المستخدم بنجاح");
      onOpenChange(false);
    },
    onError: (error: any) => toast.error(error.message || "فشل في تحديث المستخدم"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      updateUserMutation.mutate(formData);
    } else {
      if (!formData.password) {
        toast.error("كلمة المرور مطلوبة");
        return;
      }
      createUserMutation.mutate(formData);
    }
  };

  const toggleBranch = (branchId: string) => {
    setFormData((prev) => {
      const isSelected = prev.selectedBranches.includes(branchId);
      const newBranches = isSelected
        ? prev.selectedBranches.filter((id: string) => id !== branchId)
        : [...prev.selectedBranches, branchId];
      return {
        ...prev,
        selectedBranches: newBranches,
        primaryBranchId:
          newBranches.length === 1
            ? newBranches[0]
            : newBranches.includes(prev.primaryBranchId)
            ? prev.primaryBranchId
            : "",
      };
    });
  };

  const toggleGroup = (groupId: string) =>
    setFormData((prev) => ({
      ...prev,
      selectedGroups: prev.selectedGroups.includes(groupId)
        ? prev.selectedGroups.filter((id) => id !== groupId)
        : [...prev.selectedGroups, groupId],
    }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "تعديل مستخدم" : "إضافة مستخدم جديد"}</DialogTitle>
          <DialogDescription>
            الصلاحيات لا تُمنح من هنا — تُمنح من نوع المستخدم والمجموعات
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="info">البيانات الأساسية</TabsTrigger>
              <TabsTrigger value="access">التصنيف</TabsTrigger>
              <TabsTrigger value="branches">الفروع</TabsTrigger>
              <TabsTrigger value="pos">نقطة البيع</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">الاسم الكامل *</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">البريد الإلكتروني *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    disabled={isEditing}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">رقم الهاتف</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                {!isEditing && (
                  <div className="space-y-2">
                    <Label htmlFor="password">كلمة المرور *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      minLength={6}
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="access" className="space-y-5 mt-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  نوع المستخدم يحدد الصلاحيات الأساسية، والمجموعات تضيف صلاحيات إضافية فوقه.
                  لتعديل مصفوفة الصلاحيات نفسها استخدم شاشة{" "}
                  <Link to="/settings/user-types" className="underline">
                    أنواع المستخدمين
                  </Link>{" "}
                  أو{" "}
                  <Link to="/settings/user-groups" className="underline">
                    المجموعات
                  </Link>
                  .
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>نوع المستخدم (الصلاحيات الأساسية)</Label>
                <Select
                  value={formData.user_type_id || "none"}
                  onValueChange={(v) =>
                    setFormData({ ...formData, user_type_id: v === "none" ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر نوع المستخدم" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون نوع (لا صلاحيات أساسية)</SelectItem>
                    {userTypes.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {userTypes.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    لا توجد أنواع مستخدمين بعد — أنشئها من شاشة أنواع المستخدمين.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>المجموعات (صلاحيات إضافية)</Label>
                <div className="flex flex-wrap gap-2">
                  {formData.selectedGroups.map((gid) => (
                    <Badge key={gid} variant="secondary" className="gap-1">
                      {groups.find((g: any) => g.id === gid)?.name}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => toggleGroup(gid)} />
                    </Badge>
                  ))}
                </div>
                <ScrollArea className="h-40 border rounded-[10px] p-2">
                  <div className="space-y-1">
                    {groups.map((g: any) => (
                      <div
                        key={g.id}
                        className="flex items-center space-x-2 space-x-reverse p-2 hover:bg-muted rounded"
                      >
                        <Checkbox
                          id={`group-${g.id}`}
                          checked={formData.selectedGroups.includes(g.id)}
                          onCheckedChange={() => toggleGroup(g.id)}
                        />
                        <Label htmlFor={`group-${g.id}`} className="flex-1 cursor-pointer">
                          {g.name}
                        </Label>
                      </div>
                    ))}
                    {groups.length === 0 && (
                      <p className="p-2 text-sm text-muted-foreground">لا توجد مجموعات بعد.</p>
                    )}
                  </div>
                </ScrollArea>
              </div>

              <div className="space-y-2">
                <Label>الدور التقني (يُستخدم للحماية الأساسية وسياسات قاعدة البيانات)</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {roleLabels[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="branches" className="space-y-4 mt-4">
              {branches.length === 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    لا توجد فروع مسجلة. يرجى إنشاء فروع أولاً من صفحة إعدادات الفروع.
                  </AlertDescription>
                </Alert>
              )}

              {!isBranchManager && (
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox
                    id="is_global"
                    checked={formData.is_global}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_global: checked as boolean })
                    }
                  />
                  <Label htmlFor="is_global">
                    صلاحية عامة (الوصول لجميع الفروع) - للمدراء فقط
                  </Label>
                </div>
              )}

              {!formData.is_global && branches.length > 0 && (
                <>
                  <div>
                    <Label className="mb-2 block">اختر الفروع المتاحة للمستخدم:</Label>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {formData.selectedBranches.map((branchId: string) => (
                        <Badge key={branchId} variant="secondary" className="gap-1">
                          {branches.find((b: any) => b.id === branchId)?.name}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => toggleBranch(branchId)}
                          />
                        </Badge>
                      ))}
                    </div>
                    <ScrollArea className="h-40 border rounded-[10px] p-2">
                      <div className="space-y-2">
                        {branches.map((branch: any) => (
                          <div
                            key={branch.id}
                            className="flex items-center space-x-2 space-x-reverse p-2 hover:bg-muted rounded"
                          >
                            <Checkbox
                              id={`branch-${branch.id}`}
                              checked={formData.selectedBranches.includes(branch.id)}
                              onCheckedChange={() => toggleBranch(branch.id)}
                            />
                            <Label
                              htmlFor={`branch-${branch.id}`}
                              className="flex flex-1 items-center justify-between cursor-pointer"
                            >
                              <span>{branch.name}</span>
                              <span className="text-muted-foreground text-sm">
                                ({branch.code})
                              </span>
                            </Label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  {formData.selectedBranches.length > 1 && (
                    <div className="space-y-2">
                      <Label>الفرع الرئيسي (سيتم تحديده تلقائياً عند تسجيل الدخول):</Label>
                      <Select
                        value={formData.primaryBranchId}
                        onValueChange={(value) =>
                          setFormData({ ...formData, primaryBranchId: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="اختر الفرع الرئيسي" />
                        </SelectTrigger>
                        <SelectContent>
                          {formData.selectedBranches.map((branchId: string) => (
                            <SelectItem key={branchId} value={branchId}>
                              {branches.find((b: any) => b.id === branchId)?.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {formData.selectedBranches.length === 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        يجب اختيار فرع واحد على الأقل أو تفعيل "صلاحية عامة"
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="pos" className="space-y-4 mt-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  هذه الإعدادات تخص شاشة الكاشير (POS). الـ PIN يُستخدم للدخول السريع وتبديل
                  الكاشيرين على نفس الجهاز.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="pin">رمز الدخول السريع (PIN) — 4 إلى 8 أرقام</Label>
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  placeholder={isEditing ? "اتركه فارغاً لعدم التغيير" : "أدخل PIN رقمي"}
                  value={formData.pin}
                  onChange={(e) =>
                    setFormData({ ...formData, pin: e.target.value.replace(/\D/g, "") })
                  }
                />
              </div>

              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox
                  id="is_pos_active"
                  checked={formData.is_pos_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_pos_active: checked as boolean })
                  }
                />
                <Label htmlFor="is_pos_active">مفعّل على نقطة البيع</Label>
              </div>

              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox
                  id="can_override_pos"
                  checked={formData.can_override_pos}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, can_override_pos: checked as boolean })
                  }
                />
                <Label htmlFor="can_override_pos">
                  صلاحية مشرف (يُسمح له بالموافقة على الخصومات والإلغاء والاسترجاع)
                </Label>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={createUserMutation.isPending || updateUserMutation.isPending}
            >
              {createUserMutation.isPending || updateUserMutation.isPending
                ? "جاري الحفظ..."
                : isEditing
                ? "تحديث"
                : "إنشاء"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
