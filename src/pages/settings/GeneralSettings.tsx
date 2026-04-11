import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Settings, Building2, Calculator, Package, ShoppingCart, Banknote } from "lucide-react";
import { useSystemSettings, useUpdateSystemSetting, usePostableAccounts } from "@/hooks/useSystemSettings";
import { ListPageHeader } from "@/components/ListPageHeader";

interface Account {
  id: string;
  code: string;
  name: string;
}

interface Currency {
  id: string;
  code: string;
  name: string;
}

interface Warehouse {
  id: string;
  code: string;
  name: string;
}

interface Branch {
  id: string;
  code: string;
  name: string;
}

export default function GeneralSettings() {
  const { data: settings, isLoading } = useSystemSettings();
  const { data: postableAccounts } = usePostableAccounts();
  const updateSetting = useUpdateSystemSetting();
  
  const [localSettings, setLocalSettings] = useState<Record<string, string | null>>({});
  
  const { data: currencies } = useQuery({
    queryKey: ["currencies-for-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("currencies")
        .select("id, code, name")
        .eq("is_active", true)
        .order("code");
      if (error) throw error;
      return data as Currency[];
    },
  });

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses-for-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses")
        .select("id, code, name")
        .eq("is_active", true)
        .order("code");
      if (error) throw error;
      return data as Warehouse[];
    },
  });

  const { data: branches } = useQuery({
    queryKey: ["branches-for-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, code, name")
        .eq("is_active", true)
        .order("code");
      if (error) throw error;
      return data as Branch[];
    },
  });

  useEffect(() => {
    if (settings) {
      const settingsMap: Record<string, string | null> = {};
      settings.forEach((s) => {
        settingsMap[s.setting_key] = s.setting_value;
      });
      setLocalSettings(settingsMap);
    }
  }, [settings]);

  const handleChange = (key: string, value: string | null) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (key: string) => {
    try {
      await updateSetting.mutateAsync({ key, value: localSettings[key] || null });
      toast.success("تم حفظ الإعداد بنجاح");
    } catch (error: any) {
      toast.error("حدث خطأ: " + error.message);
    }
  };

  const handleSaveAll = async (category: string) => {
    const categorySettings = settings?.filter((s) => s.category === category) || [];
    try {
      for (const setting of categorySettings) {
        if (localSettings[setting.setting_key] !== setting.setting_value) {
          await updateSetting.mutateAsync({
            key: setting.setting_key,
            value: localSettings[setting.setting_key] || null,
          });
        }
      }
      toast.success("تم حفظ جميع الإعدادات بنجاح");
    } catch (error: any) {
      toast.error("حدث خطأ: " + error.message);
    }
  };

  const renderSettingInput = (setting: { setting_key: string; setting_type: string; description: string | null }) => {
    const value = localSettings[setting.setting_key] || "";
    
    switch (setting.setting_type) {
      case "account":
        return (
          <Select
            value={value || "none"}
            onValueChange={(v) => handleChange(setting.setting_key, v === "none" ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="اختر حساب..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">-- بدون --</SelectItem>
              {postableAccounts?.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.code} - {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      
      case "currency":
        return (
          <Select
            value={value || "none"}
            onValueChange={(v) => handleChange(setting.setting_key, v === "none" ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="اختر عملة..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">-- بدون --</SelectItem>
              {currencies?.map((currency) => (
                <SelectItem key={currency.id} value={currency.id}>
                  {currency.code} - {currency.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      
      case "warehouse":
        return (
          <Select
            value={value || "none"}
            onValueChange={(v) => handleChange(setting.setting_key, v === "none" ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="اختر مستودع..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">-- بدون --</SelectItem>
              {warehouses?.map((warehouse) => (
                <SelectItem key={warehouse.id} value={warehouse.id}>
                  {warehouse.code} - {warehouse.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      
      case "branch":
        return (
          <Select
            value={value || "none"}
            onValueChange={(v) => handleChange(setting.setting_key, v === "none" ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="اختر فرع..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">-- بدون --</SelectItem>
              {branches?.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.code} - {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      
      case "boolean":
        return (
          <Switch
            checked={value === "true"}
            onCheckedChange={(checked) => handleChange(setting.setting_key, checked ? "true" : "false")}
          />
        );
      
      case "number":
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => handleChange(setting.setting_key, e.target.value)}
          />
        );
      
      default:
        return (
          <Input
            value={value}
            onChange={(e) => handleChange(setting.setting_key, e.target.value)}
          />
        );
    }
  };

  const renderCategorySettings = (category: string) => {
    const categorySettings = settings?.filter((s) => s.category === category) || [];
    
    return (
      <div className="space-y-4">
        {categorySettings.map((setting) => (
          <div key={setting.setting_key} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center p-3 border rounded-lg">
            <div>
              <Label className="font-medium">{setting.description}</Label>
              <p className="text-xs text-muted-foreground">{setting.setting_key}</p>
            </div>
            <div className="md:col-span-2">
              {renderSettingInput(setting)}
            </div>
          </div>
        ))}
        <Button onClick={() => handleSaveAll(category)} disabled={updateSetting.isPending}>
          {updateSetting.isPending ? "جاري الحفظ..." : "حفظ جميع الإعدادات"}
        </Button>
      </div>
    );
  };

  if (isLoading) {
    return <div className="text-center py-8">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">الإعدادات العامة</h1>
          <p className="text-muted-foreground">
            إعدادات النظام المالي والمخزني والافتراضيات
          </p>
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">عام</span>
          </TabsTrigger>
          <TabsTrigger value="finance" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            <span className="hidden sm:inline">المالية</span>
          </TabsTrigger>
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">المخزون</span>
          </TabsTrigger>
          <TabsTrigger value="sales" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">المبيعات</span>
          </TabsTrigger>
          <TabsTrigger value="purchases" className="flex items-center gap-2">
            <Banknote className="h-4 w-4" />
            <span className="hidden sm:inline">المشتريات</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                معلومات الشركة والإعدادات العامة
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderCategorySettings("general")}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                إعدادات الحسابات المالية الافتراضية
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderCategorySettings("finance")}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                إعدادات المخزون الافتراضية
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderCategorySettings("inventory")}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                إعدادات المبيعات الافتراضية
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderCategorySettings("sales")}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="purchases">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Banknote className="h-5 w-5" />
                إعدادات المشتريات الافتراضية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground py-4">
                لا توجد إعدادات مشتريات حالياً. يمكن إضافتها لاحقاً.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
