import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, Loader2, Calendar, Lock, Unlock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import {
import { ListPageHeader } from "@/components/ListPageHeader";
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type FiscalPeriod = {
  id: string;
  code: string;
  name: string;
  start_date: string;
  end_date: string;
  is_closed: boolean;
  created_at: string;
};

export default function FiscalPeriods() {
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<FiscalPeriod | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [closingPeriodId, setClosingPeriodId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    start_date: "",
    end_date: "",
  });

  useEffect(() => {
    fetchPeriods();
  }, []);

  const fetchPeriods = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("fiscal_periods")
      .select("*")
      .order("start_date", { ascending: false });

    if (error) {
      toast.error("خطأ في جلب الفترات المحاسبية");
      console.error(error);
    } else {
      setPeriods(data || []);
    }
    setLoading(false);
  };

  const generateCode = () => {
    const year = new Date().getFullYear();
    const existingCount = periods.filter(p => p.code.startsWith(`FY-${year}`)).length;
    return `FY-${year}-${String(existingCount + 1).padStart(2, '0')}`;
  };

  const validatePeriod = (): string | null => {
    if (!formData.code.trim()) return "رمز الفترة مطلوب";
    if (!formData.name.trim()) return "اسم الفترة مطلوب";
    if (!formData.start_date) return "تاريخ البداية مطلوب";
    if (!formData.end_date) return "تاريخ النهاية مطلوب";
    
    const startDate = new Date(formData.start_date);
    const endDate = new Date(formData.end_date);
    
    if (endDate <= startDate) {
      return "تاريخ النهاية يجب أن يكون بعد تاريخ البداية";
    }

    // Check for overlapping periods
    const overlapping = periods.find(p => {
      if (editingPeriod && p.id === editingPeriod.id) return false;
      const pStart = new Date(p.start_date);
      const pEnd = new Date(p.end_date);
      return (
        (startDate >= pStart && startDate <= pEnd) ||
        (endDate >= pStart && endDate <= pEnd) ||
        (startDate <= pStart && endDate >= pEnd)
      );
    });

    if (overlapping) {
      return `يوجد تداخل مع الفترة: ${overlapping.name}`;
    }

    // Check for duplicate code
    const duplicateCode = periods.find(p => 
      p.code === formData.code && (!editingPeriod || p.id !== editingPeriod.id)
    );
    if (duplicateCode) {
      return "رمز الفترة مستخدم مسبقاً";
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validatePeriod();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const periodData = {
      code: formData.code.trim(),
      name: formData.name.trim(),
      start_date: formData.start_date,
      end_date: formData.end_date,
    };

    if (editingPeriod) {
      // Prevent editing closed periods
      if (editingPeriod.is_closed) {
        toast.error("لا يمكن تعديل فترة مغلقة");
        return;
      }

      const { error } = await supabase
        .from("fiscal_periods")
        .update(periodData)
        .eq("id", editingPeriod.id);

      if (error) {
        toast.error("خطأ في تحديث الفترة");
        console.error(error);
      } else {
        toast.success("تم تحديث الفترة بنجاح");
        fetchPeriods();
        resetForm();
      }
    } else {
      const { error } = await supabase
        .from("fiscal_periods")
        .insert({ ...periodData, is_closed: false });

      if (error) {
        toast.error("خطأ في إضافة الفترة");
        console.error(error);
      } else {
        toast.success("تم إضافة الفترة بنجاح");
        fetchPeriods();
        resetForm();
      }
    }
  };

  const handleClosePeriod = async (periodId: string) => {
    const period = periods.find(p => p.id === periodId);
    if (!period) return;

    // Check if there are unposted entries in this period
    const { data: unpostedEntries, error: checkError } = await supabase
      .from("journal_entries")
      .select("id")
      .gte("entry_date", period.start_date)
      .lte("entry_date", period.end_date)
      .eq("is_posted", false)
      .limit(1);

    if (checkError) {
      toast.error("خطأ في التحقق من القيود");
      return;
    }

    if (unpostedEntries && unpostedEntries.length > 0) {
      toast.error("لا يمكن إغلاق الفترة - يوجد قيود غير مرحلة");
      setClosingPeriodId(null);
      return;
    }

    const { error } = await supabase
      .from("fiscal_periods")
      .update({ is_closed: true })
      .eq("id", periodId);

    if (error) {
      toast.error("خطأ في إغلاق الفترة");
      console.error(error);
    } else {
      toast.success("تم إغلاق الفترة بنجاح");
      fetchPeriods();
    }
    setClosingPeriodId(null);
  };

  const handleReopenPeriod = async (periodId: string) => {
    const { error } = await supabase
      .from("fiscal_periods")
      .update({ is_closed: false })
      .eq("id", periodId);

    if (error) {
      toast.error("خطأ في إعادة فتح الفترة");
      console.error(error);
    } else {
      toast.success("تم إعادة فتح الفترة");
      fetchPeriods();
    }
  };

  const handleDelete = async (id: string) => {
    const period = periods.find(p => p.id === id);
    if (period?.is_closed) {
      toast.error("لا يمكن حذف فترة مغلقة");
      setDeleteId(null);
      return;
    }

    // Check if there are entries in this period
    const { data: entries, error: checkError } = await supabase
      .from("journal_entries")
      .select("id")
      .gte("entry_date", period?.start_date)
      .lte("entry_date", period?.end_date)
      .limit(1);

    if (checkError) {
      toast.error("خطأ في التحقق");
      return;
    }

    if (entries && entries.length > 0) {
      toast.error("لا يمكن حذف الفترة - يوجد قيود محاسبية");
      setDeleteId(null);
      return;
    }

    const { error } = await supabase
      .from("fiscal_periods")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("خطأ في حذف الفترة");
      console.error(error);
    } else {
      toast.success("تم حذف الفترة بنجاح");
      fetchPeriods();
    }
    setDeleteId(null);
  };

  const handleEdit = (period: FiscalPeriod) => {
    if (period.is_closed) {
      toast.error("لا يمكن تعديل فترة مغلقة");
      return;
    }
    setEditingPeriod(period);
    setFormData({
      code: period.code,
      name: period.name,
      start_date: period.start_date,
      end_date: period.end_date,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      start_date: "",
      end_date: "",
    });
    setEditingPeriod(null);
    setIsDialogOpen(false);
  };

  const openAddDialog = () => {
    resetForm();
    setFormData(prev => ({
      ...prev,
      code: generateCode(),
    }));
    setIsDialogOpen(true);
  };

  const getPeriodStatus = (period: FiscalPeriod) => {
    const today = new Date();
    const startDate = new Date(period.start_date);
    const endDate = new Date(period.end_date);

    if (period.is_closed) {
      return { label: "مغلقة", variant: "secondary" as const, icon: Lock };
    }
    if (today < startDate) {
      return { label: "مستقبلية", variant: "outline" as const, icon: Calendar };
    }
    if (today > endDate) {
      return { label: "منتهية", variant: "destructive" as const, icon: AlertTriangle };
    }
    return { label: "جارية", variant: "default" as const, icon: Unlock };
  };

  // Statistics
  const openPeriods = periods.filter(p => !p.is_closed).length;
  const closedPeriods = periods.filter(p => p.is_closed).length;
  const currentPeriod = periods.find(p => {
    const today = new Date();
    const start = new Date(p.start_date);
    const end = new Date(p.end_date);
    return !p.is_closed && today >= start && today <= end;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ListPageHeader
        title="الفترات المحاسبية"
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "النظام المالي" },
          { label: "الفترات المحاسبية" },
        ]}
        showAdd={false}
        showSearch={false}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الفترات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{periods.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">فترات مفتوحة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{openPeriods}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">فترات مغلقة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{closedPeriods}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">الفترة الجارية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold">
              {currentPeriod ? currentPeriod.name : "لا توجد"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>سجل الفترات المحاسبية</CardTitle>
        </CardHeader>
        <CardContent>
          {periods.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>لا توجد فترات محاسبية. ابدأ بإضافة فترة جديدة.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الرمز</TableHead>
                  <TableHead>الاسم</TableHead>
                  <TableHead>تاريخ البداية</TableHead>
                  <TableHead>تاريخ النهاية</TableHead>
                  <TableHead>المدة</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((period) => {
                  const status = getPeriodStatus(period);
                  const StatusIcon = status.icon;
                  return (
                    <TableRow key={period.id}>
                      <TableCell className="font-mono">{period.code}</TableCell>
                      <TableCell className="font-medium">{period.name}</TableCell>
                      <TableCell>{format(new Date(period.start_date), "yyyy/MM/dd")}</TableCell>
                      <TableCell>{format(new Date(period.end_date), "yyyy/MM/dd")}</TableCell>
                      <TableCell>
                        {differenceInDays(new Date(period.end_date), new Date(period.start_date)) + 1} يوم
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className="flex items-center gap-1 w-fit">
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {!period.is_closed ? (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(period)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => setClosingPeriodId(period.id)}
                                title="إغلاق الفترة"
                              >
                                <Lock className="h-4 w-4 text-orange-500" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => setDeleteId(period.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          ) : (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleReopenPeriod(period.id)}
                              title="إعادة فتح الفترة"
                            >
                              <Unlock className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذه الفترة المحاسبية؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-destructive text-destructive-foreground"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Close Period Confirmation Dialog */}
      <AlertDialog open={!!closingPeriodId} onOpenChange={() => setClosingPeriodId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد إغلاق الفترة</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من إغلاق هذه الفترة المحاسبية؟ 
              <br />
              بعد الإغلاق لن تتمكن من إضافة أو تعديل القيود في هذه الفترة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => closingPeriodId && handleClosePeriod(closingPeriodId)}
              className="bg-orange-500 hover:bg-orange-600"
            >
              إغلاق الفترة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
