-- 1) Idempotency keys store
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text,
  result jsonb,
  status text NOT NULL DEFAULT 'completed',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, idempotency_key)
);

GRANT SELECT, INSERT, UPDATE ON public.idempotency_keys TO authenticated;
GRANT ALL ON public.idempotency_keys TO service_role;

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own idempotency keys" ON public.idempotency_keys;
CREATE POLICY "Users manage own idempotency keys"
ON public.idempotency_keys FOR ALL TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'))
WITH CHECK (created_by = auth.uid());

DROP TRIGGER IF EXISTS trg_idempotency_keys_updated_at ON public.idempotency_keys;
CREATE TRIGGER trg_idempotency_keys_updated_at
BEFORE UPDATE ON public.idempotency_keys
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: claim a key. returns previous result if already processed.
CREATE OR REPLACE FUNCTION public.claim_idempotency_key(_scope text, _key text, _request_hash text DEFAULT NULL)
RETURNS TABLE(is_new boolean, previous_result jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.idempotency_keys;
BEGIN
  IF _key IS NULL OR length(trim(_key)) = 0 THEN
    RAISE EXCEPTION 'مفتاح العملية (Idempotency Key) مطلوب';
  END IF;

  INSERT INTO public.idempotency_keys(scope, idempotency_key, request_hash, status, created_by)
  VALUES (_scope, _key, _request_hash, 'in_progress', auth.uid())
  ON CONFLICT (scope, idempotency_key) DO NOTHING
  RETURNING * INTO v_row;

  IF v_row.id IS NOT NULL THEN
    RETURN QUERY SELECT true, NULL::jsonb;
    RETURN;
  END IF;

  SELECT * INTO v_row FROM public.idempotency_keys
    WHERE scope = _scope AND idempotency_key = _key FOR UPDATE;

  RETURN QUERY SELECT false, v_row.result;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_idempotency_key(_scope text, _key text, _result jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.idempotency_keys
     SET result = _result, status = 'completed', updated_at = now()
   WHERE scope = _scope AND idempotency_key = _key;
$$;

GRANT EXECUTE ON FUNCTION public.claim_idempotency_key(text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_idempotency_key(text,text,jsonb) TO authenticated;

-- 2) Row-lock hardening: delivery note posting (prevents negative stock under concurrency)
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
  -- lock the document row: a second concurrent call waits, then sees status <> draft
  SELECT * INTO v_dn FROM public.delivery_notes WHERE id = _dn_id FOR UPDATE;
  IF v_dn IS NULL THEN RAISE EXCEPTION 'سند التسليم غير موجود'; END IF;
  IF v_dn.status <> 'draft' THEN RAISE EXCEPTION 'Delivery is not draft'; END IF;

  FOR v_line IN SELECT * FROM public.delivery_note_lines WHERE dn_id = _dn_id ORDER BY product_id LOOP
    -- serialize per product to make the stock check + deduction atomic
    PERFORM 1 FROM public.products WHERE id = v_line.product_id FOR UPDATE;

    SELECT COALESCE(SUM(quantity),0) INTO v_stock
      FROM public.inventory_movements
      WHERE product_id = v_line.product_id AND warehouse_id = v_dn.warehouse_id;

    IF v_stock < v_line.quantity THEN
      RAISE EXCEPTION 'الرصيد غير كافي للصنف % (المتاح %، المطلوب %)', v_line.product_id, v_stock, v_line.quantity;
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
END;
$$;

-- 3) POS order payment: lock order + products, guard double payment
CREATE OR REPLACE FUNCTION public.pay_pos_order(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_line record;
  v_config record;
  v_stock numeric;
BEGIN
  SELECT * INTO v_order FROM public.pos_orders WHERE id = _order_id FOR UPDATE;
  IF v_order IS NULL THEN RAISE EXCEPTION 'الطلب غير موجود'; END IF;
  IF v_order.status <> 'draft' THEN
    RAISE EXCEPTION 'الطلب ليس في حالة مسودة';
  END IF;

  SELECT * INTO v_config FROM public.pos_configs WHERE id = v_order.config_id;

  IF v_config.warehouse_id IS NOT NULL THEN
    FOR v_line IN SELECT pol.*, p.track_inventory FROM public.pos_order_lines pol
                  JOIN public.products p ON p.id = pol.product_id
                  WHERE pol.order_id = _order_id ORDER BY pol.product_id LOOP
      IF v_line.track_inventory THEN
        PERFORM 1 FROM public.products WHERE id = v_line.product_id FOR UPDATE;

        SELECT COALESCE(SUM(quantity),0) INTO v_stock
          FROM public.inventory_movements
          WHERE product_id = v_line.product_id AND warehouse_id = v_config.warehouse_id;

        IF v_stock < v_line.quantity THEN
          RAISE EXCEPTION 'الرصيد غير كافي للصنف % (المتاح %)', v_line.product_id, v_stock;
        END IF;

        INSERT INTO public.inventory_movements (movement_number, movement_date, product_id, warehouse_id, quantity, unit_cost, reference, created_by)
        VALUES ('POS-' || v_order.order_number, CURRENT_DATE, v_line.product_id, v_config.warehouse_id, -v_line.quantity, v_line.unit_price, v_order.order_number, v_order.cashier_id);
      END IF;
    END LOOP;
  END IF;

  UPDATE public.pos_orders SET status = 'paid' WHERE id = _order_id;
END;
$$;

-- 4) Loan approval: lock loan row so a double click cannot create two vouchers
CREATE OR REPLACE FUNCTION public.approve_loan(_loan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l RECORD;
  v_voucher_number TEXT;
  v_seq INT;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'branch_manager') OR public.has_role(auth.uid(),'hr_manager')) THEN
    RAISE EXCEPTION 'غير مصرح باعتماد القروض';
  END IF;

  SELECT * INTO l FROM public.hr_loans WHERE id = _loan_id FOR UPDATE;
  IF l IS NULL THEN RAISE EXCEPTION 'القرض غير موجود'; END IF;
  IF l.status NOT IN ('draft'::loan_status,'pending_approval'::loan_status) THEN
    RAISE EXCEPTION 'لا يمكن اعتماد القرض في حالته الحالية';
  END IF;

  UPDATE public.hr_loans SET
    status = 'pending_disbursement'::loan_status,
    approved_by = auth.uid(),
    approved_at = now(),
    manager_approved_by = auth.uid(),
    manager_approved_at = now()
  WHERE id = _loan_id;

  PERFORM public.generate_loan_schedule(_loan_id);

  SELECT COALESCE(COUNT(*),0)+1 INTO v_seq FROM public.hr_payment_vouchers
    WHERE voucher_number LIKE 'HRV-' || to_char(now(),'YYYYMM') || '-%';
  v_voucher_number := 'HRV-' || to_char(now(),'YYYYMM') || '-' || lpad(v_seq::text, 4, '0');

  INSERT INTO public.hr_payment_vouchers (
    voucher_number, voucher_date, employee_id, loan_id, voucher_type,
    amount, description, status, created_by
  ) VALUES (
    v_voucher_number, CURRENT_DATE, l.employee_id, l.id,
    CASE WHEN l.loan_type = 'advance' THEN 'advance_disbursement' ELSE 'loan_disbursement' END,
    l.total_amount,
    CASE WHEN l.loan_type = 'advance' THEN 'صرف سلفة ' ELSE 'صرف قرض ' END || l.loan_number,
    'draft', auth.uid()
  );
END;
$$;

-- 5) Unique document numbers (created only when no duplicates exist today)
DO $$
DECLARE
  r record;
  v_dups bigint;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('delivery_notes','dn_number','ux_delivery_notes_number'),
      ('pos_orders','order_number','ux_pos_orders_number'),
      ('hr_payment_vouchers','voucher_number','ux_hr_payment_vouchers_number'),
      ('payments','payment_number','ux_payments_number'),
      ('collections','collection_number','ux_collections_number')
    ) AS t(tbl, col, idx)
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name=r.tbl AND column_name=r.col) THEN
      EXECUTE format('SELECT count(*) FROM (SELECT %I FROM public.%I GROUP BY 1 HAVING count(*) > 1) d', r.col, r.tbl) INTO v_dups;
      IF v_dups = 0 THEN
        EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I (%I)', r.idx, r.tbl, r.col);
      END IF;
    END IF;
  END LOOP;
END $$;