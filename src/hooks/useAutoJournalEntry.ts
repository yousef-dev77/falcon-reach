import { supabase } from "@/integrations/supabase/client";

interface JournalEntryLine {
  account_id: string;
  debit_amount: number;
  credit_amount: number;
  description?: string;
}

interface CreateJournalEntryParams {
  entry_date: string;
  description: string;
  reference?: string;
  created_by: string;
  branch_id?: string;
  journal_type_id?: string;
  lines: JournalEntryLine[];
}

export async function createAutoJournalEntry(params: CreateJournalEntryParams) {
  const { entry_date, description, reference, created_by, branch_id, journal_type_id, lines } = params;

  // Validate debit = credit
  const totalDebit = lines.reduce((sum, l) => sum + (l.debit_amount || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (l.credit_amount || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error("مجموع المدين يجب أن يساوي مجموع الدائن");
  }

  // Generate entry number
  const now = new Date(entry_date);
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const { count } = await supabase
    .from("journal_entries")
    .select("*", { count: "exact", head: true })
    .like("entry_number", `JE-${yearMonth}-%`);

  const nextNum = (count || 0) + 1;
  const entry_number = `JE-${yearMonth}-${String(nextNum).padStart(4, '0')}`;

  // Create journal entry
  const { data: entry, error: entryError } = await supabase
    .from("journal_entries")
    .insert({
      entry_number,
      entry_date,
      description,
      reference,
      created_by,
      branch_id: branch_id || null,
      journal_type_id: journal_type_id || null,
      is_posted: false,
    })
    .select()
    .single();

  if (entryError) throw entryError;

  // Create journal entry lines
  const entryLines = lines.map((line) => ({
    journal_entry_id: entry.id,
    account_id: line.account_id,
    debit_amount: line.debit_amount || 0,
    credit_amount: line.credit_amount || 0,
    description: line.description || description,
  }));

  const { error: linesError } = await supabase
    .from("journal_entry_lines")
    .insert(entryLines);

  if (linesError) throw linesError;

  return entry;
}

/**
 * Get the journal type for a bank account or cash box
 */
export async function getJournalTypeForAccount(bankAccountId?: string | null, cashBoxId?: string | null) {
  if (bankAccountId) {
    const { data } = await supabase
      .from("journal_types")
      .select("id")
      .eq("bank_account_id", bankAccountId)
      .single();
    return data?.id || null;
  }
  if (cashBoxId) {
    const { data } = await supabase
      .from("journal_types")
      .select("id")
      .eq("cash_box_id", cashBoxId)
      .single();
    return data?.id || null;
  }
  return null;
}

/**
 * Get the linked GL account for a bank account or cash box
 */
export async function getLinkedAccount(bankAccountId?: string | null, cashBoxId?: string | null) {
  if (bankAccountId) {
    const { data } = await supabase
      .from("bank_accounts")
      .select("account_id")
      .eq("id", bankAccountId)
      .single();
    return data?.account_id || null;
  }
  if (cashBoxId) {
    const { data } = await supabase
      .from("cash_boxes")
      .select("account_id")
      .eq("id", cashBoxId)
      .single();
    return data?.account_id || null;
  }
  return null;
}
