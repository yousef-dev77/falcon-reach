import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Branch {
  id: string;
  name: string;
  code: string;
  is_primary: boolean;
}

interface FiscalPeriod {
  id: string;
  code: string;
  name: string;
  start_date: string;
  end_date: string;
  is_closed: boolean;
}

interface BranchContextType {
  activeBranch: Branch | null;
  userBranches: Branch[];
  isLoading: boolean;
  setActiveBranch: (branch: Branch) => void;
  refreshBranches: () => Promise<void>;
  hasMultipleBranches: boolean;
  isGlobalAdmin: boolean;
  // Fiscal period session
  activeFiscalPeriod: FiscalPeriod | null;
  setActiveFiscalPeriod: (period: FiscalPeriod) => void;
  isReadOnly: boolean;
  clearSession: () => void;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

const ACTIVE_BRANCH_KEY = "falcon_active_branch";
const ACTIVE_PERIOD_KEY = "falcon_active_period";

export function BranchProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeBranch, setActiveBranchState] = useState<Branch | null>(null);
  const [activeFiscalPeriod, setActiveFiscalPeriodState] = useState<FiscalPeriod | null>(null);
  const [userBranches, setUserBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);

  const fetchUserBranches = useCallback(async () => {
    if (!user) {
      setUserBranches([]);
      setActiveBranchState(null);
      setActiveFiscalPeriodState(null);
      sessionStorage.removeItem(ACTIVE_BRANCH_KEY);
      sessionStorage.removeItem(ACTIVE_PERIOD_KEY);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role, is_global')
        .eq('user_id', user.id);

      const isAdmin = roleData?.some(r => r.role === 'admin' && r.is_global);
      setIsGlobalAdmin(isAdmin || false);

      let branches: Branch[] = [];

      if (isAdmin) {
        const { data, error } = await supabase
          .from('branches')
          .select('id, name, code')
          .eq('is_active', true)
          .order('code');

        if (error) throw error;
        branches = (data || []).map(b => ({ ...b, is_primary: false }));
      } else {
        const { data, error } = await supabase
          .from('user_branch_assignments')
          .select(`
            is_primary,
            branch:branches(id, name, code)
          `)
          .eq('user_id', user.id);

        if (error) throw error;
        branches = (data || [])
          .filter(d => d.branch)
          .map(d => ({
            id: (d.branch as any).id,
            name: (d.branch as any).name,
            code: (d.branch as any).code,
            is_primary: d.is_primary || false
          }));
      }

      setUserBranches(branches);

      // Restore branch from session
      const savedBranchId = sessionStorage.getItem(ACTIVE_BRANCH_KEY);
      if (savedBranchId) {
        const saved = branches.find(b => b.id === savedBranchId);
        if (saved) setActiveBranchState(saved);
      }

      // Restore fiscal period from session
      const savedPeriodRaw = sessionStorage.getItem(ACTIVE_PERIOD_KEY);
      if (savedPeriodRaw) {
        try {
          const saved = JSON.parse(savedPeriodRaw) as FiscalPeriod;
          // Re-fetch fresh status (it might have been reopened/closed)
          const { data: fresh } = await supabase
            .from('fiscal_periods')
            .select('id, code, name, start_date, end_date, is_closed')
            .eq('id', saved.id)
            .maybeSingle();
          if (fresh) setActiveFiscalPeriodState(fresh as FiscalPeriod);
        } catch {
          sessionStorage.removeItem(ACTIVE_PERIOD_KEY);
        }
      }
    } catch (error) {
      console.error('Error fetching user branches:', error);
      toast.error('حدث خطأ في تحميل الفروع');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUserBranches();
  }, [fetchUserBranches]);

  const setActiveBranch = useCallback((branch: Branch) => {
    setActiveBranchState(branch);
    sessionStorage.setItem(ACTIVE_BRANCH_KEY, branch.id);
  }, []);

  const setActiveFiscalPeriod = useCallback((period: FiscalPeriod) => {
    setActiveFiscalPeriodState(period);
    sessionStorage.setItem(ACTIVE_PERIOD_KEY, JSON.stringify(period));
  }, []);

  const clearSession = useCallback(() => {
    setActiveBranchState(null);
    setActiveFiscalPeriodState(null);
    sessionStorage.removeItem(ACTIVE_BRANCH_KEY);
    sessionStorage.removeItem(ACTIVE_PERIOD_KEY);
  }, []);

  const refreshBranches = useCallback(async () => {
    await fetchUserBranches();
  }, [fetchUserBranches]);

  return (
    <BranchContext.Provider
      value={{
        activeBranch,
        userBranches,
        isLoading,
        setActiveBranch,
        refreshBranches,
        hasMultipleBranches: userBranches.length > 1,
        isGlobalAdmin,
        activeFiscalPeriod,
        setActiveFiscalPeriod,
        isReadOnly: !!activeFiscalPeriod?.is_closed,
        clearSession,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error("useBranch must be used within a BranchProvider");
  }
  return context;
}

export function useReadOnlyMode() {
  const { isReadOnly, activeFiscalPeriod } = useBranch();
  return { isReadOnly, activeFiscalPeriod };
}
