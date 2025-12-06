-- Add new fields to accounts table
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS internal_type TEXT DEFAULT 'other',
ADD COLUMN IF NOT EXISTS account_group TEXT,
ADD COLUMN IF NOT EXISTS opening_balance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS default_tax_id UUID,
ADD COLUMN IF NOT EXISTS reconcile BOOLEAN DEFAULT false;

-- Add comment for internal_type values
COMMENT ON COLUMN public.accounts.internal_type IS 'bank, cash, receivable, payable, expense, income, equity, current_asset, fixed_asset, current_liability, long_term_liability, other';

-- Create fiscal_periods table for accounting period validation
CREATE TABLE IF NOT EXISTS public.fiscal_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on fiscal_periods
ALTER TABLE public.fiscal_periods ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for fiscal_periods
CREATE POLICY "Authenticated users can view fiscal periods" 
ON public.fiscal_periods 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage fiscal periods" 
ON public.fiscal_periods 
FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Create unique constraint on entry_number in journal_entries
ALTER TABLE public.journal_entries 
ADD CONSTRAINT journal_entries_entry_number_unique UNIQUE (entry_number);

-- Create function to check if account allows manual entry
CREATE OR REPLACE FUNCTION public.is_postable_account(account_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = account_id
    AND a.allow_manual_entry = true
    AND a.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.accounts child 
      WHERE child.parent_id = a.id
    )
  )
$$;

-- Create function to check if date is in open fiscal period
CREATE OR REPLACE FUNCTION public.is_date_in_open_period(check_date DATE)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.fiscal_periods
    WHERE check_date BETWEEN start_date AND end_date
    AND is_closed = false
  ) OR NOT EXISTS (
    SELECT 1 FROM public.fiscal_periods
  )
$$;