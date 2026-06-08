import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Mail, AlertTriangle, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [systemError, setSystemError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  const navigate = useNavigate();

  // Check backend connectivity with timeout
  const checkConnection = async () => {
    setConnectionStatus('checking');
    
    const timeoutMs = 8000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      // Use direct fetch to Supabase REST API with abort signal
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles?select=id&limit=1`,
        {
          method: 'GET',
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          signal: controller.signal,
        }
      );
      
      clearTimeout(timeoutId);
      
      // Any response (even 401/403) means server is reachable
      console.log('Connection check response:', response.status);
      setConnectionStatus('connected');
      setSystemError(null);
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error('Connection check failed:', error.name, error.message);
      
      if (error.name === 'AbortError') {
        // Timeout - but server might still be reachable, just slow
        // Let's be optimistic and allow login attempt
        setConnectionStatus('connected');
        setSystemError(null);
        console.log('Connection timeout - allowing login attempt');
      } else {
        setConnectionStatus('disconnected');
        setSystemError('تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت.');
      }
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  const normalizeEmail = (value: string) => value.trim().toLowerCase();

  const handleResendConfirmation = async () => {
    const e = normalizeEmail(confirmEmail || email);
    if (!e) {
      toast.error("يرجى إدخال البريد الإلكتروني أولاً");
      return;
    }

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: e,
      });
      if (error) throw error;
      toast.success("تم إرسال رسالة التفعيل مرة أخرى. تحقق من بريدك.");
    } catch (err: any) {
      toast.error(err?.message || "تعذر إرسال رسالة التفعيل");
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    setSystemError(null);
    setNeedsEmailConfirm(false);

    if (!email || !password || !fullName) {
      toast.error("الرجاء ملء جميع الحقول");
      return;
    }

    if (password.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }

    setLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/`;
      const normalizedEmail = normalizeEmail(email);

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) throw error;

      // If email confirmation is required, session will be null
      if (!data?.session) {
        setNeedsEmailConfirm(true);
        setConfirmEmail(normalizedEmail);
        toast.success("تم إنشاء الحساب. يرجى تفعيل البريد الإلكتروني ثم تسجيل الدخول.");
        return;
      }

      toast.success("تم إنشاء الحساب وتسجيل الدخول بنجاح!");
      navigate("/session");
    } catch (error: any) {
      const msg = String(error?.message || "");

      if (msg.toLowerCase().includes("paused") || msg.toLowerCase().includes("failed to fetch")) {
        setSystemError("الخدمة الخلفية متوقفة مؤقتاً (Paused). شغّلها ثم أعد المحاولة.");
        toast.error("تعذر الاتصال بالخدمة الخلفية");
      } else if (msg.includes("already registered")) {
        toast.error("البريد الإلكتروني مسجل مسبقاً");
      } else {
        toast.error(error.message || "حدث خطأ أثناء إنشاء الحساب");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    setSystemError(null);
    setNeedsEmailConfirm(false);

    if (!email || !password) {
      toast.error("الرجاء ملء جميع الحقول");
      return;
    }

    setLoading(true);
    
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Connection timeout")), 10000);
    });
    
    try {
      const normalizedEmail = normalizeEmail(email);

      const signInPromise = supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      
      // Race between signin and timeout
      const { error } = await Promise.race([signInPromise, timeoutPromise]) as any;

      if (error) throw error;

      toast.success("تم تسجيل الدخول بنجاح!");
      navigate("/session");
    } catch (error: any) {
      const msg = String(error?.message || "").toLowerCase();
      
      // Check for invalid credentials FIRST (most common error)
      if (msg.includes("invalid login credentials") || msg.includes("invalid_credentials")) {
        toast.error("البريد الإلكتروني أو كلمة المرور غير صحيحة");
      } else if (msg.includes("email not confirmed")) {
        setNeedsEmailConfirm(true);
        setConfirmEmail(normalizeEmail(email));
        toast.error("البريد الإلكتروني غير مُفعّل. فعّل حسابك ثم أعد المحاولة.");
      } else if (msg.includes("paused") || msg.includes("failed to fetch") || msg.includes("connection timeout")) {
        setSystemError("تعذر الاتصال بالخدمة الخلفية. تأكد من اتصال الإنترنت وأعد المحاولة.");
        toast.error("تعذر الاتصال بالخدمة الخلفية");
        localStorage.removeItem('sb-yetnmvmgodbvsilukbka-auth-token');
      } else {
        toast.error(error?.message || "حدث خطأ أثناء تسجيل الدخول");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">نظام فالكون ERP</CardTitle>
          <CardDescription>قم بتسجيل الدخول أو إنشاء حساب جديد</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Connection Status Indicator */}
          <div className="mb-4 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">حالة الاتصال:</span>
            <div className="flex items-center gap-2">
              {connectionStatus === 'checking' && (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-muted-foreground">جاري الفحص...</span>
                </>
              )}
              {connectionStatus === 'connected' && (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-green-600">متصل</span>
                </>
              )}
              {connectionStatus === 'disconnected' && (
                <>
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-red-600">غير متصل</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={checkConnection}
                    className="h-6 px-2"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {systemError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>تعذر تسجيل الدخول</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>{systemError}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={checkConnection}
                  className="mt-2"
                >
                  <RefreshCw className="h-4 w-4 ml-2" />
                  إعادة فحص الاتصال
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {needsEmailConfirm && (
            <Alert className="mb-4">
              <Mail className="h-4 w-4" />
              <AlertTitle>تفعيل البريد الإلكتروني مطلوب</AlertTitle>
              <AlertDescription>
                <div className="space-y-3">
                  <p>تم إنشاء الحساب لكن يلزم تفعيل البريد قبل الدخول.</p>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-email">البريد الإلكتروني</Label>
                    <Input
                      id="confirm-email"
                      type="email"
                      value={confirmEmail}
                      onChange={(e) => setConfirmEmail(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <Button type="button" variant="secondary" onClick={handleResendConfirmation} disabled={loading}>
                    إعادة إرسال رسالة التفعيل
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">تسجيل الدخول</TabsTrigger>
              <TabsTrigger value="signup">حساب جديد</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">البريد الإلكتروني</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">كلمة المرور</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">الاسم الكامل</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="أحمد محمد"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">البريد الإلكتروني</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">كلمة المرور</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    minLength={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    يجب أن تكون 6 أحرف على الأقل
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "جاري إنشاء الحساب..." : "إنشاء حساب"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
