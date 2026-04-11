import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Edit, Coins, Star } from "lucide-react";
import { ListPageHeader } from "@/components/ListPageHeader";

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  exchange_rate: number;
  is_base: boolean;
  is_active: boolean;
}

export default function Currencies() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    symbol: "",
    exchange_rate: "1.0",
    is_base: false,
    is_active: true,
  });

  const queryClient = useQueryClient();

  const { data: currencies, isLoading } = useQuery({
    queryKey: ["currencies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("currencies")
        .select("*")
        .order("is_base", { ascending: false })
        .order("code");
      if (error) throw error;
      return data as Currency[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: {
      code: string;
      name: string;
      symbol: string;
      exchange_rate: number;
      is_base: boolean;
      is_active: boolean;
    }) => {
      // إذا كانت العملة الأساسية، نحتاج لإزالة الأساسية من العملات الأخرى
      if (data.is_base) {
        await supabase
          .from("currencies")
          .update({ is_base: false })
          .neq("id", editingCurrency?.id || "00000000-0000-0000-0000-000000000000");
      }

      if (editingCurrency) {
        const { error } = await supabase
          .from("currencies")
          .update(data)
          .eq("id", editingCurrency.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("currencies").insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currencies"] });
      toast.success(editingCurrency ? "تم تحديث العملة بنجاح" : "تم إضافة العملة بنجاح");
      resetForm();
    },
    onError: (error) => {
      toast.error("حدث خطأ: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      symbol: "",
      exchange_rate: "1.0",
      is_base: false,
      is_active: true,
    });
    setEditingCurrency(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (currency: Currency) => {
    setEditingCurrency(currency);
    setFormData({
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      exchange_rate: currency.exchange_rate.toString(),
      is_base: currency.is_base || false,
      is_active: currency.is_active || true,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      code: formData.code.toUpperCase(),
      name: formData.name,
      symbol: formData.symbol,
      exchange_rate: parseFloat(formData.exchange_rate),
      is_base: formData.is_base,
      is_active: formData.is_active,
    });
  };

  return (
    <div className="space-y-4">
      <ListPageHeader
        title="العملات"
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "النظام المالي" },
          { label: "العملات" },
        ]}
        showAdd={false}
        showSearch={false}
      />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5" />
              قائمة العملات
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">جاري التحميل...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الرمز</TableHead>
                    <TableHead>الاسم</TableHead>
                    <TableHead>الرمز</TableHead>
                    <TableHead>سعر الصرف</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currencies?.map((currency) => (
                    <TableRow key={currency.id}>
                      <TableCell className="font-mono font-bold">
                        {currency.code}
                        {currency.is_base && (
                          <Star className="inline-block h-4 w-4 text-yellow-500 mr-1" />
                        )}
                      </TableCell>
                      <TableCell>{currency.name}</TableCell>
                      <TableCell className="text-lg">{currency.symbol}</TableCell>
                      <TableCell>{currency.exchange_rate.toFixed(4)}</TableCell>
                      <TableCell>
                        <Badge variant={currency.is_active ? "default" : "secondary"}>
                          {currency.is_active ? "نشطة" : "معطلة"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(currency)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {currencies?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        لا توجد عملات مسجلة
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
