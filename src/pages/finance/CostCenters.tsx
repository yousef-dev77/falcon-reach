import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, Loader2, Target, ChevronRight, FolderTree } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ListPageHeader from "@/components/ListPageHeader";
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

type CostCenter = {
  id: string;
  code: string;
  name: string;
  parent_id: string | null;
  branch_id: string | null;
  is_active: boolean;
  created_at: string;
};

type Branch = {
  id: string;
  code: string;
  name: string;
};

export default function CostCenters() {
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<CostCenter | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    parent_id: "",
    branch_id: "",
    is_active: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    const [centersRes, branchesRes] = await Promise.all([
      supabase.from("cost_centers").select("*").order("code"),
      supabase.from("branches").select("id, code, name").eq("is_active", true),
    ]);

    if (centersRes.error) {
      toast.error("خطأ في جلب مراكز التكلفة");
      console.error(centersRes.error);
    } else {
      setCostCenters(centersRes.data || []);
    }

    if (branchesRes.error) {
      console.error(branchesRes.error);
    } else {
      setBranches(branchesRes.data || []);
    }

    setLoading(false);
  };

  const generateCode = () => {
    const maxCode = costCenters.reduce((max, cc) => {
      const num = parseInt(cc.code.replace(/\D/g, '')) || 0;
      return num > max ? num : max;
    }, 0);
    return `CC-${String(maxCode + 1).padStart(3, '0')}`;
  };

  const validateForm = (): string | null => {
    if (!formData.code.trim()) return "رمز مركز التكلفة مطلوب";
    if (!formData.name.trim()) return "اسم مركز التكلفة مطلوب";
    
    // Check for duplicate code
    const duplicateCode = costCenters.find(cc => 
      cc.code === formData.code && (!editingCenter || cc.id !== editingCenter.id)
    );
    if (duplicateCode) return "رمز مركز التكلفة مستخدم مسبقاً";

    // Prevent circular parent reference
    if (editingCenter && formData.parent_id === editingCenter.id) {
      return "لا يمكن أن يكون مركز التكلفة أباً لنفسه";
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const centerData = {
      code: formData.code.trim(),
      name: formData.name.trim(),
      parent_id: formData.parent_id || null,
      branch_id: formData.branch_id || null,
      is_active: formData.is_active,
    };

    if (editingCenter) {
      const { error } = await supabase
        .from("cost_centers")
        .update(centerData)
        .eq("id", editingCenter.id);

      if (error) {
        toast.error("خطأ في تحديث مركز التكلفة");
        console.error(error);
      } else {
        toast.success("تم تحديث مركز التكلفة بنجاح");
        fetchData();
        resetForm();
      }
    } else {
      const { error } = await supabase
        .from("cost_centers")
        .insert(centerData);

      if (error) {
        toast.error("خطأ في إضافة مركز التكلفة");
        console.error(error);
      } else {
        toast.success("تم إضافة مركز التكلفة بنجاح");
        fetchData();
        resetForm();
      }
    }
  };

  const handleDelete = async (id: string) => {
    // Check if has children
    const hasChildren = costCenters.some(cc => cc.parent_id === id);
    if (hasChildren) {
      toast.error("لا يمكن حذف مركز تكلفة له مراكز فرعية");
      setDeleteId(null);
      return;
    }

    // Check if used in journal entries
    const { data: entries, error: checkError } = await supabase
      .from("journal_entries")
      .select("id")
      .eq("cost_center_id", id)
      .limit(1);

    if (checkError) {
      toast.error("خطأ في التحقق");
      return;
    }

    if (entries && entries.length > 0) {
      toast.error("لا يمكن حذف مركز التكلفة - مستخدم في قيود محاسبية");
      setDeleteId(null);
      return;
    }

    const { error } = await supabase
      .from("cost_centers")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("خطأ في حذف مركز التكلفة");
      console.error(error);
    } else {
      toast.success("تم حذف مركز التكلفة بنجاح");
      fetchData();
    }
    setDeleteId(null);
  };

  const handleEdit = (center: CostCenter) => {
    setEditingCenter(center);
    setFormData({
      code: center.code,
      name: center.name,
      parent_id: center.parent_id || "",
      branch_id: center.branch_id || "",
      is_active: center.is_active,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      parent_id: "",
      branch_id: "",
      is_active: true,
    });
    setEditingCenter(null);
    setIsDialogOpen(false);
  };

  const openAddDialog = () => {
    resetForm();
    setFormData(prev => ({ ...prev, code: generateCode() }));
    setIsDialogOpen(true);
  };

  const getParentName = (parentId: string | null) => {
    if (!parentId) return null;
    const parent = costCenters.find(cc => cc.id === parentId);
    return parent ? parent.name : null;
  };

  const getBranchName = (branchId: string | null) => {
    if (!branchId) return null;
    const branch = branches.find(b => b.id === branchId);
    return branch ? branch.name : null;
  };

  const getLevel = (center: CostCenter): number => {
    if (!center.parent_id) return 0;
    const parent = costCenters.find(cc => cc.id === center.parent_id);
    return parent ? getLevel(parent) + 1 : 0;
  };

  // Build tree structure for display
  const buildTree = (parentId: string | null = null): CostCenter[] => {
    return costCenters
      .filter(cc => cc.parent_id === parentId)
      .flatMap(cc => [cc, ...buildTree(cc.id)]);
  };

  const treeData = buildTree();

  const filteredCenters = treeData.filter(cc =>
    cc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cc.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Statistics
  const activeCenters = costCenters.filter(cc => cc.is_active).length;
  const rootCenters = costCenters.filter(cc => !cc.parent_id).length;

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
        title="مراكز التكلفة"
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "النظام المالي" },
          { label: "مراكز التكلفة" },
        ]}
        showAdd={false}
        showSearch={false}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المراكز</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{costCenters.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">مراكز نشطة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeCenters}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">مراكز رئيسية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{rootCenters}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">مراكز فرعية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary">{costCenters.length - rootCenters}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FolderTree className="h-5 w-5" />
              شجرة مراكز التكلفة
            </CardTitle>
            <Input
              placeholder="بحث..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredCenters.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>لا توجد مراكز تكلفة. ابدأ بإضافة مركز جديد.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الرمز</TableHead>
                  <TableHead>الاسم</TableHead>
                  <TableHead>المركز الأب</TableHead>
                  <TableHead>الفرع</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCenters.map((center) => {
                  const level = getLevel(center);
                  return (
                    <TableRow key={center.id}>
                      <TableCell className="font-mono">{center.code}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1" style={{ paddingRight: `${level * 20}px` }}>
                          {level > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          <Target className="h-4 w-4 text-primary" />
                          <span className="font-medium">{center.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {getParentName(center.parent_id) || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {getBranchName(center.branch_id) || "الكل"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={center.is_active ? "default" : "secondary"}>
                          {center.is_active ? "نشط" : "غير نشط"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(center)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setDeleteId(center.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف مركز التكلفة هذا؟ لا يمكن التراجع عن هذا الإجراء.
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
    </div>
  );
}
