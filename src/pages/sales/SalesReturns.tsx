import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ListPageHeader } from "@/components/ListPageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReturnFormBase } from "@/components/ReturnFormBase";
import { CheckCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function SalesReturns() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: returns = [], refetch } = useQuery({
    queryKey: ["sales-returns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_returns")
        .select("*, customers(name)")
        .order("return_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const confirmRet = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("confirm_sales_return", { _return_id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم التأكيد"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales_returns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم الحذف"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = returns.filter((r: any) =>
    !search || r.return_number?.includes(search) || r.customers?.name?.includes(search)
  );

  return (
    <div className="space-y-4">
      <ListPageHeader
        title="مرتجعات المبيعات"
        breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "المبيعات" }, { label: "مرتجعات المبيعات" }]}
        searchValue={search}
        onSearchChange={setSearch}
        onAdd={() => setOpen(true)}
        onRefresh={() => refetch()}
      />

      <div className="bg-card border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الرقم</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>العميل</TableHead>
              <TableHead>الإجمالي</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center">لا توجد مرتجعات</TableCell></TableRow>
            ) : filtered.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.return_number}</TableCell>
                <TableCell>{r.return_date}</TableCell>
                <TableCell>{r.customers?.name}</TableCell>
                <TableCell>{Number(r.total_amount).toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant={r.status === "confirmed" ? "default" : "secondary"}>
                    {r.status === "confirmed" ? "مؤكد" : "مسودة"}
                  </Badge>
                </TableCell>
                <TableCell className="flex gap-1">
                  {r.status === "draft" && (
                    <>
                      <Button size="sm" variant="default" onClick={() => confirmRet.mutate(r.id)}>
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => confirm("حذف؟") && del.mutate(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ReturnFormBase type="sales" open={open} onOpenChange={setOpen} onSaved={refetch} />
    </div>
  );
}
