
-- 1. Extend products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS barcode TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS wholesale_price NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retail_price NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_service BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode) WHERE barcode IS NOT NULL;

-- 2. Inventory voucher type enum
DO $$ BEGIN
  CREATE TYPE public.inventory_voucher_type AS ENUM ('receipt','issue','transfer','count','adjustment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.inventory_voucher_status AS ENUM ('draft','confirmed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. inventory_vouchers
CREATE TABLE IF NOT EXISTS public.inventory_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_number TEXT NOT NULL,
  voucher_type public.inventory_voucher_type NOT NULL,
  voucher_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status public.inventory_voucher_status NOT NULL DEFAULT 'draft',
  warehouse_id UUID,           -- source for issue/transfer, dest for receipt
  target_warehouse_id UUID,    -- only for transfer
  branch_id UUID,
  reference TEXT,
  notes TEXT,
  counter_account_id UUID,     -- optional offset account for journal entry
  create_journal_entry BOOLEAN NOT NULL DEFAULT false,
  journal_entry_id UUID,
  total_value NUMERIC NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  confirmed_by UUID,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_voucher_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID NOT NULL REFERENCES public.inventory_vouchers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,           -- physical/expected qty (for count: counted qty)
  system_quantity NUMERIC,                        -- for count vouchers: qty in system at confirm time
  variance NUMERIC,                               -- counted - system (count vouchers)
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  line_total NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_voucher_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view vouchers" ON public.inventory_vouchers
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can manage vouchers" ON public.inventory_vouchers
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can view voucher lines" ON public.inventory_voucher_lines
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can manage voucher lines" ON public.inventory_voucher_lines
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE TRIGGER trg_inventory_vouchers_updated
  BEFORE UPDATE ON public.inventory_vouchers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Stock balance view (per product per warehouse)
CREATE OR REPLACE VIEW public.product_stock_balance AS
SELECT
  m.product_id,
  m.warehouse_id,
  SUM(m.quantity) AS quantity,
  SUM(m.quantity * COALESCE(m.unit_cost,0)) AS stock_value
FROM public.inventory_movements m
GROUP BY m.product_id, m.warehouse_id;

-- 5. Confirm voucher function
CREATE OR REPLACE FUNCTION public.confirm_inventory_voucher(_voucher_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v RECORD;
  l RECORD;
  _mov_number TEXT;
  _entry_id UUID;
  _entry_number TEXT;
  _inventory_account UUID;
  _total NUMERIC := 0;
  _sys_qty NUMERIC;
  _diff NUMERIC;
  _direction INT;
BEGIN
  SELECT * INTO v FROM public.inventory_vouchers WHERE id = _voucher_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الإذن غير موجود'; END IF;
  IF v.status <> 'draft' THEN RAISE EXCEPTION 'الإذن ليس في حالة مسودة'; END IF;

  FOR l IN SELECT * FROM public.inventory_voucher_lines WHERE voucher_id = _voucher_id LOOP

    IF v.voucher_type = 'receipt' THEN
      _direction := 1;
      _mov_number := COALESCE(public.get_next_document_number(v.branch_id, 'movement'),
                              'MOV-' || to_char(now(),'YYYYMMDDHH24MISS') || '-' || substr(l.id::text,1,4));
      INSERT INTO public.inventory_movements(movement_number, movement_date, product_id, warehouse_id, quantity, unit_cost, reference, notes, created_by)
      VALUES (_mov_number, v.voucher_date, l.product_id, v.warehouse_id, l.quantity, l.unit_cost, v.voucher_number, 'إذن استلام', v.created_by);
      PERFORM public.update_product_weighted_avg_cost(l.product_id, l.quantity, l.unit_cost);
      _total := _total + (l.quantity * l.unit_cost);

    ELSIF v.voucher_type = 'issue' THEN
      _direction := -1;
      _mov_number := COALESCE(public.get_next_document_number(v.branch_id, 'movement'),
                              'MOV-' || to_char(now(),'YYYYMMDDHH24MISS') || '-' || substr(l.id::text,1,4));
      INSERT INTO public.inventory_movements(movement_number, movement_date, product_id, warehouse_id, quantity, unit_cost, reference, notes, created_by)
      VALUES (_mov_number, v.voucher_date, l.product_id, v.warehouse_id, -l.quantity, l.unit_cost, v.voucher_number, 'إذن صرف', v.created_by);
      _total := _total + (l.quantity * l.unit_cost);

    ELSIF v.voucher_type = 'transfer' THEN
      IF v.target_warehouse_id IS NULL THEN RAISE EXCEPTION 'يجب تحديد المستودع المستلم للتحويل'; END IF;
      _mov_number := COALESCE(public.get_next_document_number(v.branch_id, 'movement'),
                              'MOV-' || to_char(now(),'YYYYMMDDHH24MISS') || '-' || substr(l.id::text,1,4));
      INSERT INTO public.inventory_movements(movement_number, movement_date, product_id, warehouse_id, quantity, unit_cost, reference, notes, created_by)
      VALUES (_mov_number || '-OUT', v.voucher_date, l.product_id, v.warehouse_id, -l.quantity, l.unit_cost, v.voucher_number, 'تحويل صادر', v.created_by);
      INSERT INTO public.inventory_movements(movement_number, movement_date, product_id, warehouse_id, quantity, unit_cost, reference, notes, created_by)
      VALUES (_mov_number || '-IN', v.voucher_date, l.product_id, v.target_warehouse_id, l.quantity, l.unit_cost, v.voucher_number, 'تحويل وارد', v.created_by);
      _total := _total + (l.quantity * l.unit_cost);

    ELSIF v.voucher_type IN ('count','adjustment') THEN
      SELECT COALESCE(SUM(quantity),0) INTO _sys_qty
      FROM public.inventory_movements
      WHERE product_id = l.product_id AND warehouse_id = v.warehouse_id;
      _diff := l.quantity - _sys_qty;
      UPDATE public.inventory_voucher_lines
        SET system_quantity = _sys_qty, variance = _diff
        WHERE id = l.id;
      IF _diff <> 0 THEN
        _mov_number := COALESCE(public.get_next_document_number(v.branch_id, 'movement'),
                                'MOV-' || to_char(now(),'YYYYMMDDHH24MISS') || '-' || substr(l.id::text,1,4));
        INSERT INTO public.inventory_movements(movement_number, movement_date, product_id, warehouse_id, quantity, unit_cost, reference, notes, created_by)
        VALUES (_mov_number, v.voucher_date, l.product_id, v.warehouse_id, _diff, l.unit_cost, v.voucher_number,
                CASE WHEN v.voucher_type='count' THEN 'تسوية جرد' ELSE 'تسوية' END, v.created_by);
        _total := _total + (ABS(_diff) * l.unit_cost);
      END IF;
    END IF;

  END LOOP;

  -- Optional journal entry
  IF v.create_journal_entry AND v.counter_account_id IS NOT NULL AND _total > 0 THEN
    SELECT setting_value::uuid INTO _inventory_account
    FROM public.system_settings WHERE setting_key = 'default_inventory_account_id' AND setting_value IS NOT NULL;

    IF _inventory_account IS NOT NULL THEN
      _entry_number := COALESCE(public.get_next_document_number(v.branch_id, 'journal_entry'),
                                'JE-INV-' || to_char(now(),'YYYYMMDDHH24MISS'));
      INSERT INTO public.journal_entries(entry_number, entry_date, description, reference, branch_id, created_by, is_posted)
      VALUES (_entry_number, v.voucher_date, 'إذن مخزون ' || v.voucher_number, v.voucher_number, v.branch_id, v.created_by, true)
      RETURNING id INTO _entry_id;

      IF v.voucher_type = 'receipt' OR (v.voucher_type IN ('count','adjustment') AND _total > 0) THEN
        -- Debit inventory, credit counter
        INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, debit_amount, credit_amount, description)
        VALUES
          (_entry_id, _inventory_account, _total, 0, 'زيادة مخزون'),
          (_entry_id, v.counter_account_id, 0, _total, 'مقابل');
      ELSE
        INSERT INTO public.journal_entry_lines(journal_entry_id, account_id, debit_amount, credit_amount, description)
        VALUES
          (_entry_id, v.counter_account_id, _total, 0, 'مقابل'),
          (_entry_id, _inventory_account, 0, _total, 'تخفيض مخزون');
      END IF;

      UPDATE public.inventory_vouchers SET journal_entry_id = _entry_id WHERE id = _voucher_id;
    END IF;
  END IF;

  UPDATE public.inventory_vouchers
    SET status='confirmed', confirmed_at=now(), confirmed_by=v.created_by, total_value=_total, updated_at=now()
    WHERE id = _voucher_id;
END; $$;

-- 6. Prevent edit/delete of confirmed vouchers
CREATE OR REPLACE FUNCTION public.prevent_modify_confirmed_voucher()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'confirmed' THEN RAISE EXCEPTION 'لا يمكن حذف إذن مؤكد'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'confirmed' AND NEW.status = 'confirmed' THEN
    IF NEW.voucher_date <> OLD.voucher_date OR NEW.warehouse_id <> OLD.warehouse_id THEN
      RAISE EXCEPTION 'لا يمكن تعديل إذن مؤكد';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_voucher_lock ON public.inventory_vouchers;
CREATE TRIGGER trg_voucher_lock
  BEFORE UPDATE OR DELETE ON public.inventory_vouchers
  FOR EACH ROW EXECUTE FUNCTION public.prevent_modify_confirmed_voucher();

CREATE OR REPLACE FUNCTION public.prevent_modify_confirmed_voucher_lines()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _status public.inventory_voucher_status;
BEGIN
  SELECT status INTO _status FROM public.inventory_vouchers WHERE id = COALESCE(NEW.voucher_id, OLD.voucher_id);
  IF _status = 'confirmed' THEN RAISE EXCEPTION 'لا يمكن تعديل بنود إذن مؤكد'; END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_voucher_lines_lock ON public.inventory_voucher_lines;
CREATE TRIGGER trg_voucher_lines_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.inventory_voucher_lines
  FOR EACH ROW EXECUTE FUNCTION public.prevent_modify_confirmed_voucher_lines();

-- 7. Storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated can upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated can update product images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated can delete product images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');
