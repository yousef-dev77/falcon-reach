import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

type ConnectionStatus = "connected" | "disconnected" | "checking";

export function useConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatus>("checking");
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkConnection = useCallback(async () => {
    setStatus("checking");
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const { error } = await supabase
        .from("accounts")
        .select("id")
        .limit(1)
        .abortSignal(controller.signal);

      clearTimeout(timeoutId);

      if (error) {
        // Check if it's a table not found error (which means connection works)
        if (error.code === "42P01" || error.code === "PGRST116") {
          setStatus("connected");
        } else if (error.message?.includes("timeout") || error.message?.includes("aborted")) {
          setStatus("disconnected");
        } else {
          // Other errors might still mean we're connected
          setStatus("connected");
        }
      } else {
        setStatus("connected");
      }
    } catch (e: any) {
      if (e?.name === "AbortError" || e?.message?.includes("timeout")) {
        setStatus("disconnected");
      } else {
        setStatus("disconnected");
      }
    }
    setLastChecked(new Date());
  }, []);

  const retry = useCallback(() => {
    checkConnection();
  }, [checkConnection]);

  useEffect(() => {
    checkConnection();

    // Check every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, [checkConnection]);

  return { status, lastChecked, retry, checkConnection };
}
