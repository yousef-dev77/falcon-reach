import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Plus, Wallet, Edit, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import ListPageHeader from "@/components/ListPageHeader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function CashBank() {
  const queryClient = useQueryClient();
  const [openCashDialog, setOpenCashDialog] = useState(false);
  const [openBankDialog, setOpenBankDialog] = useState(false);
  const [editingCash, setEditingCash] = useState<any>(null);
  const [editingBank, setEditingBank] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<'cash' | 'bank' | null>(null);

  // Fetch cash boxes
  const { data: cashBoxes = [], isLoading: loadingCash } = useQuery({
    queryKey: ['cash_boxes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_boxes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch bank accounts
  const { data: bankAccounts = [], isLoading: loadingBank } = useQuery({
    queryKey: ['bank_accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Add/Update cash box mutation
  const cashMutation = useMutation({
    mutationFn: async (values: any) => {
      if (editingCash) {
        const { error } = await supabase
          .from('cash_boxes')
          .update(values)
          .eq('id', editingCash.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cash_boxes')
          .insert([values]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash_boxes'] });
      toast.success(editingCash ? 'تم تحديث الصندوق بنجاح' : 'تم إضافة الصندوق بنجاح');
      setOpenCashDialog(false);
      setEditingCash(null);
    },
    onError: (error: any) => {
      toast.error('حدث خطأ: ' + error.message);
    },
  });

  // Add/Update bank account mutation
  const bankMutation = useMutation({
    mutationFn: async (values: any) => {
      if (editingBank) {
        const { error } = await supabase
          .from('bank_accounts')
          .update(values)
          .eq('id', editingBank.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('bank_accounts')
          .insert([values]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank_accounts'] });
      toast.success(editingBank ? 'تم تحديث الحساب البنكي بنجاح' : 'تم إضافة الحساب البنكي بنجاح');
      setOpenBankDialog(false);
      setEditingBank(null);
    },
    onError: (error: any) => {
      toast.error('حدث خطأ: ' + error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: 'cash' | 'bank' }) => {
      const table = type === 'cash' ? 'cash_boxes' : 'bank_accounts';
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: [variables.type === 'cash' ? 'cash_boxes' : 'bank_accounts'] 
      });
      toast.success('تم الحذف بنجاح');
      setDeleteId(null);
      setDeleteType(null);
    },
    onError: (error: any) => {
      toast.error('حدث خطأ: ' + error.message);
    },
  });

  const handleCashSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const values = {
      code: formData.get('code') as string,
      name: formData.get('name') as string,
      opening_balance: parseFloat(formData.get('opening_balance') as string) || 0,
      current_balance: parseFloat(formData.get('current_balance') as string) || 0,
    };
    cashMutation.mutate(values);
  };

  const handleBankSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const values = {
      code: formData.get('code') as string,
      bank_name: formData.get('bank_name') as string,
      account_number: formData.get('account_number') as string,
      opening_balance: parseFloat(formData.get('opening_balance') as string) || 0,
      current_balance: parseFloat(formData.get('current_balance') as string) || 0,
    };
    bankMutation.mutate(values);
  };

  const totalCashBalance = cashBoxes.reduce((sum, box) => sum + (box.current_balance || 0), 0);
  const totalBankBalance = bankAccounts.reduce((sum, acc) => sum + (acc.current_balance || 0), 0);

  return (
    <div className="space-y-4">
      <ListPageHeader
        title="الصناديق والبنوك"
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "النظام المالي" },
          { label: "الصناديق والبنوك" },
        ]}
        showAdd={false}
        showSearch={false}
      />

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Wallet className="h-6 w-6 text-primary" />
              <CardTitle>الصناديق النقدية</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCashBalance.toLocaleString()} ر.س</div>
            <p className="text-sm text-muted-foreground">الرصيد الإجمالي • {cashBoxes.length} صناديق</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-secondary" />
              <CardTitle>الحسابات البنكية</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBankBalance.toLocaleString()} ر.س</div>
            <p className="text-sm text-muted-foreground">الرصيد الإجمالي • {bankAccounts.length} حسابات</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="cash" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="cash">
            <Wallet className="h-4 w-4 ml-2" />
            الصناديق النقدية
          </TabsTrigger>
          <TabsTrigger value="bank">
            <Building2 className="h-4 w-4 ml-2" />
            الحسابات البنكية
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cash" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">قائمة الصناديق</h3>
            <Dialog open={openCashDialog} onOpenChange={setOpenCashDialog}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingCash(null)}>
                  <Plus className="ml-2 h-4 w-4" />
                  إضافة صندوق
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingCash ? 'تعديل الصندوق' : 'إضافة صندوق جديد'}</DialogTitle>
                  <DialogDescription>
                    {editingCash ? 'قم بتعديل بيانات الصندوق' : 'أدخل بيانات الصندوق النقدي'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCashSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="code">الرمز</Label>
                    <Input id="code" name="code" defaultValue={editingCash?.code} required />
                  </div>
                  <div>
                    <Label htmlFor="name">اسم الصندوق</Label>
                    <Input id="name" name="name" defaultValue={editingCash?.name} required />
                  </div>
                  <div>
                    <Label htmlFor="opening_balance">الرصيد الافتتاحي</Label>
                    <Input 
                      id="opening_balance" 
                      name="opening_balance" 
                      type="number" 
                      step="0.01"
                      defaultValue={editingCash?.opening_balance || 0} 
                      required 
                    />
                  </div>
                  <div>
                    <Label htmlFor="current_balance">الرصيد الحالي</Label>
                    <Input 
                      id="current_balance" 
                      name="current_balance" 
                      type="number" 
                      step="0.01"
                      defaultValue={editingCash?.current_balance || 0} 
                      required 
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    {editingCash ? 'تحديث' : 'إضافة'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الرمز</TableHead>
                    <TableHead>اسم الصندوق</TableHead>
                    <TableHead>الرصيد الحالي</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingCash ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        جاري التحميل...
                      </TableCell>
                    </TableRow>
                  ) : cashBoxes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        لا توجد صناديق نقدية. قم بإضافة صندوق جديد.
                      </TableCell>
                    </TableRow>
                  ) : (
                    cashBoxes.map((box) => (
                      <TableRow key={box.id}>
                        <TableCell>{box.code}</TableCell>
                        <TableCell>{box.name}</TableCell>
                        <TableCell>{box.current_balance?.toLocaleString()} ر.س</TableCell>
                        <TableCell>
                          <span className={box.is_active ? "text-green-600" : "text-red-600"}>
                            {box.is_active ? "نشط" : "غير نشط"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingCash(box);
                                setOpenCashDialog(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setDeleteId(box.id);
                                setDeleteType('cash');
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bank" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">قائمة الحسابات البنكية</h3>
            <Dialog open={openBankDialog} onOpenChange={setOpenBankDialog}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingBank(null)}>
                  <Plus className="ml-2 h-4 w-4" />
                  إضافة حساب بنكي
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingBank ? 'تعديل الحساب البنكي' : 'إضافة حساب بنكي جديد'}</DialogTitle>
                  <DialogDescription>
                    {editingBank ? 'قم بتعديل بيانات الحساب البنكي' : 'أدخل بيانات الحساب البنكي'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleBankSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="bank_code">الرمز</Label>
                    <Input id="bank_code" name="code" defaultValue={editingBank?.code} required />
                  </div>
                  <div>
                    <Label htmlFor="bank_name">اسم البنك</Label>
                    <Input id="bank_name" name="bank_name" defaultValue={editingBank?.bank_name} required />
                  </div>
                  <div>
                    <Label htmlFor="account_number">رقم الحساب</Label>
                    <Input id="account_number" name="account_number" defaultValue={editingBank?.account_number} required />
                  </div>
                  <div>
                    <Label htmlFor="bank_opening_balance">الرصيد الافتتاحي</Label>
                    <Input 
                      id="bank_opening_balance" 
                      name="opening_balance" 
                      type="number" 
                      step="0.01"
                      defaultValue={editingBank?.opening_balance || 0} 
                      required 
                    />
                  </div>
                  <div>
                    <Label htmlFor="bank_current_balance">الرصيد الحالي</Label>
                    <Input 
                      id="bank_current_balance" 
                      name="current_balance" 
                      type="number" 
                      step="0.01"
                      defaultValue={editingBank?.current_balance || 0} 
                      required 
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    {editingBank ? 'تحديث' : 'إضافة'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الرمز</TableHead>
                    <TableHead>اسم البنك</TableHead>
                    <TableHead>رقم الحساب</TableHead>
                    <TableHead>الرصيد الحالي</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingBank ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        جاري التحميل...
                      </TableCell>
                    </TableRow>
                  ) : bankAccounts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        لا توجد حسابات بنكية. قم بإضافة حساب جديد.
                      </TableCell>
                    </TableRow>
                  ) : (
                    bankAccounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell>{account.code}</TableCell>
                        <TableCell>{account.bank_name}</TableCell>
                        <TableCell>{account.account_number}</TableCell>
                        <TableCell>{account.current_balance?.toLocaleString()} ر.س</TableCell>
                        <TableCell>
                          <span className={account.is_active ? "text-green-600" : "text-red-600"}>
                            {account.is_active ? "نشط" : "غير نشط"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingBank(account);
                                setOpenBankDialog(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setDeleteId(account.id);
                                setDeleteType('bank');
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!deleteId} onOpenChange={() => { setDeleteId(null); setDeleteType(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذا {deleteType === 'cash' ? 'الصندوق' : 'الحساب البنكي'}؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId && deleteType) {
                  deleteMutation.mutate({ id: deleteId, type: deleteType });
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
