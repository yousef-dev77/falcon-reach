import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Check, X, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ListPageHeader } from "@/components/ListPageHeader";

export default function HRVouchers() {
  const [data, setData] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [cash, setCash] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [postFor, setPostFor] = useState<any>(null);
  const [postAcc, setPostAcc] = useState<string>("");

  const fetchData = async () => {
    setLoading(true);
    const [v, b, c] = await Promise.all([
      (supabase.from("hr_payment_vouchers") as any)
        .select("*, employee:hr_employees(full_name), loan:hr_loans(loan_number, loan_type)")
        .order("created_at", { ascending: false }),
      supabase.from("bank_accounts").select("id, name").eq("is_active", true),
      supabase.from("cash_boxes").select("id, name").eq("is_active", true),
    ]);
    if (v.data) setData(v.data);
    if (b.data) setBanks(b.data);
    if (c.data) setCash(c.data);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const post = async () => {
    if (!postAcc) return toast.error("اختر حساب الصرف");
    const [kind, id] = postAcc.split(":");
    const params: any = { _voucher_id: postFor.id };
    if (kind === "bank") params._bank_account_id = id;
    else params._cash_box_id = id;
    const r = await (supabase as any).rpc("post_hr_voucher", params);
    if (r.error) toast.error(r.error.message);
    else { toast.success("تم ترحيل السند وإنشاء القيد"); setPostFor(null); setPostAcc(""); fetchData(); }
  };

  const reject = async (id: string) => {
    const reason = prompt("سبب الرفض؟") || "";
    if (!reason) return;
    const r = await (supabase as any).rpc("reject_hr_voucher", { _voucher_id: id, _reason: reason });
    if (r.error) toast.error(r.error.message);
    else { toast.success("تم رفض السند وإشعار قسم الموارد البشرية"); fetchData(); }
  };

  const statusBadge = (s: string) => {
    const m: any = {
      draft: ["بانتظار الترحيل", "outline"],
      posted: ["تم الترحيل", "default"],
      rejected: ["مرفوض", "destructive"],
    };
    const [l, v] = m[s] || [s, "secondary"];
    return <Badge variant={v as any}>{l}</Badge>;
  };

  const pendingCount = data.filter(d => d.status === "draft").length;

  return (
    <div>
      <ListPageHeader
        title="سندات صرف الموارد البشرية"
        breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "المالية", href: "/finance" }, { label: "سندات HR" }]}
        showAdd={false}
        showSearch={false}
        onRefresh={fetchData}
      />
      <div className="bg-card border border-t-0 rounded-b-lg p-4 space-y-3">
        {pendingCount > 0 && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
            🔔 لديك <strong>{pendingCount}</strong> سند صرف بانتظار الترحيل من قسم الموارد البشرية.
          </div>
        )}
        {loading ? <Loader2 className="animate-spin mx-auto" /> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>رقم السند</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>الموظف</TableHead>
              <TableHead>المرجع</TableHead>
              <TableHead>الوصف</TableHead>
              <TableHead>المبلغ</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>إجراءات</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.voucher_number}</TableCell>
                  <TableCell>{r.voucher_date}</TableCell>
                  <TableCell>{r.employee?.full_name}</TableCell>
                  <TableCell className="font-mono text-xs">{r.loan?.loan_number || "—"}</TableCell>
                  <TableCell className="text-sm">{r.description}</TableCell>
                  <TableCell className="font-bold">{Number(r.amount).toLocaleString()}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell>
                    {r.status === "draft" && (
                      <div className="flex gap-1">
                        <Button variant="default" size="sm" onClick={() => { setPostFor(r); setPostAcc(""); }}>
                          <Check className="h-4 w-4 me-1" />ترحيل
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => reject(r.id)} className="text-destructive">
                          <X className="h-4 w-4 me-1" />رفض
                        </Button>
                      </div>
                    )}
                    {r.status === "posted" && r.journal_entry_id && (
                      <Button variant="ghost" size="sm" onClick={() => window.location.href = `/finance/journal-entries?entry=${r.journal_entry_id}`}>
                        <FileText className="h-4 w-4 me-1" />القيد
                      </Button>
                    )}
                    {r.status === "rejected" && (
                      <span className="text-xs text-muted-foreground">{r.rejection_reason}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">لا توجد سندات</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={!!postFor} onOpenChange={(o) => !o && setPostFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>ترحيل سند صرف — {postFor?.voucher_number}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md bg-muted p-3 text-sm">
              <div>الموظف: <strong>{postFor?.employee?.full_name}</strong></div>
              <div>الوصف: {postFor?.description}</div>
              <div>المبلغ: <strong>{Number(postFor?.amount || 0).toLocaleString()}</strong></div>
            </div>
            <div>
              <Label>حساب الصرف *</Label>
              <Select value={postAcc} onValueChange={setPostAcc}>
                <SelectTrigger><SelectValue placeholder="اختر البنك أو الصندوق" /></SelectTrigger>
                <SelectContent>
                  {banks.map(b => <SelectItem key={b.id} value={`bank:${b.id}`}>بنك: {b.name}</SelectItem>)}
                  {cash.map(c => <SelectItem key={c.id} value={`cash:${c.id}`}>صندوق: {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                سيُنشأ قيد: مدين ذمم قروض الموظفين / دائن الحساب المختار.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPostFor(null)}>إلغاء</Button>
              <Button onClick={post}><Check className="h-4 w-4 me-1" />ترحيل</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
