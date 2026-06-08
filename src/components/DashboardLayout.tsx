import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ConnectionStatusBanner, ConnectionStatusIndicator } from "./ConnectionStatusBanner";
import { BranchSelector } from "./BranchSelector";
import { ReadOnlyBanner } from "./ReadOnlyBanner";
import { SessionGuard } from "./SessionGuard";
import { Bell, User, LogOut, Calendar, RefreshCw, Lock } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";

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
      <ConnectionStatusBanner />
      <ReadOnlyBanner />
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          {/* Header */}
          <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b bg-card px-6">
            <SidebarTrigger />

            {/* Branch Selector */}
            <BranchSelector />

            {/* Fiscal Period indicator */}
            {activeFiscalPeriod && (
              <>
                <Separator orientation="vertical" className="h-6" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSwitchSession}
                  className="gap-2 h-9"
                  title="تبديل جلسة العمل"
                >
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="font-medium">{activeFiscalPeriod.name}</span>
                  {isReadOnly ? (
                    <Badge variant="outline" className="text-[10px] gap-1 border-amber-400 text-amber-700">
                      <Lock className="h-2.5 w-2.5" /> مقفلة
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-800">
                      مفتوحة
                    </Badge>
                  )}
                  <RefreshCw className="h-3 w-3 text-muted-foreground" />
                </Button>
              </>
            )}

            <div className="flex-1" />

            <ConnectionStatusIndicator />

            <Separator orientation="vertical" className="h-6" />

            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
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
          <main className="flex-1 overflow-auto bg-background p-6">
            <SessionGuard>{children}</SessionGuard>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
