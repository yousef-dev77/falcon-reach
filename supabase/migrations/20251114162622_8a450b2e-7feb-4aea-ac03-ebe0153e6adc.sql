-- Create enums for various types
CREATE TYPE public.account_type AS ENUM (
  'asset',
  'liability',
  'equity',
  'revenue',
  'expense'
);

CREATE TYPE public.transaction_type AS ENUM (
  'debit',
  'credit'
);

CREATE TYPE public.invoice_status AS ENUM (
  'draft',
  'confirmed',
  'paid',
  'partially_paid',
  'cancelled'
);

CREATE TYPE public.payment_method AS ENUM (
  'cash',
  'bank_transfer',
  'check',
  'credit_card'
);

CREATE TYPE public.inventory_valuation AS ENUM (
  'fifo',
  'lifo',
  'average'
);

CREATE TYPE public.app_role AS ENUM (
  'admin',
  'accountant',
  'sales_manager',
  'inventory_manager',
  'user'
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create branches table
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  manager_id UUID REFERENCES public.profiles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create cost centers table
CREATE TABLE public.cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.cost_centers(id),
  branch_id UUID REFERENCES public.branches(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create currencies table
CREATE TABLE public.currencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  exchange_rate DECIMAL(10, 4) NOT NULL DEFAULT 1.0,
  is_base BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create accounts table (Chart of Accounts)
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  account_type public.account_type NOT NULL,
  parent_id UUID REFERENCES public.accounts(id),
  level INTEGER NOT NULL DEFAULT 1,
  currency_id UUID REFERENCES public.currencies(id),
  is_active BOOLEAN DEFAULT true,
  allow_manual_entry BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create journal entries table
CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number TEXT NOT NULL UNIQUE,
  entry_date DATE NOT NULL,
  description TEXT,
  reference TEXT,
  branch_id UUID REFERENCES public.branches(id),
  cost_center_id UUID REFERENCES public.cost_centers(id),
  currency_id UUID REFERENCES public.currencies(id),
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  approved_by UUID REFERENCES auth.users(id),
  is_posted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create journal entry lines table
CREATE TABLE public.journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES public.accounts(id) NOT NULL,
  description TEXT,
  debit_amount DECIMAL(15, 2) DEFAULT 0,
  credit_amount DECIMAL(15, 2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  tax_number TEXT,
  account_id UUID REFERENCES public.accounts(id),
  credit_limit DECIMAL(15, 2) DEFAULT 0,
  payment_terms INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create suppliers table
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  tax_number TEXT,
  account_id UUID REFERENCES public.accounts(id),
  payment_terms INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create warehouses table
CREATE TABLE public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  branch_id UUID REFERENCES public.branches(id),
  address TEXT,
  manager_id UUID REFERENCES public.profiles(id),
  valuation_method public.inventory_valuation DEFAULT 'fifo',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create product categories table
CREATE TABLE public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.product_categories(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create units of measure table
CREATE TABLE public.units_of_measure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.product_categories(id),
  unit_id UUID REFERENCES public.units_of_measure(id),
  supplier_id UUID REFERENCES public.suppliers(id),
  cost_price DECIMAL(15, 2) DEFAULT 0,
  selling_price DECIMAL(15, 2) DEFAULT 0,
  min_stock_level DECIMAL(10, 2) DEFAULT 0,
  max_stock_level DECIMAL(10, 2),
  reorder_point DECIMAL(10, 2),
  track_inventory BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create inventory movements table
CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_number TEXT NOT NULL UNIQUE,
  movement_date DATE NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  warehouse_id UUID REFERENCES public.warehouses(id) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  unit_cost DECIMAL(15, 2),
  reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create sales invoices table
CREATE TABLE public.sales_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  invoice_date DATE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) NOT NULL,
  branch_id UUID REFERENCES public.branches(id),
  warehouse_id UUID REFERENCES public.warehouses(id),
  currency_id UUID REFERENCES public.currencies(id),
  subtotal DECIMAL(15, 2) DEFAULT 0,
  tax_amount DECIMAL(15, 2) DEFAULT 0,
  discount_amount DECIMAL(15, 2) DEFAULT 0,
  total_amount DECIMAL(15, 2) DEFAULT 0,
  paid_amount DECIMAL(15, 2) DEFAULT 0,
  status public.invoice_status DEFAULT 'draft',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create sales invoice lines table
CREATE TABLE public.sales_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.sales_invoices(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  description TEXT,
  quantity DECIMAL(10, 2) NOT NULL,
  unit_price DECIMAL(15, 2) NOT NULL,
  discount_percent DECIMAL(5, 2) DEFAULT 0,
  tax_percent DECIMAL(5, 2) DEFAULT 0,
  line_total DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create purchase invoices table
CREATE TABLE public.purchase_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  invoice_date DATE NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id) NOT NULL,
  branch_id UUID REFERENCES public.branches(id),
  warehouse_id UUID REFERENCES public.warehouses(id),
  currency_id UUID REFERENCES public.currencies(id),
  subtotal DECIMAL(15, 2) DEFAULT 0,
  tax_amount DECIMAL(15, 2) DEFAULT 0,
  discount_amount DECIMAL(15, 2) DEFAULT 0,
  total_amount DECIMAL(15, 2) DEFAULT 0,
  paid_amount DECIMAL(15, 2) DEFAULT 0,
  status public.invoice_status DEFAULT 'draft',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create purchase invoice lines table
CREATE TABLE public.purchase_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.purchase_invoices(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  description TEXT,
  quantity DECIMAL(10, 2) NOT NULL,
  unit_price DECIMAL(15, 2) NOT NULL,
  discount_percent DECIMAL(5, 2) DEFAULT 0,
  tax_percent DECIMAL(5, 2) DEFAULT 0,
  line_total DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create cash boxes table
CREATE TABLE public.cash_boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  branch_id UUID REFERENCES public.branches(id),
  account_id UUID REFERENCES public.accounts(id),
  opening_balance DECIMAL(15, 2) DEFAULT 0,
  current_balance DECIMAL(15, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create bank accounts table
CREATE TABLE public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  branch_id UUID REFERENCES public.branches(id),
  account_id UUID REFERENCES public.accounts(id),
  currency_id UUID REFERENCES public.currencies(id),
  opening_balance DECIMAL(15, 2) DEFAULT 0,
  current_balance DECIMAL(15, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create collections table (سندات القبض)
CREATE TABLE public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT NOT NULL UNIQUE,
  receipt_date DATE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) NOT NULL,
  payment_method public.payment_method NOT NULL,
  cash_box_id UUID REFERENCES public.cash_boxes(id),
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  amount DECIMAL(15, 2) NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create collection allocations table
CREATE TABLE public.collection_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES public.collections(id) ON DELETE CASCADE NOT NULL,
  invoice_id UUID REFERENCES public.sales_invoices(id) NOT NULL,
  allocated_amount DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create payments table (سندات الصرف)
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number TEXT NOT NULL UNIQUE,
  payment_date DATE NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id) NOT NULL,
  payment_method public.payment_method NOT NULL,
  cash_box_id UUID REFERENCES public.cash_boxes(id),
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  amount DECIMAL(15, 2) NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create payment allocations table
CREATE TABLE public.payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE NOT NULL,
  invoice_id UUID REFERENCES public.purchase_invoices(id) NOT NULL,
  allocated_amount DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create audit logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create security definer function to check user roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
    AND role = _role
  )
$$;

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'مستخدم جديد'),
    NEW.email
  );
  
  -- Assign default role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cost_centers_updated_at BEFORE UPDATE ON public.cost_centers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_currencies_updated_at BEFORE UPDATE ON public.currencies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_warehouses_updated_at BEFORE UPDATE ON public.warehouses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_product_categories_updated_at BEFORE UPDATE ON public.product_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sales_invoices_updated_at BEFORE UPDATE ON public.sales_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_purchase_invoices_updated_at BEFORE UPDATE ON public.purchase_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cash_boxes_updated_at BEFORE UPDATE ON public.cash_boxes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_collections_updated_at BEFORE UPDATE ON public.collections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units_of_measure ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for user_roles (only admins can manage)
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for branches
CREATE POLICY "All users can view branches" ON public.branches FOR SELECT USING (true);
CREATE POLICY "Admins can manage branches" ON public.branches FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for accounts
CREATE POLICY "All users can view accounts" ON public.accounts FOR SELECT USING (true);
CREATE POLICY "Accountants can manage accounts" ON public.accounts FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

-- RLS Policies for journal entries
CREATE POLICY "All users can view journal entries" ON public.journal_entries FOR SELECT USING (true);
CREATE POLICY "Accountants can create journal entries" ON public.journal_entries FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountants can update journal entries" ON public.journal_entries FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

-- RLS Policies for customers
CREATE POLICY "All users can view customers" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Sales managers can manage customers" ON public.customers FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales_manager'));

-- RLS Policies for suppliers
CREATE POLICY "All users can view suppliers" ON public.suppliers FOR SELECT USING (true);
CREATE POLICY "Admins can manage suppliers" ON public.suppliers FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory_manager'));

-- RLS Policies for products
CREATE POLICY "All users can view products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Inventory managers can manage products" ON public.products FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory_manager'));

-- RLS Policies for sales invoices
CREATE POLICY "All users can view sales invoices" ON public.sales_invoices FOR SELECT USING (true);
CREATE POLICY "Sales users can create invoices" ON public.sales_invoices FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales_manager') OR public.has_role(auth.uid(), 'user'));
CREATE POLICY "Sales managers can update invoices" ON public.sales_invoices FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales_manager'));

-- RLS Policies for purchase invoices
CREATE POLICY "All users can view purchase invoices" ON public.purchase_invoices FOR SELECT USING (true);
CREATE POLICY "Inventory managers can create purchase invoices" ON public.purchase_invoices FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory_manager'));
CREATE POLICY "Inventory managers can update purchase invoices" ON public.purchase_invoices FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory_manager'));

-- RLS Policies for other tables (allowing authenticated users)
CREATE POLICY "Authenticated users can view" ON public.cost_centers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view" ON public.currencies FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view" ON public.warehouses FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view" ON public.product_categories FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view" ON public.units_of_measure FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view" ON public.inventory_movements FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view" ON public.journal_entry_lines FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view" ON public.sales_invoice_lines FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view" ON public.purchase_invoice_lines FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view" ON public.cash_boxes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view" ON public.bank_accounts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view" ON public.collections FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view" ON public.collection_allocations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view" ON public.payments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view" ON public.payment_allocations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view" ON public.audit_logs FOR SELECT USING (auth.role() = 'authenticated');