import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ListPageHeader } from "@/components/ListPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const buckets = [
  { label: "حالي (0)", min: 0, max: 0 },
  { label: "1-30", min: 1, max: 30 },
  { label: "31-60", min: 31, max: 60 },
  { label: "61-90", min: 61, max: 90 },
  { label: "أكثر من 90", min: 91, max: 9999 },
];

function calcBuckets(items: any[], asOf: Date) {
  const map: Record<string, { name: string; total: number; b: number[] }> = {};
  for (const i of items) {
    const total = Number(i.total_amount || 0);
    const paid = Number(i.paid_amount || 0);
    const remaining = total - paid;
    if (remaining <= 0.01) continue;
    const dueDate = new Date(i.invoice_date);
    const daysLate = Math.floor((asOf.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    const partyId = i.party?.id || i.party_id;
    const partyName = i.party?.name || "غير محدد";
    if (!map[partyId]) map[partyId] = { name: partyName, total: 0, b: [0, 0, 0, 0, 0] };

    map[partyId].total += remaining;
    let idx = 0;
    if (daysLate <= 0) idx = 0;
    else if (daysLate <= 30) idx = 1;
    else if (daysLate <= 60) idx = 2;
    else if (daysLate <= 90) idx = 3;
    else idx = 4;
    map[partyId].b[idx] += remaining;
  }
  return Object.entries(map).map(([id, v]) => ({ id, ...v }));
}

export default function AgingReport() {
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));

  const { data: receivables = [], refetch: r1 } = useQuery({
    queryKey: ["aging-receivables", asOf],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales_invoices")
        .select("id, invoice_date, total_amount, paid_amount, customer_id, customers(id, name)")
        .neq("status", "draft").lte("invoice_date", asOf);
      return calcBuckets((data || []).map((d: any) => ({ ...d, party: d.customers })), new Date(asOf));
    },
  });

  const { data: payables = [], refetch: r2 } = useQuery({
    queryKey: ["aging-payables", asOf],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchase_invoices")
        .select("id, invoice_date, total_amount, paid_amount, supplier_id, suppliers(id, name)")
        .neq("status", "draft").lte("invoice_date", asOf);
      return calcBuckets((data || []).map((d: any) => ({ ...d, party: d.suppliers })), new Date(asOf));
    },
  });

  const renderTable = (rows: any[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>الطرف</TableHead>
          {buckets.map(b => <TableHead key={b.label} className="text-right">{b.label}</TableHead>)}
          <TableHead className="text-right">الإجمالي</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow><TableCell colSpan={7} className="text-center">لا توجد ذمم مستحقة</TableCell></TableRow>
        ) : rows.map(r => (
          <TableRow key={r.id}>
            <TableCell className="font-medium">{r.name}</TableCell>
            {r.b.map((v: number, i: number) => <TableCell key={i} className="text-right">{v > 0 ? v.toFixed(2) : "-"}</TableCell>)}
            <TableCell className="text-right font-bold">{r.total.toFixed(2)}</TableCell>
          </TableRow>
        ))}
        {rows.length > 0 && (
          <TableRow className="bg-muted/50 font-bold">
            <TableCell>المجموع</TableCell>
            {buckets.map((_, i) => (
              <TableCell key={i} className="text-right">
                {rows.reduce((s, r) => s + r.b[i], 0).toFixed(2)}
              </TableCell>
            ))}
            <TableCell className="text-right">
              {rows.reduce((s, r) => s + r.total, 0).toFixed(2)}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-4">
      <ListPageHeader
        title="تحليل أعمار الذمم (Aging)"
        breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "النظام المالي" }, { label: "أعمار الذمم" }]}
        showAdd={false}
        onRefresh={() => { r1(); r2(); }}
      />

      <Card>
        <CardContent className="pt-6 max-w-xs">
          <Label>كما في تاريخ</Label>
          <Input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} />
        </CardContent>
      </Card>

      <Tabs defaultValue="receivables">
        <TabsList>
          <TabsTrigger value="receivables">ذمم العملاء (مدينة)</TabsTrigger>
          <TabsTrigger value="payables">ذمم الموردين (دائنة)</TabsTrigger>
        </TabsList>
        <TabsContent value="receivables">
          <Card><CardContent className="pt-6">{renderTable(receivables)}</CardContent></Card>
        </TabsContent>
        <TabsContent value="payables">
          <Card><CardContent className="pt-6">{renderTable(payables)}</CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
