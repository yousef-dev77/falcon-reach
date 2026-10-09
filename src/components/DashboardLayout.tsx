import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ConnectionStatusBanner } from "./ConnectionStatusBanner";
import { BranchSelector } from "./BranchSelector";
import { ReadOnlyBanner } from "./ReadOnlyBanner";
import { SessionGuard } from "./SessionGuard";
import { Bell, User, LogOut, Calendar, RefreshCw, Lock, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useBranch } from "@/contexts/BranchContext";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, signOut } = useAuth();
  const { activeFiscalPeriod, isReadOnly, clearSession } = useBranch();
  const navigate = useNavigate();

  const handleSwitchSession = () => {
    clearSession();
    navigate("/session");
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <ConnectionStatusBanner />
          <ReadOnlyBanner />
          {/* Header */}
          <header data-app-chrome className="sticky top-0 z-10 flex h-14 md:h-16 items-center gap-1.5 md:gap-3 border-b bg-card px-2 md:px-6 print:hidden">
            <SidebarTrigger />

            {/* Apps launcher */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/apps")}
              className="gap-2 h-9 px-2 md:px-3 shrink-0"
              title="كل الأنظمة"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden md:inline">الأنظمة</span>
            </Button>

            <Separator orientation="vertical" className="h-6 hidden md:block" />

            {/* Branch Selector */}
            <BranchSelector />

            {/* Fiscal Period indicator */}
            {activeFiscalPeriod && (
              <>
                <Separator orientation="vertical" className="h-6 hidden md:block" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSwitchSession}
                  className="gap-1.5 h-9 px-2 md:px-3 min-w-0 shrink"
                  title="تبديل جلسة العمل"
                >
                  <Calendar className="h-4 w-4 text-primary shrink-0 hidden sm:block" />
                  <span className="font-medium truncate max-w-[64px] md:max-w-[160px]">{activeFiscalPeriod.name}</span>
                  {isReadOnly && <Lock className="h-3 w-3 text-warning-strong shrink-0" />}
                  <RefreshCw className="h-3 w-3 text-muted-foreground hidden md:block" />
                </Button>
              </>
            )}

            <div className="flex-1" />

            <Separator orientation="vertical" className="h-6 hidden md:block" />

            <Button variant="ghost" size="icon" className="relative shrink-0 h-9 w-9">
              <Bell className="h-5 w-5" />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="text-right">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">حسابي</p>
                    <p className="text-xs leading-none text-muted-foreground truncate">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSwitchSession}>
                  <RefreshCw className="me-2 h-4 w-4" />
                  تبديل الجلسة
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut} className="text-destructive">
                  <LogOut className="me-2 h-4 w-4" />
                  تسجيل الخروج
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto bg-background p-3 sm:p-4 md:p-6">
            <SessionGuard>{children}</SessionGuard>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
