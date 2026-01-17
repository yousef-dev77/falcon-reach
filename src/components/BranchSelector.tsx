import { useBranch } from "@/contexts/BranchContext";
import { Building2, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export function BranchSelector() {
  const { activeBranch, userBranches, setActiveBranch, isLoading, hasMultipleBranches, isGlobalAdmin } = useBranch();

  if (isLoading) {
    return <Skeleton className="h-9 w-40" />;
  }

  if (userBranches.length === 0) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Building2 className="h-4 w-4" />
        <span>لا توجد فروع</span>
      </div>
    );
  }

  // إذا كان فرع واحد فقط، نعرض اسمه بدون dropdown
  if (!hasMultipleBranches) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md">
        <Building2 className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">{activeBranch?.name}</span>
        <Badge variant="outline" className="text-xs">
          {activeBranch?.code}
        </Badge>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 min-w-[160px] justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="truncate max-w-[100px]">{activeBranch?.name}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>الفرع النشط</span>
          {isGlobalAdmin && (
            <Badge variant="secondary" className="text-xs">مدير عام</Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {userBranches.map((branch) => (
          <DropdownMenuItem
            key={branch.id}
            onClick={() => setActiveBranch(branch)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span>{branch.name}</span>
              <Badge variant="outline" className="text-xs">
                {branch.code}
              </Badge>
              {branch.is_primary && (
                <Badge variant="secondary" className="text-xs">رئيسي</Badge>
              )}
            </div>
            {activeBranch?.id === branch.id && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
