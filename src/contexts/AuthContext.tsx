import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    let resolved = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const applySession = (session: Session | null) => {
      if (!mounted) return;
      resolved = true;
      if (timeoutId) clearTimeout(timeoutId);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        applySession(session);
      }
    );

    timeoutId = setTimeout(() => {
      if (mounted && !resolved) {
        setLoading(false);
      }
    }, 5000);

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        applySession(session);
      })
      .catch((error) => {
        console.error("Error getting session:", error);
        if (mounted) {
          resolved = true;
          if (timeoutId) clearTimeout(timeoutId);
          setSession(null);
          setUser(null);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/auth");
      toast.success("تم تسجيل الخروج بنجاح");
    } catch (error) {
      toast.error("حدث خطأ أثناء تسجيل الخروج");
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
