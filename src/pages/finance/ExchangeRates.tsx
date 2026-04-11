import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Edit, TrendingUp, Lock } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { ListPageHeader } from "@/components/ListPageHeader";

interface ExchangeRate {
  id: string;
  currency_id: string;
  rate_date: string;
  buy_rate: number;
  sell_rate: number;
  is_locked: boolean;
  currency?: {
    code: string;
    name: string;
  };
}

interface Currency {
  id: string;
  code: string;
  name: string;
  is_base: boolean;
}

export default function ExchangeRates() {
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<ExchangeRate | null>(null);
  const [formData, setFormData] = useState({
    currency_id: "",
    rate_date: new Date().toISOString().split("T")[0],
    buy_rate: "1.0",
    sell_rate: "1.0",
  });

  const queryClient = useQueryClient();

  const { data: currencies } = useQuery({
    queryKey: ["currencies-for-rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("currencies")
        .select("*")
        .eq("is_active", true)
        .eq("is_base", false)
        .order("code");
      if (error) throw error;
      return data as Currency[];
    },
  });

  const { data: exchangeRates, isLoading } = useQuery({
    queryKey: ["exchange-rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exchange_rates")
        .select(`
          *,
          currency:currencies(code, name)
        `)
        .order("rate_date", { ascending: false })
        .order("currency_id");
      if (error) throw error;
      return data as ExchangeRate[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingRate) {
        const { error } = await supabase
          .from("exchange_rates")
          .update(data)
          .eq("id", editingRate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("exchange_rates").insert({
          ...data,
          created_by: user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exchange-rates"] });
      toast.success(editingRate ? "تم تحديث سعر الصرف" : "تم إضافة سعر الصرف");
      resetForm();
    },
    onError: (error: any) => {
      if (error.message?.includes("مستخدم في قيود")) {
        toast.error("لا يمكن تعديل سعر صرف مستخدم في قيود مرحّلة");
      } else {
        toast.error("حدث خطأ: " + error.message);
      }
    },
  });

  const resetForm = () => {
    setFormData({
      currency_id: "",
      rate_date: new Date().toISOString().split("T")[0],
      buy_rate: "1.0",
      sell_rate: "1.0",
    });
    setEditingRate(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (rate: ExchangeRate) => {
    if (rate.is_locked) {
      toast.error("لا يمكن تعديل سعر صرف مقفل");
      return;
    }
    setEditingRate(rate);
    setFormData({
      currency_id: rate.currency_id,
      rate_date: rate.rate_date,
      buy_rate: rate.buy_rate.toString(),
      sell_rate: rate.sell_rate.toString(),
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      currency_id: formData.currency_id,
      rate_date: formData.rate_date,
      buy_rate: parseFloat(formData.buy_rate),
      sell_rate: parseFloat(formData.sell_rate),
    });
  };

  return (
    <div className="space-y-4">
      <ListPageHeader
        title="أسعار الصرف"
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "النظام المالي" },
          { label: "أسعار الصرف" },
        ]}
        showAdd={false}
        showSearch={false}
      />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              سجل أسعار الصرف
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">جاري التحميل...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>العملة</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>سعر الشراء</TableHead>
                    <TableHead>سعر البيع</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exchangeRates?.map((rate) => (
                    <TableRow key={rate.id}>
                      <TableCell className="font-mono font-bold">
                        {rate.currency?.code}
                      </TableCell>
                      <TableCell>
                        {format(new Date(rate.rate_date), "dd MMMM yyyy", {
                          locale: ar,
                        })}
                      </TableCell>
                      <TableCell>{rate.buy_rate.toFixed(4)}</TableCell>
                      <TableCell>{rate.sell_rate.toFixed(4)}</TableCell>
                      <TableCell>
                        {rate.is_locked ? (
                          <Badge variant="secondary">
                            <Lock className="h-3 w-3 ml-1" />
                            مقفل
                          </Badge>
                        ) : (
                          <Badge variant="outline">مفتوح</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(rate)}
                          disabled={rate.is_locked}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {exchangeRates?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        لا توجد أسعار صرف مسجلة
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
