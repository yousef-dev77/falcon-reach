import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, RefreshCw, TrendingUp, TrendingDown, ArrowUpDown } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface CurrencyForFx {
  id: string;
  code: string;
  name: string;
  exchange_rate: number;
  is_base: boolean;
}


interface Account {
  id: string;
  code: string;
  name: string;
}

interface FxAdjustment {
  id: string;
  adjustment_date: string;
  currency_id: string;
  original_amount: number;
  adjusted_amount: number;
  difference_amount: number;
  adjustment_type: string;
  notes: string;
  currency?: {
    code: string;
    name: string;
    exchange_rate: number;
  };
}

export default function FxAdjustment() {
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    currency_id: "",
    adjustment_date: new Date().toISOString().split("T")[0],
    original_amount: "0",
    new_rate: "1.0",
    gain_account_id: "",
    loss_account_id: "",
    notes: "",
  });

  const queryClient = useQueryClient();

  const { data: currencies } = useQuery({
    queryKey: ["currencies-for-fx"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("currencies")
        .select("id, code, name, exchange_rate, is_base")
        .eq("is_active", true)
        .eq("is_base", false)
        .order("code");
      if (error) throw error;
      return data as CurrencyForFx[];
    },
  });

  const { data: accounts } = useQuery({
    queryKey: ["accounts-for-fx"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, code, name")
        .eq("is_active", true)
        .in("account_type", ["revenue", "expense"])
        .order("code");
      if (error) throw error;
      return data as Account[];
    },
  });

  const { data: fxAdjustments, isLoading } = useQuery({
    queryKey: ["fx-adjustments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fx_adjustments")
        .select(`
          *,
          currency:currencies(code, name, exchange_rate)
        `)
        .order("adjustment_date", { ascending: false });
      if (error) throw error;
      return data as FxAdjustment[];
    },
  });

  const calculateDifference = () => {
    const original = parseFloat(formData.original_amount) || 0;
    const oldRate = currencies?.find((c) => c.id === formData.currency_id)?.exchange_rate || 1;
    const newRate = parseFloat(formData.new_rate) || 1;
    
    const oldValue = original * oldRate;
    const newValue = original * newRate;
    const difference = newValue - oldValue;
    
    return {
      oldValue,
      newValue,
      difference,
      isGain: difference > 0,
    };
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { difference, newValue, oldValue, isGain } = calculateDifference();
      
      const { error } = await supabase.from("fx_adjustments").insert({
        currency_id: formData.currency_id,
        adjustment_date: formData.adjustment_date,
        original_amount: parseFloat(formData.original_amount),
        adjusted_amount: newValue,
        difference_amount: Math.abs(difference),
        adjustment_type: isGain ? "gain" : "loss",
        gain_account_id: formData.gain_account_id || null,
        loss_account_id: formData.loss_account_id || null,
        notes: formData.notes,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fx-adjustments"] });
      toast.success("تم حفظ تسوية العملة بنجاح");
      resetForm();
    },
    onError: (error) => {
      toast.error("حدث خطأ: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      currency_id: "",
      adjustment_date: new Date().toISOString().split("T")[0],
      original_amount: "0",
      new_rate: "1.0",
      gain_account_id: "",
      loss_account_id: "",
      notes: "",
    });
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  const { difference, oldValue, newValue, isGain } = calculateDifference();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">تسوية فروقات العملة</h1>
            <p className="text-muted-foreground mt-1">
              إعادة تقييم الأرصدة بالعملات الأجنبية
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="ml-2 h-4 w-4" />
                تسوية جديدة
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>إنشاء تسوية فروقات العملة</DialogTitle>
                <DialogDescription>
                  حساب فرق العملة وإنشاء قيد التسوية تلقائياً
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>العملة</Label>
                    <Select
                      value={formData.currency_id}
                      onValueChange={(value) => {
                        const currency = currencies?.find((c) => c.id === value);
                        setFormData({
                          ...formData,
                          currency_id: value,
                          new_rate: currency?.exchange_rate.toString() || "1.0",
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر العملة" />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies?.map((currency) => (
                          <SelectItem key={currency.id} value={currency.id}>
                            {currency.code} - {currency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>تاريخ التسوية</Label>
                    <Input
                      type="date"
                      value={formData.adjustment_date}
                      onChange={(e) =>
                        setFormData({ ...formData, adjustment_date: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>المبلغ بالعملة الأجنبية</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.original_amount}
                      onChange={(e) =>
                        setFormData({ ...formData, original_amount: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>سعر الصرف الجديد</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={formData.new_rate}
                      onChange={(e) =>
                        setFormData({ ...formData, new_rate: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                {formData.currency_id && parseFloat(formData.original_amount) > 0 && (
                  <Card className={`${isGain ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                    <CardContent className="py-4 space-y-2">
                      <div className="flex justify-between">
                        <span>القيمة القديمة:</span>
                        <span>{oldValue.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>القيمة الجديدة:</span>
                        <span>{newValue.toLocaleString()}</span>
                      </div>
                      <hr />
                      <div className="flex justify-between items-center font-bold">
                        <span className="flex items-center gap-2">
                          {isGain ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          )}
                          {isGain ? "أرباح فروقات العملة:" : "خسائر فروقات العملة:"}
                        </span>
                        <span className={isGain ? "text-green-600" : "text-red-600"}>
                          {Math.abs(difference).toLocaleString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-2">
                  <Label>حساب أرباح فروقات العملة</Label>
                  <Select
                    value={formData.gain_account_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, gain_account_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الحساب" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts?.filter((a) => a.code.startsWith("4"))?.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>حساب خسائر فروقات العملة</Label>
                  <Select
                    value={formData.loss_account_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, loss_account_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الحساب" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts?.filter((a) => a.code.startsWith("5"))?.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>ملاحظات</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder="أي ملاحظات إضافية..."
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    إلغاء
                  </Button>
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? "جاري الحفظ..." : "حفظ التسوية"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpDown className="h-5 w-5" />
              سجل تسويات العملة
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">جاري التحميل...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>العملة</TableHead>
                    <TableHead>المبلغ الأصلي</TableHead>
                    <TableHead>المبلغ بعد التسوية</TableHead>
                    <TableHead>الفرق</TableHead>
                    <TableHead>النوع</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fxAdjustments?.map((adj) => (
                    <TableRow key={adj.id}>
                      <TableCell>
                        {format(new Date(adj.adjustment_date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="font-mono">
                        {adj.currency?.code}
                      </TableCell>
                      <TableCell>{adj.original_amount.toLocaleString()}</TableCell>
                      <TableCell>{adj.adjusted_amount.toLocaleString()}</TableCell>
                      <TableCell className={adj.adjustment_type === "gain" ? "text-green-600" : "text-red-600"}>
                        {adj.difference_amount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={adj.adjustment_type === "gain" ? "default" : "destructive"}>
                          {adj.adjustment_type === "gain" ? (
                            <>
                              <TrendingUp className="h-3 w-3 ml-1" />
                              ربح
                            </>
                          ) : (
                            <>
                              <TrendingDown className="h-3 w-3 ml-1" />
                              خسارة
                            </>
                          )}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {fxAdjustments?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        لا توجد تسويات عملة مسجلة
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
