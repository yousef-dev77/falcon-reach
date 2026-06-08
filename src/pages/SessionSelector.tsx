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

export default function SessionSelector() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { userBranches, setActiveBranch, setActiveFiscalPeriod, isLoading: branchLoading } = useBranch();
  const { userRoles, isLoading: rolesLoading } = usePermissions();

  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");

  // Auto-route cashiers straight to POS sessions
  useEffect(() => {
    if (rolesLoading || branchLoading) return;
    const roles = userRoles.map(r => r.role);
    if (roles.length > 0 && roles.every(r => r === "cashier")) {
      const primary = userBranches.find(b => b.is_primary) || userBranches[0];
      if (primary) {
        setActiveBranch(primary);
        navigate("/pos/sessions", { replace: true });
      }
    }
  }, [userRoles, userBranches, rolesLoading, branchLoading, setActiveBranch, navigate]);

  // Set default branch
  useEffect(() => {
    if (!selectedBranchId && userBranches.length > 0) {
      const primary = userBranches.find(b => b.is_primary) || userBranches[0];
      setSelectedBranchId(primary.id);
    }
  }, [userBranches, selectedBranchId]);

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

  // Default to most recent open period
  useEffect(() => {
    if (!selectedPeriodId && periods.length > 0) {
      const openPeriod = periods.find(p => !p.is_closed) || periods[0];
      setSelectedPeriodId(openPeriod.id);
    }
  }, [periods, selectedPeriodId]);

  const handleEnter = () => {
    const branch = userBranches.find(b => b.id === selectedBranchId);
    const period = periods.find(p => p.id === selectedPeriodId);
    if (!branch || !period) return;
    setActiveBranch(branch);
    setActiveFiscalPeriod(period);
    navigate("/", { replace: true });
  };

  const selectedPeriod = periods.find(p => p.id === selectedPeriodId);

  if (branchLoading || rolesLoading || periodsLoading) {
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
          {userBranches.length === 0 ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                لا توجد فروع مُسندة إليك. يرجى التواصل مع المسؤول.
              </AlertDescription>
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
                    {userBranches.map(b => (
                      <SelectItem key={b.id} value={b.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{b.name}</span>
                          <span className="text-xs text-muted-foreground">({b.code})</span>
                          {b.is_primary && <Badge variant="secondary" className="text-xs">رئيسي</Badge>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  <LogOut className="me-2 h-4 w-4" />
                  خروج
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleEnter}
                  disabled={!selectedBranchId || !selectedPeriodId}
                >
                  <LogIn className="me-2 h-4 w-4" />
                  دخول
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
