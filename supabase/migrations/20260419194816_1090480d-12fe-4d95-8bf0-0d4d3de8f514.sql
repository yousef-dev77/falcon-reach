-- 1. إضافة إعداد وضع محاسبة المخزون
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, category, description)
VALUES 
  ('inventory_accounting_mode', 'perpetual', 'select', 'inventory', 'وضع محاسبة المخزون: perpetual (جرد دائم مع COGS) أو periodic (جرد دوري)')
ON CONFLICT (setting_key) DO NOTHING;

-- 2. منع حذف سندات القبض المرحلة (المرتبطة بفواتير)
CREATE OR REPLACE FUNCTION public.prevent_delete_allocated_collection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  has_allocations BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.collection_allocations WHERE collection_id = OLD.id)
  INTO has_allocations;
  
  IF has_allocations THEN
    RAISE EXCEPTION 'لا يمكن حذف سند قبض مرتبط بفواتير. لإلغائه استخدم سند عكسي.';
  END IF;
  
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_delete_allocated_collection ON public.collections;
CREATE TRIGGER trg_prevent_delete_allocated_collection
BEFORE DELETE ON public.collections
FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_allocated_collection();

-- 3. منع حذف سندات الدفع المرحلة (المرتبطة بفواتير)
CREATE OR REPLACE FUNCTION public.prevent_delete_allocated_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  has_allocations BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.payment_allocations WHERE payment_id = OLD.id)
  INTO has_allocations;
  
  IF has_allocations THEN
    RAISE EXCEPTION 'لا يمكن حذف سند دفع مرتبط بفواتير. لإلغائه استخدم سند عكسي.';
  END IF;
  
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_delete_allocated_payment ON public.payments;
CREATE TRIGGER trg_prevent_delete_allocated_payment
BEFORE DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_allocated_payment();

-- 4. منع حذف الفواتير المرحلة (status != draft)
CREATE OR REPLACE FUNCTION public.prevent_delete_posted_sales_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS NOT NULL AND OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'لا يمكن حذف فاتورة مرحّلة. غيّر حالتها إلى مسودة أولاً (إن كان مسموحاً).';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_delete_posted_sales_invoice ON public.sales_invoices;
CREATE TRIGGER trg_prevent_delete_posted_sales_invoice
BEFORE DELETE ON public.sales_invoices
FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_posted_sales_invoice();

CREATE OR REPLACE FUNCTION public.prevent_delete_posted_purchase_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS NOT NULL AND OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'لا يمكن حذف فاتورة مرحّلة.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_delete_posted_purchase_invoice ON public.purchase_invoices;
CREATE TRIGGER trg_prevent_delete_posted_purchase_invoice
BEFORE DELETE ON public.purchase_invoices
FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_posted_purchase_invoice();

-- 5. تريجر تحديث paid_amount وحالة الفاتورة تلقائياً عند تخصيص دفعة/قبض
CREATE OR REPLACE FUNCTION public.update_sales_invoice_paid_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _invoice_id uuid;
  _total_paid numeric;
  _total_amount numeric;
BEGIN
  _invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  SELECT COALESCE(SUM(allocated_amount), 0) INTO _total_paid
  FROM public.collection_allocations WHERE invoice_id = _invoice_id;
  
  SELECT total_amount INTO _total_amount
  FROM public.sales_invoices WHERE id = _invoice_id;
  
  UPDATE public.sales_invoices
  SET paid_amount = _total_paid,
      status = CASE
        WHEN _total_paid >= COALESCE(_total_amount, 0) AND _total_paid > 0 THEN 'paid'::invoice_status
        WHEN _total_paid > 0 THEN 'partially_paid'::invoice_status
        WHEN status IN ('paid', 'partially_paid') THEN 'confirmed'::invoice_status
        ELSE status
      END,
      updated_at = now()
  WHERE id = _invoice_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_update_sales_invoice_paid ON public.collection_allocations;
CREATE TRIGGER trg_update_sales_invoice_paid
AFTER INSERT OR UPDATE OR DELETE ON public.collection_allocations
FOR EACH ROW EXECUTE FUNCTION public.update_sales_invoice_paid_amount();

-- 6. تريجر مماثل لفواتير الشراء
CREATE OR REPLACE FUNCTION public.update_purchase_invoice_paid_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _invoice_id uuid;
  _total_paid numeric;
  _total_amount numeric;
BEGIN
  _invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  SELECT COALESCE(SUM(allocated_amount), 0) INTO _total_paid
  FROM public.payment_allocations WHERE invoice_id = _invoice_id;
  
  SELECT total_amount INTO _total_amount
  FROM public.purchase_invoices WHERE id = _invoice_id;
  
  UPDATE public.purchase_invoices
  SET paid_amount = _total_paid,
      status = CASE
        WHEN _total_paid >= COALESCE(_total_amount, 0) AND _total_paid > 0 THEN 'paid'::invoice_status
        WHEN _total_paid > 0 THEN 'partially_paid'::invoice_status
        WHEN status IN ('paid', 'partially_paid') THEN 'confirmed'::invoice_status
        ELSE status
      END,
      updated_at = now()
  WHERE id = _invoice_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_update_purchase_invoice_paid ON public.payment_allocations;
CREATE TRIGGER trg_update_purchase_invoice_paid
AFTER INSERT OR UPDATE OR DELETE ON public.payment_allocations
FOR EACH ROW EXECUTE FUNCTION public.update_purchase_invoice_paid_amount();

-- 7. منع تخصيص أكثر من المبلغ المتبقي على الفاتورة
CREATE OR REPLACE FUNCTION public.validate_collection_allocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _invoice_total numeric;
  _already_paid numeric;
  _remaining numeric;
BEGIN
  SELECT total_amount INTO _invoice_total FROM public.sales_invoices WHERE id = NEW.invoice_id;
  SELECT COALESCE(SUM(allocated_amount), 0) INTO _already_paid
  FROM public.collection_allocations 
  WHERE invoice_id = NEW.invoice_id AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  _remaining := COALESCE(_invoice_total, 0) - _already_paid;
  
  IF NEW.allocated_amount > _remaining + 0.01 THEN
    RAISE EXCEPTION 'المبلغ المخصص (%) يتجاوز المتبقي على الفاتورة (%)', NEW.allocated_amount, _remaining;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_collection_allocation ON public.collection_allocations;
CREATE TRIGGER trg_validate_collection_allocation
BEFORE INSERT OR UPDATE ON public.collection_allocations
FOR EACH ROW EXECUTE FUNCTION public.validate_collection_allocation();

CREATE OR REPLACE FUNCTION public.validate_payment_allocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _invoice_total numeric;
  _already_paid numeric;
  _remaining numeric;
BEGIN
  SELECT total_amount INTO _invoice_total FROM public.purchase_invoices WHERE id = NEW.invoice_id;
  SELECT COALESCE(SUM(allocated_amount), 0) INTO _already_paid
  FROM public.payment_allocations 
  WHERE invoice_id = NEW.invoice_id AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  _remaining := COALESCE(_invoice_total, 0) - _already_paid;
  
  IF NEW.allocated_amount > _remaining + 0.01 THEN
    RAISE EXCEPTION 'المبلغ المخصص (%) يتجاوز المتبقي على الفاتورة (%)', NEW.allocated_amount, _remaining;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_payment_allocation ON public.payment_allocations;
CREATE TRIGGER trg_validate_payment_allocation
BEFORE INSERT OR UPDATE ON public.payment_allocations
FOR EACH ROW EXECUTE FUNCTION public.validate_payment_allocation();