import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Edit, Shield, Building2, UserCheck, Users, Crown, Package, Filter, Calculator } from "lucide-react";
import { UserFormDialog } from "@/components/settings/UserFormDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/usePermissions";
import { ListPageHeader } from "@/components/ListPageHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const roleLabels: Record<string, { label: string; color: string; icon: any }> = {
  admin: { label: "مدير النظام", color: "bg-primary text-primary-foreground", icon: Crown },
  branch_manager: { label: "مدير الفرع", color: "bg-purple-500 text-white", icon: Building2 },
  accountant: { label: "محاسب", color: "bg-blue-500 text-white", icon: UserCheck },
  sales_manager: { label: "مدير مبيعات", color: "bg-green-500 text-white", icon: Users },
  inventory_manager: { label: "مدير مخزون", color: "bg-orange-500 text-white", icon: Package },
  cashier: { label: "كاشير POS", color: "bg-teal-500 text-white", icon: Calculator },
  user: { label: "مستخدم", color: "bg-muted text-muted-foreground", icon: Users },
};

export default function UsersPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");

  const { userRoles, userBranches, isAdmin, isLoading: permissionsLoading } = usePermissions();
  
  // Check if current user is branch_manager
  const isBranchManager = userRoles.some(r => r.role === 'branch_manager');
  const currentUserBranchIds = userBranches.map(b => b.branch_id);

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

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
      // جلب كل البيانات بشكل منفصل ثم دمجها
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');
      
      if (rolesError) throw rolesError;

      const { data: branchAssignments, error: branchError } = await supabase
        .from('user_branch_assignments')
        .select('*');
      
      if (branchError) throw branchError;

      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name, code');
      
      if (branchesError) throw branchesError;

      // دمج البيانات
      return (profiles || []).map(profile => ({
        ...profile,
        user_roles: (roles || []).filter(r => r.user_id === profile.id),
        user_branch_assignments: (branchAssignments || [])
          .filter(ba => ba.user_id === profile.id)
          .map(ba => ({
            ...ba,
            branch: branchesData?.find(b => b.id === ba.branch_id)
          }))
      }));
    },
  });

  // Filter users based on current user's role and selected filters
  const filteredUsers = useMemo(() => {
    let result = users;

    // If branch_manager, only show users from their branches
    if (isBranchManager && !isAdmin) {
      result = result.filter((user: any) => {
        const userBranchIds = user.user_branch_assignments?.map((b: any) => b.branch_id) || [];
        // Show users that share at least one branch with the branch_manager
        return userBranchIds.some((id: string) => currentUserBranchIds.includes(id));
      });
    }

    // Apply role filter
    if (roleFilter !== "all") {
      result = result.filter((user: any) => {
        const userRole = user.user_roles?.[0]?.role;
        return userRole === roleFilter;
      });
    }

    // Apply branch filter
    if (branchFilter !== "all") {
      result = result.filter((user: any) => {
        const userBranchIds = user.user_branch_assignments?.map((b: any) => b.branch_id) || [];
        return userBranchIds.includes(branchFilter);
      });
    }

    return result;
  }, [users, isBranchManager, isAdmin, currentUserBranchIds, roleFilter, branchFilter]);

  // Get available branches for filter (branch_manager sees only their branches)
  const availableBranches = useMemo(() => {
    if (isAdmin) return branches;
    if (isBranchManager) {
      return branches.filter((b: any) => currentUserBranchIds.includes(b.id));
    }
    return [];
  }, [branches, isAdmin, isBranchManager, currentUserBranchIds]);

  // Get available roles for filter (branch_manager cannot create admin or other branch_managers)
  const availableRolesForFilter = useMemo(() => {
    if (isAdmin) return Object.keys(roleLabels);
    if (isBranchManager) {
      return Object.keys(roleLabels).filter(role => role !== 'admin' && role !== 'branch_manager');
    }
    return [];
  }, [isAdmin, isBranchManager]);

  const roleCounts = filteredUsers.reduce((acc: Record<string, number>, user: any) => {
    const role = user.user_roles?.[0]?.role || 'user';
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});

  const handleEditUser = (user: any) => {
    setSelectedUser(user);
    setIsDialogOpen(true);
  };

  const handleAddUser = () => {
    setSelectedUser(null);
    setIsDialogOpen(true);
  };

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="space-y-4">
      <ListPageHeader
        title="المستخدمين والصلاحيات"
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "الإعدادات" },
          { label: "المستخدمين والصلاحيات" },
        ]}
        onAdd={handleAddUser}
        addLabel="إضافة مستخدم"
        showSearch={false}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">فلترة:</span>
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="حسب الدور" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الأدوار</SelectItem>
            {(isAdmin ? Object.keys(roleLabels) : availableRolesForFilter).map((role) => (
              <SelectItem key={role} value={role}>
                {roleLabels[role]?.label || role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={branchFilter} onValueChange={setBranchFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="حسب الفرع" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الفروع</SelectItem>
            {availableBranches.map((branch: any) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Role Statistics */}
      <div className="grid gap-4 md:grid-cols-6">
        {Object.entries(roleLabels).map(([role, { label, icon: Icon }]) => (
          <Card key={role}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{roleCounts[role] || 0}</div>
              <p className="text-xs text-muted-foreground">مستخدم</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            قائمة المستخدمين ({filteredUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center space-x-4 space-x-reverse">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="mb-2">لا يوجد مستخدمين مسجلين</p>
              <p className="text-sm">يمكنك إنشاء مستخدمين وتحديد صلاحيات الوصول لكل شاشة والأدوار الوظيفية</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المستخدم</TableHead>
                  <TableHead>البريد الإلكتروني</TableHead>
                  <TableHead>الدور</TableHead>
                  <TableHead>الفروع</TableHead>
                  <TableHead>النطاق</TableHead>
                  <TableHead className="text-left">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user: any) => {
                  const userRole = user.user_roles?.[0]?.role || 'user';
                  const roleInfo = roleLabels[userRole] || roleLabels.user;
                  const isGlobal = user.user_roles?.[0]?.is_global;
                  const branches = user.user_branch_assignments || [];

                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={user.avatar_url} />
                            <AvatarFallback>{getUserInitials(user.full_name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{user.full_name}</div>
                            {user.phone && (
                              <div className="text-sm text-muted-foreground">{user.phone}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <Badge className={roleInfo.color}>
                          {roleInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isGlobal ? (
                          <Badge variant="outline" className="gap-1">
                            <Shield className="h-3 w-3" />
                            جميع الفروع
                          </Badge>
                        ) : branches.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {branches.slice(0, 2).map((assignment: any) => (
                              <Badge 
                                key={assignment.id} 
                                variant={assignment.is_primary ? "default" : "secondary"}
                                className="gap-1"
                              >
                                <Building2 className="h-3 w-3" />
                                {assignment.branch?.name}
                              </Badge>
                            ))}
                            {branches.length > 2 && (
                              <Badge variant="outline">+{branches.length - 2}</Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">غير محدد</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isGlobal ? (
                          <Badge variant="default" className="bg-primary">
                            مركزي
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            فرعي
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditUser(user)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <UserFormDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen}
        user={selectedUser}
        isBranchManager={isBranchManager && !isAdmin}
        allowedBranchIds={currentUserBranchIds}
      />
    </div>
  );
}
