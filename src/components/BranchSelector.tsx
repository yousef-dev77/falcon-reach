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
    return <Skeleton className="h-9 w-24 md:w-40" />;
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
      <div className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-2 bg-muted/50 rounded-md min-w-0">
        <Building2 className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-medium truncate max-w-[80px] md:max-w-[200px]">{activeBranch?.name}</span>
        <Badge variant="outline" className="text-xs hidden sm:inline-flex">
          {activeBranch?.code}
        </Badge>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-1 md:gap-2 md:min-w-[160px] justify-between px-2 md:px-4 min-w-0">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="truncate max-w-[70px] md:max-w-[100px]">{activeBranch?.name}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-w-[90vw]">
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
