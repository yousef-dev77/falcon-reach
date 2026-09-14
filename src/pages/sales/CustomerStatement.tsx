import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AccountStatement } from "@/components/AccountStatement";
import { ListPageHeader } from "@/components/ListPageHeader";

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
    <div>
      <ListPageHeader
        title={`كشف حساب العميل — ${customer.name}`}
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "المبيعات" },
          { label: "العملاء", href: "/sales/customers" },
          { label: "كشف الحساب" },
        ]}
        showAdd={false}
        showSearch={false}
        showRefresh={false}
      />
      <div className="bg-card border border-t-0 rounded-b-lg p-4">
        <AccountStatement
          type="customer"
          partyId={customer.id}
          partyName={customer.name}
          partyCode={customer.code}
        />
      </div>
    </div>
  );
}
