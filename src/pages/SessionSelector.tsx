import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBranch } from "@/contexts/BranchContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, Calendar, Lock, CheckCircle2, AlertTriangle, LogIn, LogOut } from "lucide-react";
import { format } from "date-fns";

interface FiscalPeriod {
  id: string;
  code: string;
  name: string;
  start_date: string;
  end_date: string;
  is_closed: boolean;
}

interface BranchOpt {
  id: string;
  name: string;
  code: string;
  is_primary: boolean;
  assigned: boolean;
}

export default function SessionSelector() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { setActiveBranch, setActiveFiscalPeriod, isGlobalAdmin } = useBranch();
  const { userRoles, isLoading: rolesLoading } = usePermissions();

  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");

  // Fetch ALL branches + user's assignments (so unassigned ones show locked)
  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ["session-branches", user?.id, isGlobalAdmin],
    queryFn: async () => {
      const [{ data: allBranches }, { data: assigned }] = await Promise.all([
        supabase.from("branches").select("id, name, code").eq("is_active", true).order("code"),
        supabase.from("user_branch_assignments").select("branch_id, is_primary").eq("user_id", user!.id),
      ]);
      const assignedIds = new Set((assigned || []).map(a => a.branch_id));
      const primaryId = (assigned || []).find(a => a.is_primary)?.branch_id;
      const list: BranchOpt[] = (allBranches || []).map(b => ({
        id: b.id,
        name: b.name,
        code: b.code,
        is_primary: b.id === primaryId,
        assigned: isGlobalAdmin || assignedIds.has(b.id),
      }));
      list.sort((a, b) => {
        if (a.assigned !== b.assigned) return a.assigned ? -1 : 1;
        if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
        return a.code.localeCompare(b.code);
      });
      return list;
    },
    enabled: !!user,
  });

  const { data: periods = [], isLoading: periodsLoading } = useQuery({
    queryKey: ["fiscal-periods-session"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_periods")
        .select("id, code, name, start_date, end_date, is_closed")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data as FiscalPeriod[];
    },
    enabled: !!user,
  });

  // Auto-route cashiers straight to POS sessions
  useEffect(() => {
    if (rolesLoading || branchesLoading) return;
    const roles = userRoles.map(r => r.role);
    if (roles.length > 0 && roles.every(r => r === "cashier")) {
      const primary = branches.find(b => b.assigned && b.is_primary) || branches.find(b => b.assigned);
      if (primary) {
        setActiveBranch(primary);
        navigate("/pos/sessions", { replace: true });
      }
    }
  }, [userRoles, branches, rolesLoading, branchesLoading, setActiveBranch, navigate]);

  // Defaults
  useEffect(() => {
    if (!selectedBranchId && branches.length > 0) {
      const def = branches.find(b => b.assigned && b.is_primary) || branches.find(b => b.assigned);
      if (def) setSelectedBranchId(def.id);
    }
  }, [branches, selectedBranchId]);

  useEffect(() => {
    if (!selectedPeriodId && periods.length > 0) {
      const openPeriod = periods.find(p => !p.is_closed) || periods[0];
      setSelectedPeriodId(openPeriod.id);
    }
  }, [periods, selectedPeriodId]);

  const selectedBranch = branches.find(b => b.id === selectedBranchId);
  const selectedPeriod = periods.find(p => p.id === selectedPeriodId);

  const handleEnter = () => {
    if (!selectedBranch || !selectedPeriod) return;
    if (!selectedBranch.assigned) return;
    setActiveBranch(selectedBranch);
    setActiveFiscalPeriod(selectedPeriod);
    navigate("/", { replace: true });
  };

  if (branchesLoading || rolesLoading || periodsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <LogIn className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl">اختر جلسة العمل</CardTitle>
          <CardDescription>
            حدّد الفرع والسنة المالية للبدء
            <br />
            <span className="text-xs text-muted-foreground">{user?.email}</span>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {branches.length === 0 ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>لا توجد فروع نشطة في النظام.</AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> الفرع
                </Label>
                <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الفرع" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id} disabled={!b.assigned}>
                        <div className="flex items-center gap-2 w-full">
                          {!b.assigned && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                          <span className={`font-medium ${!b.assigned ? "text-muted-foreground" : ""}`}>{b.name}</span>
                          <span className="text-xs text-muted-foreground">({b.code})</span>
                          {b.is_primary && b.assigned && <Badge variant="secondary" className="text-[10px] ms-auto">رئيسي</Badge>}
                          {!b.assigned && <span className="text-[10px] text-muted-foreground ms-auto">بدون صلاحية</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedBranch && !selectedBranch.assigned && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <Lock className="h-3 w-3" /> ليس لديك صلاحية الدخول لهذا الفرع
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> السنة المالية
                </Label>
                <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر السنة المالية" />
                  </SelectTrigger>
                  <SelectContent>
                    {periods.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{p.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({format(new Date(p.start_date), "yyyy/MM/dd")} - {format(new Date(p.end_date), "yyyy/MM/dd")})
                          </span>
                          {p.is_closed ? (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Lock className="h-3 w-3" /> مقفلة
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs gap-1 bg-green-100 text-green-800">
                              <CheckCircle2 className="h-3 w-3" /> مفتوحة
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedPeriod?.is_closed && (
                <Alert className="border-amber-300 bg-amber-50">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-900">
                    <strong>وضع الاستعراض:</strong> هذه السنة المالية مقفلة، يمكنك فقط عرض البيانات والتقارير دون إجراء أي تعديل.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={signOut}>
                  <LogOut className="me-2 h-4 w-4" /> خروج
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleEnter}
                  disabled={!selectedBranch?.assigned || !selectedPeriodId}
                >
                  <LogIn className="me-2 h-4 w-4" /> دخول
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
