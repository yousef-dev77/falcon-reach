import { useBranch } from "@/contexts/BranchContext";
import { useCallback, useMemo } from "react";

/**
 * Hook للفلترة التلقائية حسب الفرع النشط
 * يستخدم في جميع الصفحات التي تحتاج فلترة البيانات حسب الفرع
 */
export function useBranchFilter() {
  const { activeBranch, isGlobalAdmin, userBranches } = useBranch();

  /**
   * يضيف شرط الفرع للـ query
   */
  const addBranchFilter = useCallback(<T extends { branch_id?: string }>(
    query: any,
    columnName: string = 'branch_id'
  ) => {
    if (activeBranch) {
      return query.eq(columnName, activeBranch.id);
    }
    return query;
  }, [activeBranch]);

  /**
   * يفلتر مصفوفة من البيانات حسب الفرع النشط
   */
  const filterByBranch = useCallback(<T extends { branch_id?: string | null }>(
    data: T[],
    branchIdField: keyof T = 'branch_id' as keyof T
  ): T[] => {
    if (!activeBranch) return data;
    
    return data.filter(item => {
      const itemBranchId = item[branchIdField];
      // إذا لم يكن هناك branch_id، نعرض العنصر (بيانات عامة)
      if (!itemBranchId) return true;
      return itemBranchId === activeBranch.id;
    });
  }, [activeBranch]);

  /**
   * يتحقق إذا كان العنصر ينتمي للفرع النشط
   */
  const belongsToActiveBranch = useCallback((branchId: string | null | undefined): boolean => {
    if (!branchId) return true; // بيانات عامة
    if (!activeBranch) return false;
    return branchId === activeBranch.id;
  }, [activeBranch]);

  /**
   * يتحقق إذا كان المستخدم لديه صلاحية على الفرع المحدد
   */
  const canAccessBranch = useCallback((branchId: string): boolean => {
    if (isGlobalAdmin) return true;
    return userBranches.some(b => b.id === branchId);
  }, [isGlobalAdmin, userBranches]);

  /**
   * قائمة IDs الفروع المتاحة للمستخدم
   */
  const accessibleBranchIds = useMemo(() => {
    return userBranches.map(b => b.id);
  }, [userBranches]);

  return {
    activeBranch,
    activeBranchId: activeBranch?.id,
    activeBranchCode: activeBranch?.code,
    isGlobalAdmin,
    addBranchFilter,
    filterByBranch,
    belongsToActiveBranch,
    canAccessBranch,
    accessibleBranchIds,
  };
}
