
-- ENUMS
CREATE TYPE pos_session_status AS ENUM ('opened', 'closing', 'closed');
CREATE TYPE pos_order_status AS ENUM ('draft', 'paid', 'invoiced', 'cancelled');
CREATE TYPE pos_payment_method AS ENUM ('cash', 'card', 'transfer', 'credit');

-- POS CONFIGS
CREATE TABLE public.pos_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  branch_id uuid REFERENCES public.branches(id),
  warehouse_id uuid,
  cash_box_id uuid REFERENCES public.cash_boxes(id),
  bank_account_id uuid REFERENCES public.bank_accounts(id),
  sales_account_id uuid REFERENCES public.accounts(id),
  default_tax_id uuid REFERENCES public.taxes(id),
  allow_discount boolean DEFAULT true,
  allow_price_edit boolean DEFAULT false,
  require_customer boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- POS SESSIONS
CREATE TABLE public.pos_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_number text NOT NULL,
  config_id uuid NOT NULL REFERENCES public.pos_configs(id),
  cashier_id uuid NOT NULL,
  status pos_session_status NOT NULL DEFAULT 'opened',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opening_balance numeric NOT NULL DEFAULT 0,
  closing_balance numeric DEFAULT 0,
  expected_cash numeric DEFAULT 0,
  cash_difference numeric DEFAULT 0,
  total_sales numeric DEFAULT 0,
  total_tax numeric DEFAULT 0,
  total_cash numeric DEFAULT 0,
  total_card numeric DEFAULT 0,
  total_transfer numeric DEFAULT 0,
  journal_entry_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- POS ORDERS
CREATE TABLE public.pos_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL,
  session_id uuid NOT NULL REFERENCES public.pos_sessions(id),
  config_id uuid NOT NULL REFERENCES public.pos_configs(id),
  customer_id uuid REFERENCES public.customers(id),
  cashier_id uuid NOT NULL,
  status pos_order_status NOT NULL DEFAULT 'draft',
  order_date timestamptz NOT NULL DEFAULT now(),
  subtotal numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  change_amount numeric NOT NULL DEFAULT 0,
  sales_invoice_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- POS ORDER LINES
CREATE TABLE public.pos_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.pos_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  discount_percent numeric NOT NULL DEFAULT 0,
  tax_percent numeric NOT NULL DEFAULT 0,
  line_subtotal numeric NOT NULL DEFAULT 0,
  line_tax numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- POS PAYMENTS
CREATE TABLE public.pos_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.pos_orders(id) ON DELETE CASCADE,
  payment_method pos_payment_method NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- POS CASH MOVEMENTS
CREATE TABLE public.pos_cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.pos_sessions(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('in','out')),
  amount numeric NOT NULL,
  reason text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.pos_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_cash_movements ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['pos_configs','pos_sessions','pos_orders','pos_order_lines','pos_payments','pos_cash_movements']) LOOP
    EXECUTE format('CREATE POLICY "auth_select_%I" ON public.%I FOR SELECT USING (auth.role() = ''authenticated'')', t, t);
    EXECUTE format('CREATE POLICY "auth_all_%I" ON public.%I FOR ALL USING (auth.role() = ''authenticated'') WITH CHECK (auth.role() = ''authenticated'')', t, t);
  END LOOP;
END $$;

