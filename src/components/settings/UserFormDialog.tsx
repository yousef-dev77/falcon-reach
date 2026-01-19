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
}

const roleLabels: Record<string, string> = {
  admin: "مدير النظام",
  accountant: "محاسب",
  sales_manager: "مدير مبيعات",
  inventory_manager: "مدير مخزون",
  user: "مستخدم",
};

const moduleLabels: Record<string, string> = {
  finance: "المالية",
  inventory: "المخزون",
  sales: "المبيعات",
  purchases: "المشتريات",
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
});

export function UserFormDialog({ open, onOpenChange, user }: UserFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!user;

  const [formData, setFormData] = useState(getInitialFormData(user));

  // Reset form when dialog opens or user changes
  useEffect(() => {
    if (open) {
      setFormData(getInitialFormData(user));
    }
  }, [open, user]);

  const { data: branches = [] } = useQuery({
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
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "فشل في إنشاء المستخدم");
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
    });
  };

  const updateUserMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: data.full_name,
          phone: data.phone,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

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
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info">البيانات الأساسية</TabsTrigger>
              <TabsTrigger value="branches">الفروع</TabsTrigger>
              <TabsTrigger value="role">الدور والصلاحيات</TabsTrigger>
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
                          {branches.map((branch: any) => (
                            <div 
                              key={branch.id}
                              className="flex items-center space-x-2 space-x-reverse p-2 hover:bg-muted rounded cursor-pointer"
                              onClick={() => toggleBranch(branch.id)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  toggleBranch(branch.id);
                                }
                              }}
                            >
                              <Checkbox
                                checked={formData.selectedBranches.includes(branch.id)}
                              />
                              <span>{branch.name}</span>
                              <span className="text-muted-foreground text-sm">({branch.code})</span>
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
                    {Object.entries(roleLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-2 block">الصلاحيات المرتبطة بالدور:</Label>
                <ScrollArea className="h-60 border rounded-md p-4">
                  {Object.entries(permissionsByModule).map(([module, perms]) => (
                    <div key={module} className="mb-4">
                      <h4 className="font-semibold text-sm mb-2 text-primary">
                        {moduleLabels[module] || module}
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {(perms as any[]).map((perm) => (
                          <div key={perm.id} className="text-sm text-muted-foreground">
                            • {perm.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </ScrollArea>
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
