import { useConnectionStatus } from "@/hooks/useConnectionStatus";
import { AlertCircle, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ConnectionStatusBanner() {
  const { status, retry } = useConnectionStatus();

  if (status === "connected") {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 px-4 py-3 flex items-center justify-center gap-3 text-sm font-medium transition-all",
        status === "checking" && "bg-yellow-500/90 text-yellow-950",
        status === "disconnected" && "bg-destructive/90 text-destructive-foreground"
      )}
    >
      {status === "checking" ? (
        <>
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>جاري التحقق من الاتصال بقاعدة البيانات...</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4" />
          <span>فشل الاتصال بقاعدة البيانات - تحقق من اتصالك بالإنترنت</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={retry}
            className="mr-2 h-7 px-3"
          >
            <RefreshCw className="h-3 w-3 ml-1" />
            إعادة المحاولة
          </Button>
        </>
      )}
    </div>
  );
}

export function ConnectionStatusIndicator() {
  const { status, retry } = useConnectionStatus();

  return (
    <div className="flex items-center gap-2">
      {status === "connected" && (
        <div className="flex items-center gap-1.5 text-green-600">
          <Wifi className="h-4 w-4" />
          <span className="text-xs">متصل</span>
        </div>
      )}
      {status === "checking" && (
        <div className="flex items-center gap-1.5 text-yellow-600">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-xs">جاري الفحص...</span>
        </div>
      )}
      {status === "disconnected" && (
        <button
          onClick={retry}
          className="flex items-center gap-1.5 text-destructive hover:underline"
        >
          <WifiOff className="h-4 w-4" />
          <span className="text-xs">غير متصل - انقر لإعادة المحاولة</span>
        </button>
      )}
    </div>
  );
}
