
-- Add bank_statement_id to bank_reconciliations to link reconciliation with a specific statement
ALTER TABLE public.bank_reconciliations 
ADD COLUMN IF NOT EXISTS bank_statement_id uuid REFERENCES public.bank_statements(id);

-- Add reconciliation_id to bank_statement_lines to track which reconciliation matched each line
ALTER TABLE public.bank_statement_lines 
ADD COLUMN IF NOT EXISTS reconciliation_id uuid REFERENCES public.bank_reconciliations(id);

-- Add journal_type_id to bank_statements to link statements to their journal (bank/cash)
ALTER TABLE public.bank_statements 
ADD COLUMN IF NOT EXISTS journal_type_id uuid REFERENCES public.journal_types(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bank_reconciliations_statement ON public.bank_reconciliations(bank_statement_id);
CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_reconciliation ON public.bank_statement_lines(reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_bank_statements_journal_type ON public.bank_statements(journal_type_id);
