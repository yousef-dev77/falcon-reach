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
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session with timeout
    const timeoutId = setTimeout(() => {
      if (mounted && loading) {
        console.log("Auth session check timeout - clearing stale session");
        // Clear any stale session data that might be causing issues
        localStorage.removeItem('sb-yetnmvmgodbvsilukbka-auth-token');
        setSession(null);
        setUser(null);
        setLoading(false);
      }
    }, 5000);

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }
      })
      .catch((error) => {
        console.error("Error getting session:", error);
        // Clear corrupted session data on error
        if (error?.message?.includes("Failed to fetch") || error?.name === "AuthRetryableFetchError") {
          console.log("Network error - clearing stale session");
          localStorage.removeItem('sb-yetnmvmgodbvsilukbka-auth-token');
        }
        if (mounted) {
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
