import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AccountStatement } from "@/components/AccountStatement";

export default function SupplierStatement() {
  const { id } = useParams<{ id: string }>();

  const { data: supplier, isLoading } = useQuery({
    queryKey: ["supplier-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, code, name")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) return <div className="p-6">جاري التحميل...</div>;
  if (!supplier) return <div className="p-6">المورد غير موجود</div>;

  return (
    <div className="p-6">
      <AccountStatement
        type="supplier"
        partyId={supplier.id}
        partyName={supplier.name}
        partyCode={supplier.code}
      />
    </div>
  );
}
