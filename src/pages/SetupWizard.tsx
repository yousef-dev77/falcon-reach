import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Building2, MapPin, User, Check, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CompanyData {
  name: string;
  address: string;
  phone: string;
  email: string;
  taxNumber: string;
  fiscalYearStart: string;
  baseCurrency: string;
}

interface BranchData {
  name: string;
  code: string;
  address: string;
  phone: string;
}

interface AdminData {
  fullName: string;
  email: string;
  password: string;
}

const STEPS = [
  { id: 1, title: "بيانات الشركة", icon: Building2 },
  { id: 2, title: "الفرع الرئيسي", icon: MapPin },
  { id: 3, title: "مدير النظام", icon: User },
  { id: 4, title: "اكتمال", icon: Check },
];

export default function SetupWizard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  const [isSetupComplete, setIsSetupComplete] = useState(false);

  const [companyData, setCompanyData] = useState<CompanyData>({
    name: "",
    address: "",
    phone: "",
    email: "",
    taxNumber: "",
    fiscalYearStart: "01-01",
    baseCurrency: "YER",
  });

  const [branchData, setBranchData] = useState<BranchData>({
    name: "المركز الرئيسي",
    code: "HQ",
    address: "",
    phone: "",
  });

  const [adminData, setAdminData] = useState<AdminData>({
    fullName: "",
    email: "",
    password: "",
  });

  // التحقق إذا كان الإعداد الأولي قد تم
  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        const { data: branches } = await supabase
          .from('branches')
          .select('id')
          .limit(1);

        if (branches && branches.length > 0) {
          setIsSetupComplete(true);
          navigate('/');
        }
      } catch (error) {
        console.error('Error checking setup status:', error);
      } finally {
        setIsCheckingSetup(false);
      }
    };

    checkSetupStatus();
  }, [navigate]);

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);

    try {
      // 1. حفظ إعدادات الشركة
      const companySettings = [
        { setting_key: 'company_name', setting_value: companyData.name },
        { setting_key: 'company_address', setting_value: companyData.address },
        { setting_key: 'company_phone', setting_value: companyData.phone },
        { setting_key: 'company_email', setting_value: companyData.email },
        { setting_key: 'company_tax_number', setting_value: companyData.taxNumber },
        { setting_key: 'fiscal_year_start', setting_value: companyData.fiscalYearStart },
      ];

      for (const setting of companySettings) {
        await supabase
          .from('system_settings')
          .update({ setting_value: setting.setting_value })
          .eq('setting_key', setting.setting_key);
      }

      // 2. إنشاء الفرع الرئيسي
      const { data: branch, error: branchError } = await supabase
        .from('branches')
        .insert({
          name: branchData.name,
          code: branchData.code,
          address: branchData.address,
          phone: branchData.phone,
          is_active: true,
        })
        .select()
        .single();

      if (branchError) throw branchError;

      // 3. إنشاء مستودع وصندوق للفرع تلقائياً
      if (branch) {
        // إنشاء مستودع
        await supabase
          .from('warehouses')
          .insert({
            name: `مستودع ${branchData.name}`,
            code: `WH-${branchData.code}`,
            branch_id: branch.id,
            is_active: true,
          });

        // إنشاء صندوق
        await supabase
          .from('cash_boxes')
          .insert({
            name: `صندوق ${branchData.name}`,
            code: `CB-${branchData.code}`,
            branch_id: branch.id,
            is_active: true,
            opening_balance: 0,
            current_balance: 0,
          });

        // 4. تعيين المستخدم الحالي كمدير للفرع
        if (user) {
          // تحديث الملف الشخصي
          await supabase
            .from('profiles')
            .update({ full_name: adminData.fullName || user.email })
            .eq('id', user.id);

          // التأكد من وجود دور المدير
          const { data: existingRole } = await supabase
            .from('user_roles')
            .select('id')
            .eq('user_id', user.id)
            .eq('role', 'admin')
            .single();

          if (!existingRole) {
            await supabase
              .from('user_roles')
              .insert({
                user_id: user.id,
                role: 'admin',
                is_global: true,
              });
          } else {
            await supabase
              .from('user_roles')
              .update({ is_global: true })
              .eq('id', existingRole.id);
          }

          // تعيين للفرع
          await supabase
            .from('user_branch_assignments')
            .insert({
              user_id: user.id,
              branch_id: branch.id,
              is_primary: true,
            });

          // تعيين كمدير للفرع
          await supabase
            .from('branches')
            .update({ manager_id: user.id })
            .eq('id', branch.id);
        }
      }

      toast.success('تم إعداد النظام بنجاح!');
      setCurrentStep(4);

    } catch (error: any) {
      console.error('Setup error:', error);
      toast.error(error.message || 'حدث خطأ أثناء إعداد النظام');
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">جاري التحقق من حالة النظام...</p>
        </div>
      </div>
    );
  }

  if (isSetupComplete) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Building2 className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold">Falcon ERP</h1>
          </div>
          <p className="text-muted-foreground">معالج إعداد النظام</p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {STEPS.map((step) => (
              <div
                key={step.id}
                className={`flex items-center gap-2 ${
                  step.id <= currentStep ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    step.id < currentStep
                      ? 'bg-primary text-primary-foreground'
                      : step.id === currentStep
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {step.id < currentStep ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <step.icon className="h-4 w-4" />
                  )}
                </div>
                <span className="hidden sm:inline text-sm">{step.title}</span>
              </div>
            ))}
          </div>
          <Progress value={(currentStep / STEPS.length) * 100} className="h-2" />
        </div>

        {/* Content */}
        <Card>
          <CardHeader>
            <CardTitle>
              {currentStep === 1 && "بيانات الشركة"}
              {currentStep === 2 && "الفرع الرئيسي"}
              {currentStep === 3 && "مدير النظام"}
              {currentStep === 4 && "اكتمال الإعداد"}
            </CardTitle>
            <CardDescription>
              {currentStep === 1 && "أدخل المعلومات الأساسية للشركة"}
              {currentStep === 2 && "أدخل بيانات الفرع الرئيسي"}
              {currentStep === 3 && "تأكيد بيانات مدير النظام"}
              {currentStep === 4 && "تم إعداد النظام بنجاح"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Step 1: Company Data */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="company-name">اسم الشركة *</Label>
                    <Input
                      id="company-name"
                      value={companyData.name}
                      onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
                      placeholder="مثال: شركة فالكون للتجارة"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="company-address">العنوان</Label>
                    <Input
                      id="company-address"
                      value={companyData.address}
                      onChange={(e) => setCompanyData({ ...companyData, address: e.target.value })}
                      placeholder="العنوان الرئيسي للشركة"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-phone">الهاتف</Label>
                    <Input
                      id="company-phone"
                      value={companyData.phone}
                      onChange={(e) => setCompanyData({ ...companyData, phone: e.target.value })}
                      placeholder="+967 XXX XXX XXX"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-email">البريد الإلكتروني</Label>
                    <Input
                      id="company-email"
                      type="email"
                      value={companyData.email}
                      onChange={(e) => setCompanyData({ ...companyData, email: e.target.value })}
                      placeholder="info@company.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tax-number">الرقم الضريبي</Label>
                    <Input
                      id="tax-number"
                      value={companyData.taxNumber}
                      onChange={(e) => setCompanyData({ ...companyData, taxNumber: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fiscal-year">بداية السنة المالية</Label>
                    <Select
                      value={companyData.fiscalYearStart}
                      onValueChange={(value) => setCompanyData({ ...companyData, fiscalYearStart: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="01-01">1 يناير</SelectItem>
                        <SelectItem value="04-01">1 أبريل</SelectItem>
                        <SelectItem value="07-01">1 يوليو</SelectItem>
                        <SelectItem value="10-01">1 أكتوبر</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Branch Data */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="branch-name">اسم الفرع *</Label>
                    <Input
                      id="branch-name"
                      value={branchData.name}
                      onChange={(e) => setBranchData({ ...branchData, name: e.target.value })}
                      placeholder="المركز الرئيسي"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="branch-code">كود الفرع *</Label>
                    <Input
                      id="branch-code"
                      value={branchData.code}
                      onChange={(e) => setBranchData({ ...branchData, code: e.target.value.toUpperCase() })}
                      placeholder="HQ"
                      maxLength={5}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="branch-address">العنوان</Label>
                    <Input
                      id="branch-address"
                      value={branchData.address}
                      onChange={(e) => setBranchData({ ...branchData, address: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="branch-phone">الهاتف</Label>
                    <Input
                      id="branch-phone"
                      value={branchData.phone}
                      onChange={(e) => setBranchData({ ...branchData, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                  <p>سيتم إنشاء مستودع وصندوق نقدي تلقائياً لهذا الفرع.</p>
                </div>
              </div>
            )}

            {/* Step 3: Admin Data */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-name">الاسم الكامل</Label>
                  <Input
                    id="admin-name"
                    value={adminData.fullName || user?.email || ''}
                    onChange={(e) => setAdminData({ ...adminData, fullName: e.target.value })}
                    placeholder="اسم مدير النظام"
                  />
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-sm">
                  <p className="text-muted-foreground mb-2">سيتم:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>تعيينك كمدير عام للنظام بصلاحيات كاملة</li>
                    <li>تعيينك كمدير للفرع الرئيسي</li>
                    <li>إنشاء مستودع وصندوق للفرع</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Step 4: Complete */}
            {currentStep === 4 && (
              <div className="text-center py-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 mx-auto mb-4">
                  <Check className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-semibold mb-2">تم إعداد النظام بنجاح!</h3>
                <p className="text-muted-foreground mb-6">
                  يمكنك الآن البدء باستخدام النظام وإضافة المزيد من الفروع والمستخدمين
                </p>
                <Button onClick={() => navigate('/')} size="lg">
                  الذهاب للوحة التحكم
                </Button>
              </div>
            )}

            {/* Navigation */}
            {currentStep < 4 && (
              <div className="flex justify-between mt-6 pt-6 border-t">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentStep === 1}
                >
                  <ArrowRight className="ml-2 h-4 w-4" />
                  السابق
                </Button>
                {currentStep < 3 ? (
                  <Button
                    onClick={handleNext}
                    disabled={
                      (currentStep === 1 && !companyData.name) ||
                      (currentStep === 2 && (!branchData.name || !branchData.code))
                    }
                  >
                    التالي
                    <ArrowLeft className="mr-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button onClick={handleComplete} disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        جاري الإعداد...
                      </>
                    ) : (
                      <>
                        إكمال الإعداد
                        <Check className="mr-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
