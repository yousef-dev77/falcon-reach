ALTER TABLE public.sales_invoices ADD COLUMN IF NOT EXISTS sales_order_id uuid REFERENCES public.sales_orders(id);
ALTER TABLE public.purchase_invoices ADD COLUMN IF NOT EXISTS purchase_order_id uuid REFERENCES public.purchase_orders(id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_invoice_from_order ON public.sales_invoices(sales_order_id) WHERE sales_order_id IS NOT NULL AND status <> 'cancelled';
CREATE UNIQUE INDEX IF NOT EXISTS uq_purchase_invoice_from_order ON public.purchase_invoices(purchase_order_id) WHERE purchase_order_id IS NOT NULL AND status <> 'cancelled';
CREATE UNIQUE INDEX IF NOT EXISTS uq_po_from_request ON public.purchase_orders(request_id) WHERE request_id IS NOT NULL AND status <> 'cancelled';

CREATE OR REPLACE FUNCTION public.convert_pr_to_po(_request_id uuid, _supplier_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; _id uuid; _code text; _sub numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  SELECT * INTO r FROM purchase_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الطلب غير موجود'; END IF;
  IF r.status <> 'approved' THEN RAISE EXCEPTION 'يجب اعتماد طلب الشراء أولاً'; END IF;
  IF r.branch_id IS NOT NULL AND NOT has_branch_access(auth.uid(), r.branch_id) THEN RAISE EXCEPTION 'لا صلاحية على الفرع'; END IF;
  IF EXISTS (SELECT 1 FROM purchase_orders WHERE request_id = _request_id AND status <> 'cancelled') THEN RAISE EXCEPTION 'تم تحويل هذا الطلب مسبقاً'; END IF;
  SELECT code INTO _code FROM branches WHERE id = r.branch_id;
  SELECT COALESCE(SUM((quantity-COALESCE(ordered_quantity,0)) * COALESCE(estimated_price,0)),0) INTO _sub FROM purchase_request_lines WHERE request_id = _request_id;
  INSERT INTO purchase_orders(order_number, order_date, supplier_id, branch_id, warehouse_id, request_id, subtotal, tax_amount, total_amount, status, notes, created_by)
  VALUES ('PO-'||COALESCE(_code,'GEN')||'-'||right((extract(epoch from clock_timestamp())*1000)::bigint::text,6), current_date, _supplier_id, r.branch_id, r.warehouse_id, _request_id, _sub, 0, _sub, 'draft', 'من طلب الشراء '||r.request_number, auth.uid())
  RETURNING id INTO _id;
  INSERT INTO purchase_order_lines(order_id, product_id, description, quantity, unit_price, tax_percent, line_total)
  SELECT _id, product_id, description, quantity-COALESCE(ordered_quantity,0), COALESCE(estimated_price,0), 0, (quantity-COALESCE(ordered_quantity,0))*COALESCE(estimated_price,0)
  FROM purchase_request_lines WHERE request_id = _request_id AND quantity-COALESCE(ordered_quantity,0) > 0;
  UPDATE purchase_request_lines SET ordered_quantity = quantity WHERE request_id = _request_id;
  UPDATE purchase_requests SET status = 'closed' WHERE id = _request_id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.convert_po_to_purchase_invoice(_order_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o record; _id uuid; _code text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  SELECT * INTO o FROM purchase_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الأمر غير موجود'; END IF;
  IF o.status NOT IN ('confirmed','partially_received','received') THEN RAISE EXCEPTION 'يجب تأكيد أمر الشراء أولاً'; END IF;
  IF o.branch_id IS NOT NULL AND NOT has_branch_access(auth.uid(), o.branch_id) THEN RAISE EXCEPTION 'لا صلاحية على الفرع'; END IF;
  IF EXISTS (SELECT 1 FROM purchase_invoices WHERE purchase_order_id = _order_id AND status <> 'cancelled') THEN RAISE EXCEPTION 'تمت فوترة هذا الأمر مسبقاً'; END IF;
  SELECT code INTO _code FROM branches WHERE id = o.branch_id;
  INSERT INTO purchase_invoices(invoice_number, invoice_date, supplier_id, branch_id, warehouse_id, currency_id, subtotal, tax_amount, discount_amount, total_amount, paid_amount, status, notes, created_by, purchase_order_id)
  VALUES ('PINV-'||COALESCE(_code,'GEN')||'-'||right((extract(epoch from clock_timestamp())*1000)::bigint::text,6), current_date, o.supplier_id, o.branch_id, o.warehouse_id, o.currency_id, o.subtotal, o.tax_amount, COALESCE(o.discount_amount,0), o.total_amount, 0, 'draft', 'من أمر الشراء '||o.order_number, auth.uid(), _order_id)
  RETURNING id INTO _id;
  INSERT INTO purchase_invoice_lines(invoice_id, product_id, description, quantity, unit_price, discount_percent, tax_percent, tax_id, line_total)
  SELECT _id, product_id, description, quantity, unit_price, COALESCE(discount_percent,0), COALESCE(tax_percent,0), tax_id, line_total FROM purchase_order_lines WHERE order_id = _order_id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.convert_so_to_sales_invoice(_order_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o record; _id uuid; _code text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  SELECT * INTO o FROM sales_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الأمر غير موجود'; END IF;
  IF o.status NOT IN ('confirmed','partially_delivered','delivered') THEN RAISE EXCEPTION 'يجب تأكيد أمر البيع أولاً'; END IF;
  IF o.branch_id IS NOT NULL AND NOT has_branch_access(auth.uid(), o.branch_id) THEN RAISE EXCEPTION 'لا صلاحية على الفرع'; END IF;
  IF EXISTS (SELECT 1 FROM sales_invoices WHERE sales_order_id = _order_id AND status <> 'cancelled') THEN RAISE EXCEPTION 'تمت فوترة هذا الأمر مسبقاً'; END IF;
  SELECT code INTO _code FROM branches WHERE id = o.branch_id;
  INSERT INTO sales_invoices(invoice_number, invoice_date, customer_id, branch_id, warehouse_id, currency_id, subtotal, tax_amount, discount_amount, total_amount, paid_amount, status, notes, created_by, sales_order_id)
  VALUES ('INV-'||COALESCE(_code,'GEN')||'-'||right((extract(epoch from clock_timestamp())*1000)::bigint::text,6), current_date, o.customer_id, o.branch_id, o.warehouse_id, o.currency_id, o.subtotal, o.tax_amount, COALESCE(o.discount_amount,0), o.total_amount, 0, 'draft', 'من أمر البيع '||o.order_number, auth.uid(), _order_id)
  RETURNING id INTO _id;
  INSERT INTO sales_invoice_lines(invoice_id, product_id, description, quantity, unit_price, discount_percent, tax_percent, tax_id, line_total)
  SELECT _id, product_id, description, quantity, unit_price, COALESCE(discount_percent,0), COALESCE(tax_percent,0), tax_id, line_total FROM sales_order_lines WHERE order_id = _order_id;
  RETURN _id;
END $$;

REVOKE EXECUTE ON FUNCTION public.convert_pr_to_po(uuid,uuid), public.convert_po_to_purchase_invoice(uuid), public.convert_so_to_sales_invoice(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.convert_pr_to_po(uuid,uuid), public.convert_po_to_purchase_invoice(uuid), public.convert_so_to_sales_invoice(uuid) TO authenticated;