-- Update RLS policies to allow authenticated users to manage data

-- Drop restrictive policies and create permissive ones for product_categories
DROP POLICY IF EXISTS "Inventory managers can manage categories" ON public.product_categories;
CREATE POLICY "Authenticated users can manage categories" 
ON public.product_categories 
FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Drop restrictive policies and create permissive ones for units_of_measure
DROP POLICY IF EXISTS "Inventory managers can manage units" ON public.units_of_measure;
CREATE POLICY "Authenticated users can manage units" 
ON public.units_of_measure 
FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Update warehouses policies
DROP POLICY IF EXISTS "Inventory managers can manage warehouses" ON public.warehouses;
CREATE POLICY "Authenticated users can manage warehouses" 
ON public.warehouses 
FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Update products policies
DROP POLICY IF EXISTS "Inventory managers can manage products" ON public.products;
CREATE POLICY "Authenticated users can manage products" 
ON public.products 
FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Update inventory_movements policies
DROP POLICY IF EXISTS "Inventory managers can manage movements" ON public.inventory_movements;
CREATE POLICY "Authenticated users can manage movements" 
ON public.inventory_movements 
FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Update branches policies
DROP POLICY IF EXISTS "Admins can manage branches" ON public.branches;
CREATE POLICY "Authenticated users can manage branches" 
ON public.branches 
FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Update suppliers policies
DROP POLICY IF EXISTS "Admins can manage suppliers" ON public.suppliers;
CREATE POLICY "Authenticated users can manage suppliers" 
ON public.suppliers 
FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Update customers policies
DROP POLICY IF EXISTS "Sales managers can manage customers" ON public.customers;
CREATE POLICY "Authenticated users can manage customers" 
ON public.customers 
FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Update accounts policies
DROP POLICY IF EXISTS "Accountants can manage accounts" ON public.accounts;
CREATE POLICY "Authenticated users can manage accounts" 
ON public.accounts 
FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Update journal_entries policies
DROP POLICY IF EXISTS "Accountants can create journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Accountants can update journal entries" ON public.journal_entries;
CREATE POLICY "Authenticated users can manage journal entries" 
ON public.journal_entries 
FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Add policies for journal_entry_lines
CREATE POLICY "Authenticated users can manage journal entry lines" 
ON public.journal_entry_lines 
FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Update collections policies
DROP POLICY IF EXISTS "Sales users can manage collections" ON public.collections;
CREATE POLICY "Authenticated users can manage collections" 
ON public.collections 
FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Update payments policies
DROP POLICY IF EXISTS "Accountants can manage payments" ON public.payments;
CREATE POLICY "Authenticated users can manage payments" 
ON public.payments 
FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Update bank_accounts policies
DROP POLICY IF EXISTS "Accountants can manage bank accounts" ON public.bank_accounts;
CREATE POLICY "Authenticated users can manage bank accounts" 
ON public.bank_accounts 
FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Update cash_boxes policies
DROP POLICY IF EXISTS "Accountants can manage cash boxes" ON public.cash_boxes;
CREATE POLICY "Authenticated users can manage cash boxes" 
ON public.cash_boxes 
FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Update cost_centers policies
DROP POLICY IF EXISTS "Accountants can manage cost centers" ON public.cost_centers;
CREATE POLICY "Authenticated users can manage cost centers" 
ON public.cost_centers 
FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Update currencies policies
DROP POLICY IF EXISTS "Admins can manage currencies" ON public.currencies;
CREATE POLICY "Authenticated users can manage currencies" 
ON public.currencies 
FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Update sales_invoices policies
DROP POLICY IF EXISTS "Sales managers can update invoices" ON public.sales_invoices;
DROP POLICY IF EXISTS "Sales users can create invoices" ON public.sales_invoices;
CREATE POLICY "Authenticated users can manage sales invoices" 
ON public.sales_invoices 
FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Add policies for sales_invoice_lines
CREATE POLICY "Authenticated users can manage sales invoice lines" 
ON public.sales_invoice_lines 
FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Update purchase_invoices policies
DROP POLICY IF EXISTS "Inventory managers can create purchase invoices" ON public.purchase_invoices;
DROP POLICY IF EXISTS "Inventory managers can update purchase invoices" ON public.purchase_invoices;
CREATE POLICY "Authenticated users can manage purchase invoices" 
ON public.purchase_invoices 
FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Add policies for purchase_invoice_lines
CREATE POLICY "Authenticated users can manage purchase invoice lines" 
ON public.purchase_invoice_lines 
FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Add policies for collection_allocations
CREATE POLICY "Authenticated users can manage collection allocations" 
ON public.collection_allocations 
FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Add policies for payment_allocations
CREATE POLICY "Authenticated users can manage payment allocations" 
ON public.payment_allocations 
FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');