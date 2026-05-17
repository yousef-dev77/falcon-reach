import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ListPageHeader } from "@/components/ListPageHeader";
import { Card } from "@/components/ui/card";

export default function POSReports() {
  const [stats, setStats] = useState({ orders: 0, total: 0, cash: 0, card: 0, transfer: 0, sessions: 0 });

  const load = async () => {
    const today = new Date().toISOString().split("T")[0];
    const { data: orders } = await supabase.from("pos_orders").select("total").gte("order_date", today).in("status", ["paid", "invoiced"]);
    const { data: pays } = await supabase.from("pos_payments").select("payment_method,amount,pos_orders!inner(order_date,status)").gte("pos_orders.order_date", today);
    const { count: sessionsCnt } = await supabase.from("pos_sessions").select("*", { count: "exact", head: true }).gte("opened_at", today);

    const total = (orders || []).reduce((s, o) => s + Number(o.total), 0);
    let cash = 0, card = 0, transfer = 0;
    (pays || []).forEach((p: any) => {
      if (p.payment_method === "cash") cash += Number(p.amount);
      else if (p.payment_method === "card") card += Number(p.amount);
      else if (p.payment_method === "transfer") transfer += Number(p.amount);
    });
    setStats({ orders: orders?.length || 0, total, cash, card, transfer, sessions: sessionsCnt || 0 });
  };
  useEffect(() => { load(); }, []);

  const cards = [
    { label: "عدد الفواتير اليوم", value: stats.orders },
    { label: "إجمالي المبيعات", value: stats.total.toFixed(2) },
    { label: "نقدي", value: stats.cash.toFixed(2) },
    { label: "شبكة / بطاقة", value: stats.card.toFixed(2) },
    { label: "تحويل", value: stats.transfer.toFixed(2) },
    { label: "عدد الجلسات", value: stats.sessions },
  ];

  return (
    <div className="p-4 space-y-4">
      <ListPageHeader
        title="تقارير نقاط البيع"
        breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "نقاط البيع" }, { label: "التقارير" }]}
        showAdd={false}
        onRefresh={load}
      />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map(c => (
          <Card key={c.label} className="p-4">
            <div className="text-sm text-muted-foreground">{c.label}</div>
            <div className="text-2xl font-bold text-primary mt-1">{c.value}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
