import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AccountStatement } from "@/components/AccountStatement";

export default function CustomerStatement() {
  const { id } = useParams<{ id: string }>();

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, code, name")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) return <div className="p-6">جاري التحميل...</div>;
  if (!customer) return <div className="p-6">العميل غير موجود</div>;

  return (
    <div className="p-6">
      <AccountStatement
        type="customer"
        partyId={customer.id}
        partyName={customer.name}
        partyCode={customer.code}
      />
    </div>
  );
}
