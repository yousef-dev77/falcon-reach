import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export function LoanScheduleDialog({ loan, onClose }: { loan: any | null; onClose: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!loan?.id) return;
    setLoading(true);
    (supabase.from("hr_loan_installments") as any)
      .select("*, hr_payslips(hr_payroll_runs(year, month, run_number))")
      .eq("loan_id", loan.id)
      .order("installment_no", { ascending: true })
      .then((r: any) => { setRows(r.data || []); setLoading(false); });
  }, [loan?.id]);

  const statusBadge = (s: string) => {
    const m: any = { pending: ["منتظر", "secondary"], paid: ["مسدد", "default"], partial: ["جزئي", "outline"], skipped: ["متجاوز", "destructive"] };
    const [l, v] = m[s] || [s, "secondary"];
    return <Badge variant={v as any}>{l}</Badge>;
  };

  return (
    <Dialog open={!!loan} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>جدول السداد — {loan?.loan_number}</DialogTitle>
        </DialogHeader>
        {loan && (
          <div className="grid grid-cols-4 gap-3 text-sm mb-3">
            <div><span className="text-muted-foreground">الإجمالي: </span><strong>{Number(loan.total_amount).toLocaleString()} ر.س</strong></div>
            <div><span className="text-muted-foreground">المسدد: </span><strong>{Number(loan.paid_amount).toLocaleString()}</strong></div>
            <div><span className="text-muted-foreground">المتبقي: </span><strong className="text-primary">{Number(loan.remaining_amount).toLocaleString()}</strong></div>
            <div><span className="text-muted-foreground">القسط: </span><strong>{Number(loan.installment_amount).toLocaleString()}</strong></div>
          </div>
        )}
        {loading ? <Loader2 className="animate-spin mx-auto" /> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>القسط</TableHead><TableHead>تاريخ الاستحقاق</TableHead>
              <TableHead>المبلغ</TableHead><TableHead>المسدد</TableHead>
              <TableHead>الحالة</TableHead><TableHead>تاريخ الخصم</TableHead>
              <TableHead>قسيمة الراتب</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">#{r.installment_no}</TableCell>
                  <TableCell>{format(new Date(r.due_date), "yyyy/MM/dd")}</TableCell>
                  <TableCell>{Number(r.amount).toLocaleString()}</TableCell>
                  <TableCell>{Number(r.paid_amount).toLocaleString()}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell>{r.paid_at ? format(new Date(r.paid_at), "yyyy/MM/dd") : "—"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.hr_payslips?.hr_payroll_runs ? `${r.hr_payslips.hr_payroll_runs.run_number || ""} (${r.hr_payslips.hr_payroll_runs.year}/${r.hr_payslips.hr_payroll_runs.month})` : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-4">لا يوجد جدول سداد بعد — سيتم إنشاؤه عند الاعتماد.</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
