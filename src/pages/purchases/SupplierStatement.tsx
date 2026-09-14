import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AccountStatement } from "@/components/AccountStatement";
import { ListPageHeader } from "@/components/ListPageHeader";

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
    <div>
      <ListPageHeader
        title={`كشف حساب المورد — ${supplier.name}`}
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "المشتريات" },
          { label: "الموردون", href: "/purchases/suppliers" },
          { label: "كشف الحساب" },
        ]}
        showAdd={false}
        showSearch={false}
        showRefresh={false}
      />
      <div className="bg-card border border-t-0 rounded-b-lg p-4">
        <AccountStatement
          type="supplier"
          partyId={supplier.id}
          partyName={supplier.name}
          partyCode={supplier.code}
        />
      </div>
    </div>
  );
}
