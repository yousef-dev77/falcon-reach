-- Create expenses_revenues table
CREATE TABLE public.expenses_revenues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_number TEXT NOT NULL,
  transaction_date DATE NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('expense', 'revenue')),
  category TEXT,
  description TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  account_id UUID REFERENCES public.accounts(id),
  payment_method TEXT,
  reference TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.expenses_revenues ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "All users can view expenses_revenues" ON public.expenses_revenues
FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage expenses_revenues" ON public.expenses_revenues
FOR ALL USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Add trigger for updated_at
CREATE TRIGGER update_expenses_revenues_updated_at
BEFORE UPDATE ON public.expenses_revenues
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();