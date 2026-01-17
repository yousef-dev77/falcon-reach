import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "@/contexts/BranchContext";

export type DocumentType = 
  | 'sales_invoice' 
  | 'purchase_invoice' 
  | 'journal_entry' 
  | 'payment' 
  | 'collection' 
  | 'movement';

export function useDocumentNumber() {
  const { activeBranch } = useBranch();

  const getNextDocumentNumber = async (documentType: DocumentType): Promise<string> => {
    if (!activeBranch) {
      throw new Error('لا يوجد فرع نشط');
    }

    const { data, error } = await supabase.rpc('get_next_document_number', {
      _branch_id: activeBranch.id,
      _document_type: documentType
    });

    if (error) {
      console.error('Error getting document number:', error);
      throw error;
    }

    return data as string;
  };

  const formatDocumentNumber = (
    prefix: string, 
    branchCode: string, 
    number: number, 
    padding: number = 4
  ): string => {
    return `${prefix}-${branchCode}-${String(number).padStart(padding, '0')}`;
  };

  return {
    getNextDocumentNumber,
    formatDocumentNumber,
    activeBranchId: activeBranch?.id,
    activeBranchCode: activeBranch?.code,
  };
}
