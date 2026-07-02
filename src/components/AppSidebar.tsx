import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Building2, ArrowRight, LayoutGrid } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { MODULES, findModuleByPath, getModule, type ModuleDefinition } from "@/config/modules";
import { usePermissions } from "@/hooks/usePermissions";

function getActiveModuleKey(): string | null {
  return sessionStorage.getItem("active_module");
}

export function AppSidebar() {
  const { open } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { userRoles, hasPermission, hasCustomPermissions } = usePermissions();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    window.addEventListener("active-module-changed", handler);
    return () => window.removeEventListener("active-module-changed", handler);
  }, []);

  // Resolve current module: URL wins, else sessionStorage, else null
  const byPath = findModuleByPath(location.pathname);
  const stored = getActiveModuleKey();
  const active: ModuleDefinition | undefined = byPath ?? (stored ? getModule(stored) ?? undefined : undefined);

  // Sync sessionStorage if URL-derived module differs
  useEffect(() => {
    if (byPath && byPath.key !== stored) {
      sessionStorage.setItem("active_module", byPath.key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byPath?.key, tick]);

  const goApps = () => navigate("/apps");

  const items = active?.items ?? [];

  return (
    <Sidebar side="right" collapsible="icon" className="border-l border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-3">
        {active ? (
          <button
            onClick={goApps}
            className="w-full flex items-center gap-3 rounded-md p-2 hover:bg-sidebar-accent transition"
            title="العودة لكل الأنظمة"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${active.color} shrink-0`}>
              <active.icon className="h-5 w-5 text-white" />
            </div>
            {open && (
              <div className="flex-1 text-right min-w-0">
                <div className="text-xs text-sidebar-foreground/60">النظام الحالي</div>
                <div className="text-sm font-bold text-sidebar-foreground truncate">{active.name}</div>
              </div>
            )}
            {open && <ArrowRight className="h-4 w-4 text-sidebar-foreground/50 shrink-0" />}
          </button>
        ) : (
          <div className="flex items-center gap-3 p-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
              <Building2 className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            {open && (
              <div>
                <h1 className="text-sm font-bold text-sidebar-foreground">Falcon ERP</h1>
                <p className="text-[10px] text-sidebar-foreground/70">اختر نظاماً لتبدأ</p>
              </div>
            )}
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {items.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild>
                  <NavLink
                    to={item.url}
                    end={item.url === active?.home}
                    className={({ isActive }) =>
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "hover:bg-sidebar-accent"
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    {open && <span className="truncate">{item.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            {!active && open && (
              <div className="px-3 py-4 text-center text-xs text-sidebar-foreground/60">
                لم يتم اختيار نظام. انقر أدناه لعرض الأنظمة المتاحة.
              </div>
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size={open ? "sm" : "icon"}
          onClick={goApps}
          className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent"
          title="عرض كل الأنظمة"
        >
          <LayoutGrid className="h-4 w-4" />
          {open && <span>كل الأنظمة</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
