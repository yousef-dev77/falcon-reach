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
import { X, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

const moduleLabels: Record<string, string> = {
  finance: "المالية",
  inventory: "المخزون",
  sales: "المبيعات",
  purchases: "المشتريات",
  hr: "الموارد البشرية",
  pos: "نقاط البيع",
  settings: "الإعدادات",
};

const getInitialFormData = (user?: any) => ({
  full_name: user?.full_name || "",
  email: user?.email || "",
  phone: user?.phone || "",
  password: "",
  role: user?.user_roles?.[0]?.role || "user",
  is_global: user?.user_roles?.[0]?.is_global || false,
  selectedBranches: user?.user_branch_assignments?.map((b: any) => b.branch_id) || [],
  primaryBranchId: user?.user_branch_assignments?.find((b: any) => b.is_primary)?.branch_id || "",
  useCustomPermissions: false,
  selectedPermissions: [] as string[],
  pin: "",
  can_override_pos: user?.can_override_pos || false,
  is_pos_active: user?.is_pos_active ?? true,
});

export function UserFormDialog({ open, onOpenChange, user, isBranchManager = false, allowedBranchIds = [] }: UserFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!user;

  const [formData, setFormData] = useState(getInitialFormData(user));

  // Reset form when dialog opens or user changes
  useEffect(() => {
    if (open) {
      setFormData(getInitialFormData(user));
    }
  }, [open, user]);

  // Get available roles based on current user's role
  const availableRoles = isBranchManager 
    ? Object.keys(roleLabels).filter(role => role !== 'admin' && role !== 'branch_manager')
    : Object.keys(roleLabels);

  const { data: allBranches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Filter branches based on branch manager's allowed branches
  const branches = isBranchManager 
    ? allBranches.filter((b: any) => allowedBranchIds.includes(b.id))
    : allBranches;

  const { data: permissions = [] } = useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .order('module');
      if (error) throw error;
      return data;
    },
  });

  const { data: rolePermissions = [] } = useQuery({
    queryKey: ['role-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('role_permissions').select('role, permission_id');
      if (error) throw error;
      return data;
    },
  });

  const { data: userPermissions = [] } = useQuery({
    queryKey: ['user-permissions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('user_permissions')
        .select('permission_id, is_granted')
        .eq('user_id', user.id)
        .is('branch_id', null);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (open && isEditing) {
      setFormData((prev) => ({
        ...prev,
        useCustomPermissions: userPermissions.length > 0,
        selectedPermissions: userPermissions
          .filter((p: any) => p.is_granted !== false)
          .map((p: any) => p.permission_id),
      }));
    }
  }, [open, isEditing, userPermissions]);

  const createUserMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Get current session token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("يجب تسجيل الدخول أولاً");
      }

      // Call edge function to create user (won't log out current user)
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
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
            selectedPermissions: data.useCustomPermissions ? data.selectedPermissions : undefined,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "فشل في إنشاء المستخدم");
      }

      const newUserId = result.user?.id || result.id;

      // Persist POS flags + PIN for the new user
      if (newUserId) {
        await supabase
          .from('profiles')
          .update({
            can_override_pos: data.can_override_pos,
            is_pos_active: data.is_pos_active,
          } as any)
          .eq('id', newUserId);

        if (data.pin && data.pin.trim().length >= 4) {
          await supabase.rpc('set_user_pin' as any, {
            _user_id: newUserId,
            _pin: data.pin.trim(),
          });
        }
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      toast.success("تم إنشاء المستخدم بنجاح");
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل في إنشاء المستخدم");
    },
  });

  const resetForm = () => {
    setFormData({
      full_name: "",
      email: "",
      phone: "",
      password: "",
      role: "user",
      is_global: false,
      selectedBranches: [],
      primaryBranchId: "",
      useCustomPermissions: false,
      selectedPermissions: [],
      pin: "",
      can_override_pos: false,
      is_pos_active: true,
    });
  };

  const updateUserMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Update profile (incl. POS flags)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: data.full_name,
          phone: data.phone,
          can_override_pos: data.can_override_pos,
          is_pos_active: data.is_pos_active,
        } as any)
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Set PIN if provided
      if (data.pin && data.pin.trim().length >= 4) {
        const { error: pinErr } = await supabase.rpc('set_user_pin' as any, {
          _user_id: user.id,
          _pin: data.pin.trim(),
        });
        if (pinErr) throw pinErr;
      }

      // Update role
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: user.id,
          role: data.role as any,
          is_global: data.is_global,
        }, {
          onConflict: 'user_id,role',
        });

      if (roleError) throw roleError;

      // Update branch assignments
      await supabase
        .from('user_branch_assignments')
        .delete()
        .eq('user_id', user.id);

      if (data.selectedBranches.length > 0) {
        const branchAssignments = data.selectedBranches.map((branchId: string) => ({
          user_id: user.id,
          branch_id: branchId,
          is_primary: branchId === data.primaryBranchId,
        }));

        const { error: branchError } = await supabase
          .from('user_branch_assignments')
          .insert(branchAssignments);

        if (branchError) throw branchError;
      }

      // Update custom permissions. If disabled, the user follows the role's default permissions.
      await supabase.from('user_permissions').delete().eq('user_id', user.id).is('branch_id', null);

      if (data.useCustomPermissions && data.selectedPermissions.length > 0) {
        const customPermissions = data.selectedPermissions.map((permissionId: string) => ({
          user_id: user.id,
          permission_id: permissionId,
          branch_id: null,
          is_granted: true,
        }));

        const { error: permissionsError } = await supabase
          .from('user_permissions')
          .insert(customPermissions);

        if (permissionsError) throw permissionsError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      toast.success("تم تحديث المستخدم بنجاح");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل في تحديث المستخدم");
    },
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
    setFormData(prev => {
      const isSelected = prev.selectedBranches.includes(branchId);
      const newBranches = isSelected
        ? prev.selectedBranches.filter((id: string) => id !== branchId)
        : [...prev.selectedBranches, branchId];
      
      return {
        ...prev,
        selectedBranches: newBranches,
        primaryBranchId: newBranches.length === 1 ? newBranches[0] : 
                         (newBranches.includes(prev.primaryBranchId) ? prev.primaryBranchId : ""),
      };
    });
  };

  const permissionsByModule = permissions.reduce((acc: any, perm: any) => {
    if (!acc[perm.module]) acc[perm.module] = [];
    acc[perm.module].push(perm);
    return acc;
  }, {});

  const defaultRolePermissionIds = rolePermissions
    .filter((rp: any) => rp.role === formData.role)
    .map((rp: any) => rp.permission_id);

  const activePermissionIds = formData.useCustomPermissions
    ? formData.selectedPermissions
    : defaultRolePermissionIds;

  const togglePermission = (permissionId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedPermissions: prev.selectedPermissions.includes(permissionId)
        ? prev.selectedPermissions.filter((id: string) => id !== permissionId)
        : [...prev.selectedPermissions, permissionId],
    }));
  };

  const useRoleDefaults = () => {
    setFormData((prev) => ({
      ...prev,
      useCustomPermissions: false,
      selectedPermissions: defaultRolePermissionIds,
    }));
  };

  const enableCustomPermissions = () => {
    setFormData((prev) => ({
      ...prev,
      useCustomPermissions: true,
      selectedPermissions: activePermissionIds,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "تعديل مستخدم" : "إضافة مستخدم جديد"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "تعديل بيانات المستخدم وصلاحياته" : "إنشاء مستخدم جديد وتحديد صلاحياته"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="info">البيانات الأساسية</TabsTrigger>
              <TabsTrigger value="branches">الفروع</TabsTrigger>
              <TabsTrigger value="role">الدور والصلاحيات</TabsTrigger>
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
                      required={!isEditing}
                      minLength={6}
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="branches" className="space-y-4 mt-4">
              <div className="space-y-4">
                {branches.length === 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      لا توجد فروع مسجلة. يرجى إنشاء فروع أولاً من صفحة إعدادات الفروع.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Only show global access option for non-branch-managers */}
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
                        {formData.selectedBranches.map((branchId: string) => {
                          const branch = branches.find((b: any) => b.id === branchId);
                          return (
                            <Badge key={branchId} variant="secondary" className="gap-1">
                              {branch?.name}
                              <X 
                                className="h-3 w-3 cursor-pointer" 
                                onClick={() => toggleBranch(branchId)}
                              />
                            </Badge>
                          );
                        })}
                      </div>
                      <ScrollArea className="h-40 border rounded-md p-2">
                        <div className="space-y-2">
                          {branches.map((branch: any) => {
                            const checkboxId = `branch-${branch.id}`;
                            return (
                              <div
                                key={branch.id}
                                className="flex items-center space-x-2 space-x-reverse p-2 hover:bg-muted rounded"
                              >
                                <Checkbox
                                  id={checkboxId}
                                  checked={formData.selectedBranches.includes(branch.id)}
                                  onCheckedChange={() => toggleBranch(branch.id)}
                                />
                                <Label
                                  htmlFor={checkboxId}
                                  className="flex flex-1 items-center justify-between cursor-pointer"
                                >
                                  <span>{branch.name}</span>
                                  <span className="text-muted-foreground text-sm">({branch.code})</span>
                                </Label>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </div>

                    {formData.selectedBranches.length > 1 && (
                      <div className="space-y-2">
                        <Label>الفرع الرئيسي (سيتم تحديده تلقائياً عند تسجيل الدخول):</Label>
                        <Select
                          value={formData.primaryBranchId}
                          onValueChange={(value) => setFormData({ ...formData, primaryBranchId: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="اختر الفرع الرئيسي" />
                          </SelectTrigger>
                          <SelectContent>
                            {formData.selectedBranches.map((branchId: string) => {
                              const branch = branches.find((b: any) => b.id === branchId);
                              return (
                                <SelectItem key={branchId} value={branchId}>
                                  {branch?.name}
                                </SelectItem>
                              );
                            })}
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
              </div>
            </TabsContent>

            <TabsContent value="role" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>الدور الوظيفي:</Label>
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

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Label className="block">الصلاحيات</Label>
                    <p className="text-xs text-muted-foreground">
                      افتراضياً يأخذ المستخدم صلاحيات الدور، ويمكن تخصيصها يدوياً لهذا المستخدم فقط.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant={!formData.useCustomPermissions ? "default" : "outline"} size="sm" onClick={useRoleDefaults}>
                      صلاحيات الدور
                    </Button>
                    <Button type="button" variant={formData.useCustomPermissions ? "default" : "outline"} size="sm" onClick={enableCustomPermissions}>
                      تخصيص يدوي
                    </Button>
                  </div>
                </div>

                <ScrollArea className="h-60 border rounded-md p-4">
                  {Object.entries(permissionsByModule).map(([module, perms]) => (
                    <div key={module} className="mb-4">
                      <h4 className="font-semibold text-sm mb-2 text-primary">
                        {moduleLabels[module] || module}
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {(perms as any[]).map((perm) => (
                          <label key={perm.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Checkbox
                              checked={activePermissionIds.includes(perm.id)}
                              disabled={!formData.useCustomPermissions}
                              onCheckedChange={() => togglePermission(perm.id)}
                            />
                            <span>{perm.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </ScrollArea>
                <p className="text-xs text-muted-foreground">
                  ملاحظة: حماية الصفحات حالياً تعتمد على الدور، وهذه الاختيارات تحفظ صلاحيات مفصلة للاستخدام في القيود والأزرار المتقدمة.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="pos" className="space-y-4 mt-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  هذه الإعدادات تخص شاشة الكاشير (POS). الـ PIN يُستخدم للدخول السريع وتبديل الكاشيرين على نفس الجهاز.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="pin">رمز الدخول السريع (PIN) — 4 إلى 8 أرقام</Label>
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  placeholder={isEditing ? "اتركه فارغاً لعدم التغيير" : "أدخل PIN رقمي"}
                  value={formData.pin}
                  onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '') })}
                />
                <p className="text-xs text-muted-foreground">
                  يتم تخزينه مشفّراً. لتعطيل دخول الكاشير بدون كلمة سر، اترك الحقل فارغاً.
                </p>
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
                : isEditing ? "تحديث" : "إنشاء"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
