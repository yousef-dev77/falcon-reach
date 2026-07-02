import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Download, Lock, Trash2, LayoutGrid } from "lucide-react";
import { MODULES } from "@/config/modules";
import { useInstalledModules } from "@/hooks/useInstalledModules";
import { usePermissions } from "@/hooks/usePermissions";

export default function AppLauncher() {
  const navigate = useNavigate();
  const { installed, loading, install, uninstall } = useInstalledModules();
  const { userRoles, hasPermission, hasCustomPermissions, isLoading: pLoading } = usePermissions();
  const isAdmin = userRoles.some((r) => r.role === "admin");

  const canAccess = (m: (typeof MODULES)[number]) => {
    if (m.permission && hasPermission(m.permission)) return true;
    if (!hasCustomPermissions && userRoles.some((r) => m.roles.includes(r.role))) return true;
    return false;
  };

  const open = (key: string) => {
    const mod = MODULES.find((m) => m.key === key);
    if (!mod) return;
    sessionStorage.setItem("active_module", key);
    window.dispatchEvent(new Event("active-module-changed"));
    navigate(mod.home);
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <LayoutGrid className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">الأنظمة</h1>
            <p className="text-sm text-muted-foreground">
              اختر النظام الذي تريد العمل عليه. الأدمن يستطيع تثبيت أو إزالة الأنظمة.
            </p>
          </div>
        </div>

        {(loading || pLoading) ? (
          <div className="text-center py-16 text-muted-foreground">جاري التحميل...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {MODULES.map((m) => {
              const isInstalled = installed.has(m.key);
              const allowed = canAccess(m);
              const Icon = m.icon;
              return (
                <Card
                  key={m.key}
                  className={`group relative overflow-hidden transition-all hover:shadow-lg ${
                    !isInstalled ? "opacity-90" : ""
                  } ${!allowed && isInstalled ? "opacity-60" : ""}`}
                >
                  <div className="p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className={`h-14 w-14 rounded-xl ${m.color} flex items-center justify-center shadow-sm`}>
                        <Icon className="h-7 w-7 text-white" />
                      </div>
                      {isInstalled ? (
                        <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 border-green-300">
                          <CheckCircle2 className="h-3 w-3" /> مثبّت
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">غير مثبّت</Badge>
                      )}
                    </div>

                    <div>
                      <h3 className="font-bold text-lg mb-1">{m.name}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                        {m.description}
                      </p>
                      {m.dependsOn && m.dependsOn.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          يتطلب: {m.dependsOn.map((d) => MODULES.find(x => x.key === d)?.shortName ?? d).join("، ")}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2 border-t">
                      {isInstalled ? (
                        <>
                          <Button
                            onClick={() => open(m.key)}
                            className="flex-1"
                            disabled={!allowed}
                            variant={allowed ? "default" : "outline"}
                          >
                            {allowed ? "فتح" : (<><Lock className="h-3.5 w-3.5 me-1" />لا صلاحية</>)}
                          </Button>
                          {isAdmin && m.installable !== false && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => uninstall(m.key)}
                              title="إلغاء تثبيت"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      ) : (
                        <Button
                          onClick={() => install(m.key)}
                          disabled={!isAdmin}
                          className="flex-1 gap-2"
                          variant="secondary"
                        >
                          <Download className="h-4 w-4" />
                          {isAdmin ? "تثبيت" : "التثبيت للأدمن فقط"}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
