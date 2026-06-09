/**
 * Global Read-Only enforcement.
 *
 * عند تفعيل وضع الاستعراض فقط (سنة مالية مقفلة)، نقوم باعتراض
 * أي عملية كتابة (insert/update/delete/upsert/rpc) على عميل Supabase
 * ونرفضها مع إظهار رسالة تنبيه للمستخدم.
 *
 * كذلك يتم تعطيل أزرار الحفظ والإضافة والتعديل في كل الصفحات عبر CSS.
 */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

declare global {
  // eslint-disable-next-line no-var
  var __APP_READ_ONLY__: boolean | undefined;
}

export function setReadOnlyMode(active: boolean) {
  globalThis.__APP_READ_ONLY__ = active;
  if (typeof document !== "undefined") {
    document.documentElement.dataset.readonly = active ? "true" : "false";
  }
}

export function isReadOnlyActive(): boolean {
  return !!globalThis.__APP_READ_ONLY__;
}

let lastWarnAt = 0;
function warnBlocked(action: string, target?: string) {
  const now = Date.now();
  if (now - lastWarnAt < 1500) return;
  lastWarnAt = now;
  toast.error("غير مسموح بالتعديل", {
    description: `السنة المالية الحالية مقفلة — وضع الاستعراض فقط (${action}${target ? ` على ${target}` : ""}).`,
    duration: 4000,
  });
}

const BLOCKED_METHODS = ["insert", "update", "delete", "upsert"] as const;

// ---- Monkey-patch supabase client (once) ----
let installed = false;
export function installReadOnlyInterceptor() {
  if (installed) return;
  installed = true;

  const originalFrom = supabase.from.bind(supabase);
  (supabase as any).from = (table: string) => {
    const builder = originalFrom(table as any);
    for (const m of BLOCKED_METHODS) {
      const orig = (builder as any)[m];
      if (typeof orig !== "function") continue;
      (builder as any)[m] = function (...args: any[]) {
        if (isReadOnlyActive()) {
          warnBlocked(m, table);
          // إرجاع كائن متوافق مع PostgrestBuilder يرفض بدلاً من تنفيذ الطلب
          const error = {
            message: "READ_ONLY_MODE: السنة المالية مقفلة، التعديل غير مسموح",
            code: "READ_ONLY_MODE",
            details: "",
            hint: "",
            name: "ReadOnlyError",
          };
          const rejected: any = {
            select: () => rejected,
            single: () => rejected,
            maybeSingle: () => rejected,
            then: (resolve: any) => resolve({ data: null, error }),
            catch: () => rejected,
          };
          return rejected;
        }
        return orig.apply(this, args);
      };
    }
    return builder;
  };

  // Intercept RPC calls that might mutate
  const originalRpc = supabase.rpc.bind(supabase);
  (supabase as any).rpc = (fn: string, args?: any, opts?: any) => {
    const RPC_ALLOWLIST = new Set([
      // Safe / read-only or admin-only RPCs that should still work
      "has_role",
      "has_permission",
      "reopen_fiscal_period",
      "reclose_fiscal_period",
    ]);
    if (isReadOnlyActive() && !RPC_ALLOWLIST.has(fn)) {
      warnBlocked("rpc", fn);
      return Promise.resolve({
        data: null,
        error: {
          message: "READ_ONLY_MODE",
          code: "READ_ONLY_MODE",
          details: "",
          hint: "",
          name: "ReadOnlyError",
        },
      }) as any;
    }
    return originalRpc(fn as any, args, opts);
  };
}
