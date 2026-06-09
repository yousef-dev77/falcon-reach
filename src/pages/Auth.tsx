import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  XCircle,
  Building2,
  Calendar,
  Lock,
  LogIn,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useBranch } from "@/contexts/BranchContext";

type Step = "credentials" | "session";

interface BranchOpt {
  id: string;
  name: string;
  code: string;
  is_primary: boolean;
  assigned: boolean;
}

interface PeriodOpt {
  id: string;
  code: string;
  name: string;
  start_date: string;
  end_date: string;
  is_closed: boolean;
}

export default function Auth() {
  const navigate = useNavigate();
  const { setActiveBranch, setActiveFiscalPeriod } = useBranch();

  const [step, setStep] = useState<Step>("credentials");

  // ---- Step 1: credentials state ----
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [systemError, setSystemError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  // ---- Step 2: session state ----
  const [signedInEmail, setSignedInEmail] = useState<string>("");
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [branches, setBranches] = useState<BranchOpt[]>([]);
  const [periods, setPeriods] = useState<PeriodOpt[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [sessionLoading, setSessionLoading] = useState(false);
  const [enteringApp, setEnteringApp] = useState(false);

  const checkConnection = async () => {
    setConnectionStatus('checking');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      await fetch(
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
      setConnectionStatus('connected');
      setSystemError(null);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        setConnectionStatus('connected');
        setSystemError(null);
      } else {
        setConnectionStatus('disconnected');
        setSystemError('تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت.');
      }
    }
  };

  useEffect(() => { checkConnection(); }, []);

  const normalizeEmail = (v: string) => v.trim().toLowerCase();

  // ---- Load branches + periods after signin ----
  const loadSessionOptions = async (userId: string) => {
    setSessionLoading(true);
    try {
      const [{ data: rolesData }, { data: allBranches }, { data: assigned }, { data: periodsData }] = await Promise.all([
        supabase.from("user_roles").select("role, is_global").eq("user_id", userId),
        supabase.from("branches").select("id, name, code").eq("is_active", true).order("code"),
        supabase.from("user_branch_assignments").select("branch_id, is_primary").eq("user_id", userId),
        supabase
          .from("fiscal_periods")
          .select("id, code, name, start_date, end_date, is_closed")
          .order("start_date", { ascending: false }),
      ]);

      const roles = (rolesData || []).map(r => r.role);
      const admin = (rolesData || []).some(r => r.role === "admin" && r.is_global);
      setUserRoles(roles);
      setIsGlobalAdmin(admin);

      // Cashier-only shortcut: skip session selection (POS doesn't need fiscal period)
      if (roles.length > 0 && roles.every(r => r === "cashier")) {
        const assignedIds = new Set((assigned || []).map(a => a.branch_id));
        const primary = (assigned || []).find(a => a.is_primary)?.branch_id
          || (assigned || [])[0]?.branch_id
          || (allBranches || [])[0]?.id;
        const b = (allBranches || []).find(x => x.id === primary);
        if (b) {
          setActiveBranch({ id: b.id, name: b.name, code: b.code, is_primary: assignedIds.has(b.id) });
          navigate("/pos/sessions", { replace: true });
          return;
        }
      }

      const assignedIds = new Set((assigned || []).map(a => a.branch_id));
      const primaryId = (assigned || []).find(a => a.is_primary)?.branch_id;

      const list: BranchOpt[] = (allBranches || []).map(b => ({
        id: b.id,
        name: b.name,
        code: b.code,
        is_primary: b.id === primaryId,
        assigned: admin || assignedIds.has(b.id),
      }));
      // Sort: assigned first, then primary first
      list.sort((a, b) => {
        if (a.assigned !== b.assigned) return a.assigned ? -1 : 1;
        if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
        return a.code.localeCompare(b.code);
      });
      setBranches(list);

      const defaultBranch = list.find(b => b.assigned && b.is_primary)
        || list.find(b => b.assigned)
        || null;
      if (defaultBranch) setSelectedBranchId(defaultBranch.id);

      const periodsList = (periodsData || []) as PeriodOpt[];
      setPeriods(periodsList);
      const defaultPeriod = periodsList.find(p => !p.is_closed) || periodsList[0];
      if (defaultPeriod) setSelectedPeriodId(defaultPeriod.id);

      setStep("session");
    } catch (err: any) {
      console.error(err);
      toast.error("تعذر تحميل بيانات الفروع والسنوات المالية");
    } finally {
      setSessionLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    const e = normalizeEmail(confirmEmail || email);
    if (!e) { toast.error("يرجى إدخال البريد الإلكتروني أولاً"); return; }
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: e });
      if (error) throw error;
      toast.success("تم إرسال رسالة التفعيل مرة أخرى. تحقق من بريدك.");
    } catch (err: any) {
      toast.error(err?.message || "تعذر إرسال رسالة التفعيل");
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSystemError(null); setNeedsEmailConfirm(false);
    if (!email || !password || !fullName) { toast.error("الرجاء ملء جميع الحقول"); return; }
    if (password.length < 6) { toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل"); return; }

    setLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/`;
      const normalizedEmail = normalizeEmail(email);
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: { emailRedirectTo: redirectUrl, data: { full_name: fullName } },
      });
      if (error) throw error;

      if (!data?.session) {
        setNeedsEmailConfirm(true);
        setConfirmEmail(normalizedEmail);
        toast.success("تم إنشاء الحساب. يرجى تفعيل البريد الإلكتروني ثم تسجيل الدخول.");
        return;
      }

      toast.success("تم إنشاء الحساب بنجاح!");
      setSignedInEmail(normalizedEmail);
      await loadSessionOptions(data.session.user.id);
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
    } finally { setLoading(false); }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSystemError(null); setNeedsEmailConfirm(false);
    if (!email || !password) { toast.error("الرجاء ملء جميع الحقول"); return; }

    setLoading(true);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Connection timeout")), 10000);
    });

    try {
      const normalizedEmail = normalizeEmail(email);
      const signInPromise = supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      const { data, error } = await Promise.race([signInPromise, timeoutPromise]) as any;
      if (error) throw error;

      toast.success("تم تسجيل الدخول بنجاح!");
      setSignedInEmail(normalizedEmail);
      await loadSessionOptions(data.session.user.id);
    } catch (error: any) {
      const msg = String(error?.message || "").toLowerCase();
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
    } finally { setLoading(false); }
  };

  const handleBack = async () => {
    await supabase.auth.signOut();
    setStep("credentials");
    setPassword("");
    setSignedInEmail("");
    setBranches([]);
    setPeriods([]);
  };

  const selectedBranch = useMemo(
    () => branches.find(b => b.id === selectedBranchId),
    [branches, selectedBranchId]
  );
  const selectedPeriod = useMemo(
    () => periods.find(p => p.id === selectedPeriodId),
    [periods, selectedPeriodId]
  );

  const handleEnterApp = () => {
    if (!selectedBranch || !selectedPeriod) return;
    if (!selectedBranch.assigned) {
      toast.error("ليس لديك صلاحية للدخول إلى هذا الفرع");
      return;
    }
    setEnteringApp(true);
    setActiveBranch({
      id: selectedBranch.id,
      name: selectedBranch.name,
      code: selectedBranch.code,
      is_primary: selectedBranch.is_primary,
    });
    setActiveFiscalPeriod(selectedPeriod);
    navigate("/", { replace: true });
  };

  // ============ RENDER ============
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">نظام فالكون ERP</CardTitle>
          <CardDescription>
            {step === "credentials"
              ? "قم بتسجيل الدخول أو إنشاء حساب جديد"
              : "اختر الفرع والسنة المالية للبدء"}
          </CardDescription>

          {/* Step indicator */}
          <div className="mt-3 flex items-center justify-center gap-2 text-xs">
            <div className={`flex items-center gap-1.5 ${step === "credentials" ? "text-primary font-medium" : "text-muted-foreground"}`}>
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] ${step === "credentials" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {step === "session" ? <CheckCircle2 className="h-3.5 w-3.5" /> : "1"}
              </div>
              <span>تسجيل الدخول</span>
            </div>
            <div className="h-px w-8 bg-border" />
            <div className={`flex items-center gap-1.5 ${step === "session" ? "text-primary font-medium" : "text-muted-foreground"}`}>
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] ${step === "session" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>2</div>
              <span>الفرع والسنة</span>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* ============ STEP 1: CREDENTIALS ============ */}
          {step === "credentials" && (
            <>
              <div className="mb-4 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">حالة الاتصال:</span>
                <div className="flex items-center gap-2">
                  {connectionStatus === 'checking' && (<><RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" /><span className="text-muted-foreground">جاري الفحص...</span></>)}
                  {connectionStatus === 'connected' && (<><CheckCircle className="h-4 w-4 text-green-500" /><span className="text-green-600">متصل</span></>)}
                  {connectionStatus === 'disconnected' && (<><XCircle className="h-4 w-4 text-red-500" /><span className="text-red-600">غير متصل</span><Button variant="ghost" size="sm" onClick={checkConnection} className="h-6 px-2"><RefreshCw className="h-3 w-3" /></Button></>)}
                </div>
              </div>

              {systemError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>تعذر تسجيل الدخول</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>{systemError}</p>
                    <Button variant="outline" size="sm" onClick={checkConnection} className="mt-2">
                      <RefreshCw className="h-4 w-4 ml-2" /> إعادة فحص الاتصال
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
                      <Input value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} disabled={loading} />
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
                      <Input id="signin-email" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading || sessionLoading} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password">كلمة المرور</Label>
                      <Input id="signin-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading || sessionLoading} />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading || sessionLoading}>
                      {loading ? "جاري تسجيل الدخول..." : sessionLoading ? "تحميل الفروع..." : (<><LogIn className="me-2 h-4 w-4" /> متابعة</>)}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">الاسم الكامل</Label>
                      <Input id="signup-name" type="text" placeholder="أحمد محمد" value={fullName} onChange={(e) => setFullName(e.target.value)} required disabled={loading} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">البريد الإلكتروني</Label>
                      <Input id="signup-email" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">كلمة المرور</Label>
                      <Input id="signup-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} minLength={6} />
                      <p className="text-xs text-muted-foreground">يجب أن تكون 6 أحرف على الأقل</p>
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "جاري إنشاء الحساب..." : "إنشاء حساب"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </>
          )}

          {/* ============ STEP 2: BRANCH + FISCAL YEAR ============ */}
          {step === "session" && (
            <div className="space-y-5">
              <div className="text-xs text-center text-muted-foreground -mt-2">
                مرحباً <span className="font-medium text-foreground">{signedInEmail}</span>
              </div>

              {branches.length === 0 ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>لا توجد فروع نشطة في النظام.</AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" /> الفرع
                    </Label>
                    <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الفرع" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map(b => (
                          <SelectItem
                            key={b.id}
                            value={b.id}
                            disabled={!b.assigned}
                          >
                            <div className="flex items-center gap-2 w-full">
                              {!b.assigned && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                              <span className={`font-medium ${!b.assigned ? "text-muted-foreground" : ""}`}>{b.name}</span>
                              <span className="text-xs text-muted-foreground">({b.code})</span>
                              {b.is_primary && b.assigned && (
                                <Badge variant="secondary" className="text-[10px] ms-auto">رئيسي</Badge>
                              )}
                              {!b.assigned && (
                                <span className="text-[10px] text-muted-foreground ms-auto">بدون صلاحية</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedBranch && !selectedBranch.assigned && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <Lock className="h-3 w-3" /> ليس لديك صلاحية الدخول لهذا الفرع
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" /> السنة المالية
                    </Label>
                    <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر السنة المالية" />
                      </SelectTrigger>
                      <SelectContent>
                        {periods.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            <div className="flex items-center gap-2 w-full">
                              <span className="font-medium">{p.name}</span>
                              {p.is_closed ? (
                                <Badge variant="outline" className="text-[10px] gap-1 ms-auto border-amber-400 text-amber-700">
                                  <Lock className="h-2.5 w-2.5" /> مقفلة
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px] ms-auto bg-green-100 text-green-800">مفتوحة</Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedPeriod?.is_closed && (
                    <Alert className="border-amber-300 bg-amber-50">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-900 text-sm">
                        <strong>وضع الاستعراض:</strong> هذه السنة المالية مقفلة، لن تتمكن من إجراء أي تعديل.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" onClick={handleBack} disabled={enteringApp}>
                      رجوع
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleEnterApp}
                      disabled={!selectedBranch?.assigned || !selectedPeriod || enteringApp}
                    >
                      {enteringApp ? "جاري الدخول..." : (<>دخول النظام <ArrowRight className="ms-2 h-4 w-4 rotate-180" /></>)}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
