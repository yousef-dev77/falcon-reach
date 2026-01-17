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

interface BranchContextType {
  activeBranch: Branch | null;
  userBranches: Branch[];
  isLoading: boolean;
  setActiveBranch: (branch: Branch) => void;
  refreshBranches: () => Promise<void>;
  hasMultipleBranches: boolean;
  isGlobalAdmin: boolean;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

const ACTIVE_BRANCH_KEY = "falcon_active_branch";

export function BranchProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeBranch, setActiveBranchState] = useState<Branch | null>(null);
  const [userBranches, setUserBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);

  const fetchUserBranches = useCallback(async () => {
    if (!user) {
      setUserBranches([]);
      setActiveBranch(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // التحقق إذا كان المستخدم admin عام
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role, is_global')
        .eq('user_id', user.id);

      const isAdmin = roleData?.some(r => r.role === 'admin' && r.is_global);
      setIsGlobalAdmin(isAdmin || false);

      let branches: Branch[] = [];

      if (isAdmin) {
        // Admin عام يحصل على كل الفروع
        const { data, error } = await supabase
          .from('branches')
          .select('id, name, code')
          .eq('is_active', true)
          .order('code');

        if (error) throw error;
        branches = (data || []).map(b => ({ ...b, is_primary: false }));
      } else {
        // المستخدم العادي يحصل على فروعه المعينة
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

      // استعادة الفرع النشط من التخزين المحلي
      const savedBranchId = sessionStorage.getItem(ACTIVE_BRANCH_KEY);
      
      if (savedBranchId) {
        const savedBranch = branches.find(b => b.id === savedBranchId);
        if (savedBranch) {
          setActiveBranchState(savedBranch);
        } else if (branches.length > 0) {
          // الفرع المحفوظ غير متاح، استخدم الفرع الأساسي أو الأول
          const primaryBranch = branches.find(b => b.is_primary) || branches[0];
          setActiveBranchState(primaryBranch);
          sessionStorage.setItem(ACTIVE_BRANCH_KEY, primaryBranch.id);
        }
      } else if (branches.length > 0) {
        // لا يوجد فرع محفوظ، استخدم الفرع الأساسي أو الأول
        const primaryBranch = branches.find(b => b.is_primary) || branches[0];
        setActiveBranchState(primaryBranch);
        sessionStorage.setItem(ACTIVE_BRANCH_KEY, primaryBranch.id);
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
    toast.success(`تم التبديل إلى فرع: ${branch.name}`);
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
