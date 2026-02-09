
-- Add bank_account_id and cash_box_id to journal_types for Odoo-style linking
ALTER TABLE public.journal_types 
ADD COLUMN bank_account_id UUID REFERENCES public.bank_accounts(id),
ADD COLUMN cash_box_id UUID REFERENCES public.cash_boxes(id);

-- Add constraint: bank journal must have bank_account_id, cash journal must have cash_box_id
ALTER TABLE public.journal_types 
ADD CONSTRAINT journal_types_bank_account_check 
CHECK (
  (type_category != 'bank' OR bank_account_id IS NOT NULL) AND
  (type_category != 'cash' OR cash_box_id IS NOT NULL)
);

-- Add unique constraints: one journal per bank account, one journal per cash box
ALTER TABLE public.journal_types 
ADD CONSTRAINT journal_types_bank_account_unique UNIQUE (bank_account_id),
ADD CONSTRAINT journal_types_cash_box_unique UNIQUE (cash_box_id);

-- Add comment explaining the Odoo-style architecture
COMMENT ON COLUMN public.journal_types.bank_account_id IS 'Links bank-type journals to their bank account (Odoo: account.journal.bank_account_id)';
COMMENT ON COLUMN public.journal_types.cash_box_id IS 'Links cash-type journals to their cash box';
