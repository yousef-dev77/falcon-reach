
-- =============== ENUMS ===============
DO $$ BEGIN
  CREATE TYPE pr_status AS ENUM ('draft','submitted','approved','rejected','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE po_status AS ENUM ('draft','confirmed','partially_received','received','cancelled','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE grn_status AS ENUM ('draft','posted','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE quotation_status AS ENUM ('draft','sent','accepted','rejected','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE so_status AS ENUM ('draft','confirmed','partially_delivered','delivered','cancelled','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dn_status AS ENUM ('draft','posted','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE landed_cost_status AS ENUM ('draft','posted','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============== PURCHASE REQUESTS ===============
CREATE TABLE IF NOT EXISTS public.purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL,
  request_date date NOT NULL DEFAULT CURRENT_DATE,
  required_date date,
  branch_id uuid,
  warehouse_id uuid,
  department text,
  notes text,
  status pr_status NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_request_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  description text,
  quantity numeric NOT NULL DEFAULT 0,
  ordered_quantity numeric NOT NULL DEFAULT 0,
  estimated_price numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============== PURCHASE ORDERS ===============
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL,
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_date date,
  supplier_id uuid NOT NULL,
  branch_id uuid,
  warehouse_id uuid,
  request_id uuid REFERENCES public.purchase_requests(id),
  currency_id uuid,
  subtotal numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  status po_status NOT NULL DEFAULT 'draft',
  notes text,
  created_by uuid NOT NULL,
  confirmed_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  description text,
  quantity numeric NOT NULL DEFAULT 0,
  received_quantity numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  tax_id uuid,
  tax_percent numeric DEFAULT 0,
  discount_percent numeric DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============== GOODS RECEIPTS (GRN) ===============
CREATE TABLE IF NOT EXISTS public.goods_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_number text NOT NULL,
  receipt_date date NOT NULL DEFAULT CURRENT_DATE,
  supplier_id uuid NOT NULL,
  purchase_order_id uuid REFERENCES public.purchase_orders(id),
  branch_id uuid,
  warehouse_id uuid NOT NULL,
  reference text,
  notes text,
  total_value numeric NOT NULL DEFAULT 0,
  status grn_status NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL,
  posted_by uuid,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.goods_receipt_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id uuid NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
  po_line_id uuid REFERENCES public.purchase_order_lines(id),
  product_id uuid NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============== QUOTATIONS ===============
CREATE TABLE IF NOT EXISTS public.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_number text NOT NULL,
  quotation_date date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date,
  customer_id uuid NOT NULL,
  branch_id uuid,
  currency_id uuid,
  subtotal numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  status quotation_status NOT NULL DEFAULT 'draft',
  notes text,
  terms text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quotation_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  description text,
  quantity numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  tax_id uuid,
  tax_percent numeric DEFAULT 0,
  discount_percent numeric DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============== SALES ORDERS ===============
CREATE TABLE IF NOT EXISTS public.sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL,
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  delivery_date date,
  customer_id uuid NOT NULL,
  quotation_id uuid REFERENCES public.quotations(id),
  branch_id uuid,
  warehouse_id uuid,
  currency_id uuid,
  subtotal numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  status so_status NOT NULL DEFAULT 'draft',
  notes text,
  created_by uuid NOT NULL,
  confirmed_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  description text,
  quantity numeric NOT NULL DEFAULT 0,
  delivered_quantity numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  tax_id uuid,
  tax_percent numeric DEFAULT 0,
  discount_percent numeric DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============== DELIVERY NOTES ===============
CREATE TABLE IF NOT EXISTS public.delivery_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dn_number text NOT NULL,
  delivery_date date NOT NULL DEFAULT CURRENT_DATE,
  customer_id uuid NOT NULL,
  sales_order_id uuid REFERENCES public.sales_orders(id),
  branch_id uuid,
  warehouse_id uuid NOT NULL,
  reference text,
  notes text,
  total_value numeric NOT NULL DEFAULT 0,
  status dn_status NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL,
  posted_by uuid,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_note_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dn_id uuid NOT NULL REFERENCES public.delivery_notes(id) ON DELETE CASCADE,
  so_line_id uuid REFERENCES public.sales_order_lines(id),
  product_id uuid NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============== LANDED COSTS ===============
CREATE TABLE IF NOT EXISTS public.landed_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lc_number text NOT NULL,
  lc_date date NOT NULL DEFAULT CURRENT_DATE,
  purchase_invoice_id uuid,
  allocation_method text NOT NULL DEFAULT 'by_value', -- by_value | by_quantity | by_weight
  total_cost numeric NOT NULL DEFAULT 0,
  notes text,
  status landed_cost_status NOT NULL DEFAULT 'draft',
  journal_entry_id uuid,
  created_by uuid NOT NULL,
  posted_by uuid,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.landed_cost_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landed_cost_id uuid NOT NULL REFERENCES public.landed_costs(id) ON DELETE CASCADE,
  cost_type text NOT NULL, -- shipping, customs, insurance, other
  description text,
  amount numeric NOT NULL DEFAULT 0,
  expense_account_id uuid,
  vendor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============== RLS ===============
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_request_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipt_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_note_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landed_cost_lines ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'purchase_requests','purchase_request_lines',
    'purchase_orders','purchase_order_lines',
    'goods_receipts','goods_receipt_lines',
    'quotations','quotation_lines',
    'sales_orders','sales_order_lines',
    'delivery_notes','delivery_note_lines',
    'landed_costs','landed_cost_lines'
  ])
  LOOP
    EXECUTE format('CREATE POLICY "auth_select_%I" ON public.%I FOR SELECT USING (auth.role() = ''authenticated'')', t, t);
    EXECUTE format('CREATE POLICY "auth_all_%I" ON public.%I FOR ALL USING (auth.role() = ''authenticated'') WITH CHECK (auth.role() = ''authenticated'')', t, t);
  END LOOP;
END $$;

-- =============== TRIGGERS for updated_at ===============
CREATE TRIGGER trg_purchase_requests_updated BEFORE UPDATE ON public.purchase_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_purchase_orders_updated BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_goods_receipts_updated BEFORE UPDATE ON public.goods_receipts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_quotations_updated BEFORE UPDATE ON public.quotations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_sales_orders_updated BEFORE UPDATE ON public.sales_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_delivery_notes_updated BEFORE UPDATE ON public.delivery_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_landed_costs_updated BEFORE UPDATE ON public.landed_costs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============== FUNCTIONS ===============

-- Post GRN: increase stock and update PO received qty
CREATE OR REPLACE FUNCTION public.post_goods_receipt(_grn_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grn record;
  v_line record;
  v_po_status po_status;
  v_total_qty numeric;
  v_received_qty numeric;
BEGIN
  SELECT * INTO v_grn FROM public.goods_receipts WHERE id = _grn_id;
  IF v_grn.status <> 'draft' THEN RAISE EXCEPTION 'Receipt is not draft'; END IF;

  -- Increase stock via inventory movements
  FOR v_line IN SELECT * FROM public.goods_receipt_lines WHERE grn_id = _grn_id LOOP
    INSERT INTO public.inventory_movements(movement_number, movement_date, product_id, warehouse_id, quantity, unit_cost, reference, notes, created_by)
    VALUES (
      'GRN-' || substr(v_grn.grn_number, 1, 30),
      v_grn.receipt_date,
      v_line.product_id,
      v_grn.warehouse_id,
      v_line.quantity,
      v_line.unit_cost,
      v_grn.grn_number,
      'استلام بضاعة',
      v_grn.created_by
    );
    -- Update PO line received qty
    IF v_line.po_line_id IS NOT NULL THEN
      UPDATE public.purchase_order_lines
        SET received_quantity = received_quantity + v_line.quantity
        WHERE id = v_line.po_line_id;
    END IF;
  END LOOP;

  -- Update PO header status
  IF v_grn.purchase_order_id IS NOT NULL THEN
    SELECT COALESCE(SUM(quantity),0), COALESCE(SUM(received_quantity),0)
      INTO v_total_qty, v_received_qty
      FROM public.purchase_order_lines WHERE order_id = v_grn.purchase_order_id;
    IF v_received_qty >= v_total_qty THEN v_po_status := 'received';
    ELSIF v_received_qty > 0 THEN v_po_status := 'partially_received';
    ELSE v_po_status := 'confirmed';
    END IF;
    UPDATE public.purchase_orders SET status = v_po_status WHERE id = v_grn.purchase_order_id;
  END IF;

  UPDATE public.goods_receipts
    SET status = 'posted', posted_at = now(), posted_by = auth.uid()
    WHERE id = _grn_id;
END $$;

-- Post Delivery Note: decrease stock and update SO delivered qty
CREATE OR REPLACE FUNCTION public.post_delivery_note(_dn_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dn record;
  v_line record;
  v_so_status so_status;
  v_total_qty numeric;
  v_delivered_qty numeric;
  v_stock numeric;
BEGIN
  SELECT * INTO v_dn FROM public.delivery_notes WHERE id = _dn_id;
  IF v_dn.status <> 'draft' THEN RAISE EXCEPTION 'Delivery is not draft'; END IF;

  FOR v_line IN SELECT * FROM public.delivery_note_lines WHERE dn_id = _dn_id LOOP
    -- Check stock
    SELECT COALESCE(SUM(quantity),0) INTO v_stock
      FROM public.inventory_movements
      WHERE product_id = v_line.product_id AND warehouse_id = v_dn.warehouse_id;
    IF v_stock < v_line.quantity THEN
      RAISE EXCEPTION 'الرصيد غير كافي للصنف %', v_line.product_id;
    END IF;

    INSERT INTO public.inventory_movements(movement_number, movement_date, product_id, warehouse_id, quantity, unit_cost, reference, notes, created_by)
    VALUES (
      'DN-' || substr(v_dn.dn_number, 1, 30),
      v_dn.delivery_date,
      v_line.product_id,
      v_dn.warehouse_id,
      -v_line.quantity,
      v_line.unit_cost,
      v_dn.dn_number,
      'تسليم بضاعة',
      v_dn.created_by
    );

    IF v_line.so_line_id IS NOT NULL THEN
      UPDATE public.sales_order_lines
        SET delivered_quantity = delivered_quantity + v_line.quantity
        WHERE id = v_line.so_line_id;
    END IF;
  END LOOP;

  IF v_dn.sales_order_id IS NOT NULL THEN
    SELECT COALESCE(SUM(quantity),0), COALESCE(SUM(delivered_quantity),0)
      INTO v_total_qty, v_delivered_qty
      FROM public.sales_order_lines WHERE order_id = v_dn.sales_order_id;
    IF v_delivered_qty >= v_total_qty THEN v_so_status := 'delivered';
    ELSIF v_delivered_qty > 0 THEN v_so_status := 'partially_delivered';
    ELSE v_so_status := 'confirmed';
    END IF;
    UPDATE public.sales_orders SET status = v_so_status WHERE id = v_dn.sales_order_id;
  END IF;

  UPDATE public.delivery_notes
    SET status = 'posted', posted_at = now(), posted_by = auth.uid()
    WHERE id = _dn_id;
END $$;

-- Post Landed Cost: distribute over invoice lines (by value) and update product cost
CREATE OR REPLACE FUNCTION public.post_landed_cost(_lc_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lc record;
  v_inv record;
  v_line record;
  v_total_base numeric := 0;
  v_share numeric;
  v_added_cost numeric;
  v_new_unit_cost numeric;
BEGIN
  SELECT * INTO v_lc FROM public.landed_costs WHERE id = _lc_id;
  IF v_lc.status <> 'draft' THEN RAISE EXCEPTION 'Already posted'; END IF;
  IF v_lc.purchase_invoice_id IS NULL THEN RAISE EXCEPTION 'No invoice linked'; END IF;

  SELECT * INTO v_inv FROM public.purchase_invoices WHERE id = v_lc.purchase_invoice_id;

  -- Base for allocation
  IF v_lc.allocation_method = 'by_quantity' THEN
    SELECT COALESCE(SUM(quantity),0) INTO v_total_base FROM public.purchase_invoice_lines WHERE invoice_id = v_lc.purchase_invoice_id;
  ELSE
    SELECT COALESCE(SUM(line_total),0) INTO v_total_base FROM public.purchase_invoice_lines WHERE invoice_id = v_lc.purchase_invoice_id;
  END IF;

  IF v_total_base = 0 THEN RAISE EXCEPTION 'Invoice has no allocation base'; END IF;

  -- Distribute total cost to product cost
  FOR v_line IN SELECT * FROM public.purchase_invoice_lines WHERE invoice_id = v_lc.purchase_invoice_id LOOP
    IF v_lc.allocation_method = 'by_quantity' THEN
      v_share := v_line.quantity / v_total_base;
    ELSE
      v_share := v_line.line_total / v_total_base;
    END IF;
    v_added_cost := v_lc.total_cost * v_share;
    IF v_line.quantity > 0 THEN
      v_new_unit_cost := v_line.unit_price + (v_added_cost / v_line.quantity);
      UPDATE public.products SET cost_price = v_new_unit_cost WHERE id = v_line.product_id;
    END IF;
  END LOOP;

  UPDATE public.landed_costs
    SET status = 'posted', posted_at = now(), posted_by = auth.uid()
    WHERE id = _lc_id;
END $$;
