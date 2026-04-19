import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface InvoiceItem {
  id: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  paid_amount: number;
  remaining: number;
}

export interface AllocationRow {
  invoice_id: string;
  allocated_amount: number;
}

interface Props {
  invoices: InvoiceItem[];
  totalAmount: number;
  value: AllocationRow[];
  onChange: (rows: AllocationRow[]) => void;
}

/**
 * Component to distribute a payment/collection amount across multiple unpaid invoices.
 * - Auto-fills the smallest amount between (remaining on invoice) and (remaining on payment)
 * - Validates that total allocated <= totalAmount
 */
export function InvoiceAllocationTable({ invoices, totalAmount, value, onChange }: Props) {
  const [rows, setRows] = useState<Record<string, number>>({});

  // Sync external value into local state
  useEffect(() => {
    const map: Record<string, number> = {};
    value.forEach(r => { map[r.invoice_id] = r.allocated_amount; });
    setRows(map);
  }, [JSON.stringify(value)]);

  const totalAllocated = useMemo(
    () => Object.values(rows).reduce((s, v) => s + (Number(v) || 0), 0),
    [rows]
  );
  const remainingToAllocate = Math.max(0, totalAmount - totalAllocated);

  const updateRows = (newMap: Record<string, number>) => {
    setRows(newMap);
    const arr: AllocationRow[] = Object.entries(newMap)
      .filter(([_, v]) => v > 0)
      .map(([invoice_id, allocated_amount]) => ({ invoice_id, allocated_amount }));
    onChange(arr);
  };

  const toggleInvoice = (inv: InvoiceItem, checked: boolean) => {
    const newMap = { ...rows };
    if (checked) {
      // Auto-fill: min(invoice remaining, remaining to allocate)
      const fill = Math.min(inv.remaining, remainingToAllocate);
      newMap[inv.id] = Math.max(0, Number(fill.toFixed(2)));
    } else {
      delete newMap[inv.id];
    }
    updateRows(newMap);
  };

  const updateAmount = (inv: InvoiceItem, amount: number) => {
    const newMap = { ...rows };
    const capped = Math.min(amount, inv.remaining);
    if (capped <= 0) {
      delete newMap[inv.id];
    } else {
      newMap[inv.id] = Number(capped.toFixed(2));
    }
    updateRows(newMap);
  };

  const autoDistribute = () => {
    const newMap: Record<string, number> = {};
    let pool = totalAmount;
    // Sort by oldest invoice first (FIFO allocation)
    const sorted = [...invoices].sort((a, b) =>
      new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime()
    );
    for (const inv of sorted) {
      if (pool <= 0) break;
      const take = Math.min(inv.remaining, pool);
      if (take > 0) {
        newMap[inv.id] = Number(take.toFixed(2));
        pool -= take;
      }
    }
    updateRows(newMap);
  };

  const clearAll = () => updateRows({});

  if (invoices.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        لا توجد فواتير غير مسددة لهذا الطرف
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3 text-sm">
          <Badge variant="secondary">إجمالي السند: {totalAmount.toLocaleString()}</Badge>
          <Badge variant="outline">المخصص: {totalAllocated.toLocaleString()}</Badge>
          <Badge variant={remainingToAllocate > 0 ? "default" : "secondary"}>
            المتبقي: {remainingToAllocate.toLocaleString()}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={autoDistribute} disabled={!totalAmount}>
            توزيع تلقائي (الأقدم أولاً)
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={clearAll}>
            مسح الكل
          </Button>
        </div>
      </div>

      <div className="rounded-lg border max-h-72 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-card">
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>رقم الفاتورة</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>الإجمالي</TableHead>
              <TableHead>المتبقي</TableHead>
              <TableHead>المخصص</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map(inv => {
              const checked = rows[inv.id] !== undefined;
              return (
                <TableRow key={inv.id}>
                  <TableCell>
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(c) => toggleInvoice(inv, !!c)}
                    />
                  </TableCell>
                  <TableCell className="font-mono">{inv.invoice_number}</TableCell>
                  <TableCell>{new Date(inv.invoice_date).toLocaleDateString('ar-SA')}</TableCell>
                  <TableCell>{Number(inv.total_amount).toLocaleString()}</TableCell>
                  <TableCell className="font-semibold text-primary">
                    {Number(inv.remaining).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      max={inv.remaining}
                      value={rows[inv.id] ?? ""}
                      disabled={!checked}
                      className="h-8 w-28"
                      onChange={(e) => updateAmount(inv, parseFloat(e.target.value) || 0)}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
