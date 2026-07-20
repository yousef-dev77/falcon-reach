import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

export function LoanScheduleDialog({ loan, onClose }: { loan: any | null; onClose: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState<any>({ amount: 0, account_id: "", date: new Date().toISOString().slice(0,10), notes: "" });

  const load = async () => {
    if (!loan?.id) return;
    setLoading(true);
    const [inst, pays, banks, cash] = await Promise.all([
      (supabase.from("hr_loan_installments") as any).select("*, hr_payslips(hr_payroll_runs(year, month, run_number))").eq("loan_id", loan.id).order("installment_no", { ascending: true }),
      (supabase.from("hr_loan_payments") as any).select("*").eq("loan_id", loan.id).order("payment_date", { ascending: false }),
      supabase.from("bank_accounts").select("id, name").eq("is_active", true),
      supabase.from("cash_boxes").select("id, name").eq("is_active", true),
    ]);
    setRows(inst.data || []);
    setPayments(pays.data || []);
    setAccounts([...(banks.data || []).map((b:any)=>({...b, kind:"بنك"})), ...(cash.data || []).map((c:any)=>({...c, kind:"صندوق"}))]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [loan?.id]);

  const recordPayment = async () => {
    if (!payForm.amount || !payForm.account_id) return toast.error("املأ المبلغ وحساب الاستلام");
    const r = await (supabase as any).rpc("record_loan_payment", {
      _loan_id: loan.id, _amount: Number(payForm.amount),
      _payment_account_id: payForm.account_id, _payment_date: payForm.date, _notes: payForm.notes || null,
    });
    if (r.error) return toast.error(r.error.message);
    toast.success("تم تسجيل السداد وإنشاء القيد المحاسبي");
    setPayOpen(false); setPayForm({ amount: 0, account_id: "", date: new Date().toISOString().slice(0,10), notes: "" });
    load();
  };

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (fromDate && r.due_date < fromDate) return false;
      if (toDate && r.due_date > toDate) return false;
      return true;
    });
  }, [rows, fromDate, toDate]);

  // Compute running remaining based on ORIGINAL order (not filtered) so filtered rows still show correct running balance
  const runningMap = useMemo(() => {
    const total = Number(loan?.total_amount || 0);
    let paidCum = 0;
    const map = new Map<string, { paidCum: number; remaining: number }>();
    for (const r of rows) {
      // "planned remaining after this installment" — if paid, use paid; else assume amount will be paid
      const consider = r.status === "paid" || r.status === "partial" ? Number(r.paid_amount || 0) : Number(r.amount || 0);
      paidCum += consider;
      map.set(r.id, { paidCum, remaining: Math.max(0, total - paidCum) });
    }
    return map;
  }, [rows, loan?.total_amount]);

  const statusBadge = (s: string) => {
    const m: any = { pending: ["منتظر", "secondary"], paid: ["مسدد", "default"], partial: ["جزئي", "outline"], skipped: ["متجاوز", "destructive"] };
    const [l, v] = m[s] || [s, "secondary"];
    return <Badge variant={v as any}>{l}</Badge>;
  };

  const totals = useMemo(() => {
    const paid = filtered.filter(r => r.status === "paid" || r.status === "partial")
      .reduce((s, r) => s + Number(r.paid_amount || 0), 0);
    const pending = filtered.filter(r => r.status === "pending")
      .reduce((s, r) => s + Number(r.amount || 0), 0);
    return { paid, pending, count: filtered.length };
  }, [filtered]);

  const clearFilter = () => { setFromDate(""); setToDate(""); };

  return (
    <Dialog open={!!loan} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>جدول السداد — {loan?.loan_number}</span>
            {loan?.status === "active" && Number(loan?.remaining_amount) > 0 && (
              <Button size="sm" onClick={() => setPayOpen(true)}><DollarSign className="h-4 w-4 me-1" />تسجيل سداد يدوي</Button>
            )}
          </DialogTitle>
        </DialogHeader>
        {loan && (
          <div className="grid grid-cols-4 gap-3 text-sm mb-3">
            <div><span className="text-muted-foreground">الإجمالي: </span><strong>{Number(loan.total_amount).toLocaleString()} ر.س</strong></div>
            <div><span className="text-muted-foreground">المسدد: </span><strong>{Number(loan.paid_amount).toLocaleString()}</strong></div>
            <div><span className="text-muted-foreground">المتبقي: </span><strong className="text-primary">{Number(loan.remaining_amount).toLocaleString()}</strong></div>
            <div><span className="text-muted-foreground">القسط: </span><strong>{Number(loan.installment_amount).toLocaleString()}</strong></div>
          </div>
        )}

        {/* Period filter */}
        <div className="flex items-end gap-2 mb-3 flex-wrap bg-muted/40 rounded-md p-3">
          <div>
            <Label className="text-xs">من تاريخ الاستحقاق</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8" />
          </div>
          <div>
            <Label className="text-xs">إلى تاريخ الاستحقاق</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8" />
          </div>
          <Button variant="ghost" size="sm" onClick={clearFilter} disabled={!fromDate && !toDate}>مسح التصفية</Button>
          <div className="ms-auto text-xs text-muted-foreground">
            <span className="me-3">أقساط: <strong>{totals.count}</strong></span>
            <span className="me-3">مخصوم فعلياً: <strong>{totals.paid.toLocaleString()}</strong></span>
            <span>متبقٍ في النطاق: <strong>{totals.pending.toLocaleString()}</strong></span>
          </div>
        </div>

        {loading ? <Loader2 className="animate-spin mx-auto" /> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>القسط</TableHead>
              <TableHead>تاريخ الاستحقاق</TableHead>
              <TableHead>المبلغ</TableHead>
              <TableHead>المسدد</TableHead>
              <TableHead>المتبقي بعد القسط</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>تاريخ الخصم</TableHead>
              <TableHead>قسيمة الراتب</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const run = runningMap.get(r.id);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">#{r.installment_no}</TableCell>
                    <TableCell>{format(new Date(r.due_date), "yyyy/MM/dd")}</TableCell>
                    <TableCell>{Number(r.amount).toLocaleString()}</TableCell>
                    <TableCell>{Number(r.paid_amount).toLocaleString()}</TableCell>
                    <TableCell className="font-semibold text-primary">
                      {run ? run.remaining.toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell>{r.paid_at ? format(new Date(r.paid_at), "yyyy/MM/dd") : "—"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.hr_payslips?.hr_payroll_runs ? `${r.hr_payslips.hr_payroll_runs.run_number || ""} (${r.hr_payslips.hr_payroll_runs.year}/${r.hr_payslips.hr_payroll_runs.month})` : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-4">
                {rows.length === 0 ? "لا يوجد جدول سداد بعد — سيتم إنشاؤه عند الاعتماد." : "لا توجد أقساط ضمن الفترة المحددة."}
              </TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
