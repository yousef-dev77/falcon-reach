import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ListPageHeader } from "@/components/ListPageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function POSOrders() {
  const [rows, setRows] = useState<any[]>([]);
  const load = async () => {
    const { data } = await supabase.from("pos_orders").select("*, customers(name), pos_sessions(session_number)").order("order_date", { ascending: false }).limit(500);
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="p-4 space-y-4">
      <ListPageHeader
        title="فواتير نقاط البيع"
        breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "نقاط البيع" }, { label: "الفواتير" }]}
        showAdd={false}
        onRefresh={load}
      />
      <div className="bg-card border border-t-0 rounded-b-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>رقم الفاتورة</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>الجلسة</TableHead>
              <TableHead>العميل</TableHead>
              <TableHead>الإجمالي</TableHead>
              <TableHead>المدفوع</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-mono">{r.order_number}</TableCell>
                <TableCell>{new Date(r.order_date).toLocaleString("ar-SA")}</TableCell>
                <TableCell className="font-mono text-xs">{r.pos_sessions?.session_number}</TableCell>
                <TableCell>{r.customers?.name || "عميل نقدي"}</TableCell>
                <TableCell>{Number(r.total).toFixed(2)}</TableCell>
                <TableCell>{Number(r.paid_amount).toFixed(2)}</TableCell>
                <TableCell><Badge>{r.status}</Badge></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">لا توجد فواتير</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
