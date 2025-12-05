-- Create fixed_assets table
CREATE TABLE public.fixed_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  purchase_date DATE NOT NULL,
  purchase_cost NUMERIC NOT NULL DEFAULT 0,
  useful_life_years INTEGER DEFAULT 5,
  salvage_value NUMERIC DEFAULT 0,
  depreciation_method TEXT DEFAULT 'straight_line',
  accumulated_depreciation NUMERIC DEFAULT 0,
  current_value NUMERIC DEFAULT 0,
  location TEXT,
  status TEXT DEFAULT 'active',
  account_id UUID REFERENCES public.accounts(id),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "All users can view fixed assets" ON public.fixed_assets
FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage fixed assets" ON public.fixed_assets
FOR ALL USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Add trigger for updated_at
CREATE TRIGGER update_fixed_assets_updated_at
BEFORE UPDATE ON public.fixed_assets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();