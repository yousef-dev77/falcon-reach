import { Lock } from "lucide-react";
import { useBranch } from "@/contexts/BranchContext";

export function ReadOnlyBanner() {
  const { isReadOnly, activeFiscalPeriod } = useBranch();
  if (!isReadOnly || !activeFiscalPeriod) return null;

  return (
    <div className="sticky top-0 z-20 flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-sm font-medium text-white shadow">
      <Lock className="h-4 w-4" />
      <span>
        وضع الاستعراض فقط — السنة المالية «{activeFiscalPeriod.name}» مقفلة. لا يمكن إجراء أي تعديل.
      </span>
    </div>
  );
}
