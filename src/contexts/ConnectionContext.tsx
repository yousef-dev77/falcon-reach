import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

type ConnectionStatus = "connected" | "disconnected" | "checking";

interface ConnectionContextType {
  status: ConnectionStatus;
  lastChecked: Date | null;
  retry: () => void;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>("checking");
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkConnection = useCallback(async () => {
    setStatus("checking");
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      // Use a simple health check - just try to reach Supabase
      const { error } = await supabase.auth.getSession();

      clearTimeout(timeoutId);

      if (error) {
        if (error.message?.includes("timeout") || error.message?.includes("aborted") || error.message?.includes("fetch")) {
          setStatus("disconnected");
        } else {
          // Auth errors don't mean disconnected
          setStatus("connected");
        }
      } else {
        setStatus("connected");
      }
    } catch (e: any) {
      console.error("Connection check error:", e);
      setStatus("disconnected");
    }
    setLastChecked(new Date());
  }, []);

  const retry = useCallback(() => {
    checkConnection();
  }, [checkConnection]);

  useEffect(() => {
    checkConnection();

    // Check every 60 seconds instead of 30
    const interval = setInterval(checkConnection, 60000);
    return () => clearInterval(interval);
  }, [checkConnection]);

  return (
    <ConnectionContext.Provider value={{ status, lastChecked, retry }}>
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection() {
  const context = useContext(ConnectionContext);
  if (context === undefined) {
    throw new Error("useConnection must be used within a ConnectionProvider");
  }
  return context;
}