-- FUNCTION: Open POS Session
CREATE OR REPLACE FUNCTION public.open_pos_session(
  _config_id uuid,
  _opening_balance numeric DEFAULT 0
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session_id uuid;
  v_session_number text;
  v_user_id uuid := auth.uid();
BEGIN
  IF EXISTS (SELECT 1 FROM pos_sessions WHERE config_id = _config_id AND status = 'opened') THEN
    RAISE EXCEPTION 'يوجد جلسة مفتوحة بالفعل لنقطة البيع هذه';
  END IF;
  
  v_session_number := 'POS-S-' || to_char(now(), 'YYYYMMDD') || '-' || lpad((COALESCE((SELECT COUNT(*) FROM pos_sessions WHERE opened_at::date = CURRENT_DATE), 0) + 1)::text, 4, '0');
  
  INSERT INTO pos_sessions (session_number, config_id, cashier_id, opening_balance, status)
  VALUES (v_session_number, _config_id, v_user_id, _opening_balance, 'opened')
  RETURNING id INTO v_session_id;
  
  RETURN v_session_id;
END;
$$;

-- FUNCTION: Pay POS Order
CREATE OR REPLACE FUNCTION public.pay_pos_order(_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order record;
  v_line record;
  v_config record;
BEGIN
  SELECT * INTO v_order FROM pos_orders WHERE id = _order_id;
  IF v_order.status != 'draft' THEN
    RAISE EXCEPTION 'الطلب ليس في حالة مسودة';
  END IF;
  
  SELECT * INTO v_config FROM pos_configs WHERE id = v_order.config_id;
  
  -- Deduct inventory
  IF v_config.warehouse_id IS NOT NULL THEN
    FOR v_line IN SELECT pol.*, p.track_inventory FROM pos_order_lines pol 
                  JOIN products p ON p.id = pol.product_id 
                  WHERE pol.order_id = _order_id LOOP
      IF v_line.track_inventory THEN
        INSERT INTO inventory_movements (movement_number, movement_date, product_id, warehouse_id, quantity, unit_cost, reference, created_by)
        VALUES ('POS-' || v_order.order_number, CURRENT_DATE, v_line.product_id, v_config.warehouse_id, -v_line.quantity, v_line.unit_price, v_order.order_number, v_order.cashier_id);
      END IF;
    END LOOP;
  END IF;
  
  UPDATE pos_orders SET status = 'paid' WHERE id = _order_id;
END;
$$;

-- FUNCTION: Close POS Session (generates journal entry)
CREATE OR REPLACE FUNCTION public.close_pos_session(
  _session_id uuid,
  _closing_balance numeric
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session record;
  v_config record;
  v_total_sales numeric := 0;
  v_total_tax numeric := 0;
  v_total_cash numeric := 0;
  v_total_card numeric := 0;
  v_total_transfer numeric := 0;
  v_je_id uuid;
  v_entry_number text;
BEGIN
  SELECT * INTO v_session FROM pos_sessions WHERE id = _session_id;
  IF v_session.status != 'opened' THEN
    RAISE EXCEPTION 'الجلسة ليست مفتوحة';
  END IF;
  SELECT * INTO v_config FROM pos_configs WHERE id = v_session.config_id;
  
  SELECT COALESCE(SUM(subtotal - discount_amount), 0), COALESCE(SUM(tax_amount), 0)
    INTO v_total_sales, v_total_tax
    FROM pos_orders WHERE session_id = _session_id AND status IN ('paid','invoiced');
  
  SELECT 
    COALESCE(SUM(CASE WHEN pp.payment_method='cash' THEN pp.amount ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN pp.payment_method='card' THEN pp.amount ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN pp.payment_method='transfer' THEN pp.amount ELSE 0 END),0)
    INTO v_total_cash, v_total_card, v_total_transfer
    FROM pos_payments pp 
    JOIN pos_orders po ON po.id = pp.order_id 
    WHERE po.session_id = _session_id AND po.status IN ('paid','invoiced');
  
  -- Generate journal entry
  IF (v_total_sales + v_total_tax) > 0 AND v_config.sales_account_id IS NOT NULL THEN
    v_entry_number := 'JE-POS-' || to_char(now(), 'YYYYMM') || '-' || lpad((COALESCE((SELECT COUNT(*) FROM journal_entries WHERE entry_date::text LIKE to_char(now(),'YYYY-MM') || '%'),0)+1)::text, 4, '0');
    
    INSERT INTO journal_entries (entry_number, entry_date, description, reference, is_posted, created_by, branch_id)
    VALUES (v_entry_number, CURRENT_DATE, 'إقفال جلسة POS ' || v_session.session_number, v_session.session_number, true, v_session.cashier_id, v_config.branch_id)
    RETURNING id INTO v_je_id;
    
    -- Debit: cash/card
    IF v_total_cash > 0 AND v_config.cash_box_id IS NOT NULL THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
      SELECT v_je_id, account_id, v_total_cash, 0, 'مبيعات نقدية POS' FROM cash_boxes WHERE id = v_config.cash_box_id AND account_id IS NOT NULL;
    END IF;
    IF (v_total_card + v_total_transfer) > 0 AND v_config.bank_account_id IS NOT NULL THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
      SELECT v_je_id, account_id, v_total_card + v_total_transfer, 0, 'مبيعات شبكة POS' FROM bank_accounts WHERE id = v_config.bank_account_id AND account_id IS NOT NULL;
    END IF;
    
    -- Credit: sales revenue
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
    VALUES (v_je_id, v_config.sales_account_id, 0, v_total_sales, 'إيرادات مبيعات POS');
    
    -- Credit: VAT output
    IF v_total_tax > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
      SELECT v_je_id, t.output_account_id, 0, v_total_tax, 'ضريبة مخرجات POS' 
      FROM taxes t WHERE t.id = v_config.default_tax_id AND t.output_account_id IS NOT NULL;
    END IF;
  END IF;
  
  UPDATE pos_sessions SET 
    status = 'closed',
    closed_at = now(),
    closing_balance = _closing_balance,
    expected_cash = opening_balance + v_total_cash,
    cash_difference = _closing_balance - (opening_balance + v_total_cash),
    total_sales = v_total_sales,
    total_tax = v_total_tax,
    total_cash = v_total_cash,
    total_card = v_total_card,
    total_transfer = v_total_transfer,
    journal_entry_id = v_je_id
  WHERE id = _session_id;
  
  RETURN _session_id;
END;
$$;
