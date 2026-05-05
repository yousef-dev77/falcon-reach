import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, CheckCircle2, Trash2, Eye } from "lucide-react";
import { ListPageHeader } from "@/components/ListPageHeader";
import { useBranch } from "@/contexts/BranchContext";

type VoucherType = "receipt" | "issue" | "transfer" | "count";

const TYPE_LABELS: Record<VoucherType, string> = {
  receipt: "إذن استلام (وارد)",
  issue: "إذن صرف (صادر)",
  transfer: "تحويل بين مستودعات",
  count: "جرد المخزون",
};

const TYPE_PREFIX: Record<VoucherType, string> = {
  receipt: "GRN", issue: "GIN", transfer: "TRN", count: "CNT",
};

export default function InventoryVouchers() {
  const { type = "receipt" } = useParams<{ type: VoucherType }>();
  const voucherType = (["receipt", "issue", "transfer", "count"].includes(type) ? type : "receipt") as VoucherType;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { activeBranch } = useBranch();

  const [isOpen, setIsOpen] = useState(false);
  const [viewing, setViewing] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [header, setHeader] = useState<any>({
    voucher_date: new Date().toISOString().split("T")[0],
    warehouse_id: "", target_warehouse_id: "",
    reference: "", notes: "",
    create_journal_entry: false, counter_account_id: "",
  });
  const [lines, setLines] = useState<any[]>([{ product_id: "", quantity: "", unit_cost: "", description: "" }]);

  const { data: vouchers = [], isLoading } = useQuery({
    queryKey: ["inv_vouchers", voucherType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_vouchers")
        .select("*")
        .eq("voucher_type", voucherType)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => (await supabase.from("warehouses").select("*").eq("is_active", true)).data || [],
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products_active"],
    queryFn: async () => (await supabase.from("products").select("id,code,name,cost_price").eq("is_active", true)).data || [],
  });
  const { data: accounts = [] } = useQuery({
    queryKey: ["postable_accounts"],
    queryFn: async () => (await supabase.from("accounts").select("id,code,name").eq("allow_manual_entry", true).eq("is_active", true)).data || [],
  });

  const { data: viewLines = [] } = useQuery({
    queryKey: ["voucher_lines", viewing?.id],
    enabled: !!viewing,
    queryFn: async () => {
      const { data } = await supabase.from("inventory_voucher_lines").select("*, products(code,name)").eq("voucher_id", viewing.id);
      return data || [];
    },
  });

  const productMap = Object.fromEntries(products.map((p: any) => [p.id, p]));
  const warehouseMap = Object.fromEntries(warehouses.map((w: any) => [w.id, w]));

  const resetForm = () => {
    setHeader({
      voucher_date: new Date().toISOString().split("T")[0],
      warehouse_id: "", target_warehouse_id: "",
      reference: "", notes: "",
      create_journal_entry: false, counter_account_id: "",
    });
    setLines([{ product_id: "", quantity: "", unit_cost: "", description: "" }]);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!header.warehouse_id) throw new Error("اختر المستودع");
      if (voucherType === "transfer" && !header.target_warehouse_id) throw new Error("اختر المستودع المستلم");
      const validLines = lines.filter((l) => l.product_id && parseFloat(l.quantity) > 0);
      if (validLines.length === 0) throw new Error("أضف بنداً واحداً على الأقل");

      const voucher_number = `${TYPE_PREFIX[voucherType]}-${activeBranch?.code || "GEN"}-${Date.now().toString().slice(-6)}`;
      const { data: { user } } = await supabase.auth.getUser();

      const { data: v, error } = await supabase.from("inventory_vouchers").insert([{
        voucher_number, voucher_type: voucherType,
        voucher_date: header.voucher_date,
        warehouse_id: header.warehouse_id,
        target_warehouse_id: voucherType === "transfer" ? header.target_warehouse_id : null,
        branch_id: activeBranch?.id || null,
        reference: header.reference || null,
        notes: header.notes || null,
        create_journal_entry: header.create_journal_entry,
        counter_account_id: header.create_journal_entry && header.counter_account_id ? header.counter_account_id : null,
        created_by: user?.id,
      }]).select().single();
      if (error) throw error;

      const linesPayload = validLines.map((l) => ({
        voucher_id: v.id,
        product_id: l.product_id,
        quantity: parseFloat(l.quantity),
        unit_cost: parseFloat(l.unit_cost) || 0,
        line_total: parseFloat(l.quantity) * (parseFloat(l.unit_cost) || 0),
        description: l.description || null,
      }));
      const { error: e2 } = await supabase.from("inventory_voucher_lines").insert(linesPayload);
      if (e2) throw e2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inv_vouchers"] });
      toast.success("تم إنشاء الإذن كمسودة");
      setIsOpen(false); resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const confirmMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("confirm_inventory_voucher", { _voucher_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inv_vouchers"] });
      toast.success("تم تأكيد الإذن");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inventory_vouchers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inv_vouchers"] });
      toast.success("تم الحذف");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = vouchers.filter((v: any) =>
    v.voucher_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <ListPageHeader
        title={TYPE_LABELS[voucherType]}
        breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "النظام المخزني" }, { label: TYPE_LABELS[voucherType] }]}
        onAdd={() => { resetForm(); setIsOpen(true); }}
        addLabel={`${TYPE_LABELS[voucherType]} جديد`}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ["inv_vouchers"] })}
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="بحث برقم الإذن..."
      />

      <div className="flex gap-2 flex-wrap">
        {(Object.keys(TYPE_LABELS) as VoucherType[]).map((t) => (
          <Button key={t} variant={t === voucherType ? "default" : "outline"} size="sm" onClick={() => navigate(`/inventory/vouchers/${t}`)}>
            {TYPE_LABELS[t]}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? <div className="text-center py-12">جاري التحميل...</div> :
            filtered.length === 0 ? <div className="text-center py-12 text-muted-foreground">لا توجد إذونات</div> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الرقم</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>المستودع</TableHead>
                    {voucherType === "transfer" && <TableHead>إلى</TableHead>}
                    <TableHead>القيمة</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((v: any) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono">{v.voucher_number}</TableCell>
                      <TableCell>{v.voucher_date}</TableCell>
                      <TableCell>{warehouseMap[v.warehouse_id]?.name || "-"}</TableCell>
                      {voucherType === "transfer" && <TableCell>{warehouseMap[v.target_warehouse_id]?.name || "-"}</TableCell>}
                      <TableCell>{Number(v.total_value || 0).toFixed(2)}</TableCell>
                      <TableCell>
                        {v.status === "draft" && <Badge variant="secondary">مسودة</Badge>}
                        {v.status === "confirmed" && <Badge>مؤكد</Badge>}
                        {v.status === "cancelled" && <Badge variant="destructive">ملغي</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => setViewing(v)}><Eye className="h-4 w-4" /></Button>
                          {v.status === "draft" && (
                            <>
                              <Button size="sm" onClick={() => confirmMutation.mutate(v.id)} disabled={confirmMutation.isPending}><CheckCircle2 className="h-4 w-4" /></Button>
                              <Button size="sm" variant="outline" onClick={() => deleteMutation.mutate(v.id)}><Trash2 className="h-4 w-4" /></Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{TYPE_LABELS[voucherType]} جديد</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2"><Label>التاريخ *</Label><Input type="date" value={header.voucher_date} onChange={(e) => setHeader({ ...header, voucher_date: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>{voucherType === "transfer" ? "من مستودع *" : "المستودع *"}</Label>
                <Select value={header.warehouse_id} onValueChange={(v) => setHeader({ ...header, warehouse_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                  <SelectContent>{warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {voucherType === "transfer" && (
                <div className="space-y-2">
                  <Label>إلى مستودع *</Label>
                  <Select value={header.target_warehouse_id} onValueChange={(v) => setHeader({ ...header, target_warehouse_id: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                    <SelectContent>{warehouses.filter((w: any) => w.id !== header.warehouse_id).map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2"><Label>المرجع</Label><Input value={header.reference} onChange={(e) => setHeader({ ...header, reference: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>ملاحظات</Label><Textarea value={header.notes} onChange={(e) => setHeader({ ...header, notes: e.target.value })} /></div>

            {/* Lines */}
            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center"><Label className="text-base">البنود</Label><Button type="button" size="sm" variant="outline" onClick={() => setLines([...lines, { product_id: "", quantity: "", unit_cost: "", description: "" }])}><Plus className="h-4 w-4 me-1" />إضافة بند</Button></div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الصنف</TableHead>
                    <TableHead>{voucherType === "count" ? "الكمية المعدودة" : "الكمية"}</TableHead>
                    <TableHead>سعر الوحدة</TableHead>
                    <TableHead>الإجمالي</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="min-w-[200px]">
                        <Select value={l.product_id} onValueChange={(v) => {
                          const newLines = [...lines]; newLines[idx].product_id = v;
                          if (!newLines[idx].unit_cost && productMap[v]) newLines[idx].unit_cost = productMap[v].cost_price?.toString() || "0";
                          setLines(newLines);
                        }}>
                          <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                          <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.code} - {p.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell><Input type="number" step="0.01" value={l.quantity} onChange={(e) => { const n = [...lines]; n[idx].quantity = e.target.value; setLines(n); }} /></TableCell>
                      <TableCell><Input type="number" step="0.01" value={l.unit_cost} onChange={(e) => { const n = [...lines]; n[idx].unit_cost = e.target.value; setLines(n); }} /></TableCell>
                      <TableCell>{((parseFloat(l.quantity) || 0) * (parseFloat(l.unit_cost) || 0)).toFixed(2)}</TableCell>
                      <TableCell><Button size="sm" variant="ghost" onClick={() => setLines(lines.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Accounting */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2"><Switch checked={header.create_journal_entry} onCheckedChange={(v) => setHeader({ ...header, create_journal_entry: v })} /><Label>توليد قيد محاسبي عند التأكيد</Label></div>
              {header.create_journal_entry && (
                <div className="space-y-2">
                  <Label>الحساب المقابل *</Label>
                  <Select value={header.counter_account_id} onValueChange={(v) => setHeader({ ...header, counter_account_id: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر الحساب..." /></SelectTrigger>
                    <SelectContent>{accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">سيتم استخدام حساب المخزون الافتراضي مقابل هذا الحساب.</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsOpen(false)}>إلغاء</Button>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>{createMutation.isPending ? "جاري..." : "حفظ كمسودة"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{viewing?.voucher_number}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div><span className="text-muted-foreground">التاريخ:</span> {viewing.voucher_date}</div>
                <div><span className="text-muted-foreground">المستودع:</span> {warehouseMap[viewing.warehouse_id]?.name}</div>
                <div><span className="text-muted-foreground">القيمة:</span> {Number(viewing.total_value || 0).toFixed(2)}</div>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>الصنف</TableHead><TableHead>الكمية</TableHead>{voucherType === "count" && <><TableHead>النظام</TableHead><TableHead>الفرق</TableHead></>}<TableHead>السعر</TableHead><TableHead>الإجمالي</TableHead></TableRow></TableHeader>
                <TableBody>
                  {viewLines.map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.products?.code} - {l.products?.name}</TableCell>
                      <TableCell>{l.quantity}</TableCell>
                      {voucherType === "count" && <><TableCell>{l.system_quantity ?? "-"}</TableCell><TableCell>{l.variance ?? "-"}</TableCell></>}
                      <TableCell>{Number(l.unit_cost).toFixed(2)}</TableCell>
                      <TableCell>{Number(l.line_total).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
