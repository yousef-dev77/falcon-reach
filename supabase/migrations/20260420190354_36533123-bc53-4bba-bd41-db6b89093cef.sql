-- ============================================
-- إعدادات النظام: حسابات افتراضية
-- ============================================
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, category, description) VALUES
  ('default_inventory_account_id', NULL, 'text', 'accounting', 'حساب المخزون الافتراضي'),
  ('default_cogs_account_id', NULL, 'text', 'accounting', 'حساب تكلفة البضاعة المباعة (COGS)'),
  ('default_sales_revenue_account_id', NULL, 'text', 'accounting', 'حساب إيرادات المبيعات الافتراضي'),
  ('default_purchases_account_id', NULL, 'text', 'accounting', 'حساب المشتريات الافتراضي'),
  ('auto_create_inventory_movement', 'true', 'boolean', 'inventory', 'إنشاء حركة مخزون تلقائياً عند تأكيد الفواتير')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================
-- دالة: تحديث متوسط التكلفة المرجح للمنتج
-- ============================================
CREATE OR REPLACE FUNCTION public.update_product_weighted_avg_cost(
  _product_id uuid,
  _new_quantity numeric,
  _new_unit_cost numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_qty numeric := 0;
  _current_cost numeric := 0;
  _new_avg_cost numeric;
BEGIN
  -- حساب الكمية الحالية في المخزون
  SELECT COALESCE(SUM(quantity), 0) INTO _current_qty
  FROM public.inventory_movements
  WHERE product_id = _product_id;
  
  -- التكلفة الحالية
  SELECT COALESCE(cost_price, 0) INTO _current_cost
  FROM public.products WHERE id = _product_id;
  
  -- متوسط مرجح
  IF (_current_qty + _new_quantity) > 0 THEN
    _new_avg_cost := ((_current_qty * _current_cost) + (_new_quantity * _new_unit_cost)) 
                     / (_current_qty + _new_quantity);
  ELSE
    _new_avg_cost := _new_unit_cost;
  END IF;
  
  UPDATE public.products 
  SET cost_price = _new_avg_cost, updated_at = now()
  WHERE id = _product_id;
END;
$$;

-- ============================================
-- Trigger: عند تأكيد فاتورة شراء، إنشاء حركات مخزون "وارد"
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_purchase_invoice_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _line RECORD;
  _movement_number text;
  _branch_id uuid;
  _auto_movement boolean;
BEGIN
  -- فقط عند الانتقال من draft إلى confirmed
  IF (OLD.status = 'draft' OR OLD.status IS NULL) AND NEW.status = 'confirmed' THEN
    
    -- التحقق من تفعيل الإعداد
    SELECT (setting_value = 'true') INTO _auto_movement 
    FROM public.system_settings WHERE setting_key = 'auto_create_inventory_movement';
    
    IF _auto_movement IS NOT TRUE THEN RETURN NEW; END IF;
    IF NEW.warehouse_id IS NULL THEN RETURN NEW; END IF;
    
    _branch_id := NEW.branch_id;
    
    -- إنشاء حركة لكل بند
    FOR _line IN 
      SELECT * FROM public.purchase_invoice_lines WHERE invoice_id = NEW.id
    LOOP
      -- توليد رقم الحركة
      IF _branch_id IS NOT NULL THEN
        _movement_number := public.get_next_document_number(_branch_id, 'movement');
      ELSE
        _movement_number := 'MOV-' || to_char(now(), 'YYYYMMDD-HH24MISS') || '-' || substr(_line.id::text, 1, 4);
      END IF;
      
      INSERT INTO public.inventory_movements (
        movement_number, movement_date, product_id, warehouse_id,
        quantity, unit_cost, reference, notes, created_by
      ) VALUES (
        _movement_number, NEW.invoice_date, _line.product_id, NEW.warehouse_id,
        _line.quantity, _line.unit_price, NEW.invoice_number,
        'وارد - فاتورة شراء ' || NEW.invoice_number, NEW.created_by
      );
      
      -- تحديث متوسط التكلفة
      PERFORM public.update_product_weighted_avg_cost(
        _line.product_id, _line.quantity, _line.unit_price
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchase_invoice_confirmation ON public.purchase_invoices;
CREATE TRIGGER trg_purchase_invoice_confirmation
AFTER UPDATE ON public.purchase_invoices
FOR EACH ROW
EXECUTE FUNCTION public.handle_purchase_invoice_confirmation();

-- ============================================
-- Trigger: عند تأكيد فاتورة مبيعات، إنشاء حركة "صادر" + قيد COGS
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_sales_invoice_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _line RECORD;
  _movement_number text;
  _branch_id uuid;
  _auto_movement boolean;
  _accounting_mode text;
  _cogs_account_id uuid;
  _inventory_account_id uuid;
  _total_cogs numeric := 0;
  _product_cost numeric;
  _entry_id uuid;
  _entry_number text;
BEGIN
  IF (OLD.status = 'draft' OR OLD.status IS NULL) AND NEW.status = 'confirmed' THEN
    
    SELECT (setting_value = 'true') INTO _auto_movement 
    FROM public.system_settings WHERE setting_key = 'auto_create_inventory_movement';
    
    IF _auto_movement IS NOT TRUE THEN RETURN NEW; END IF;
    IF NEW.warehouse_id IS NULL THEN RETURN NEW; END IF;
    
    _branch_id := NEW.branch_id;
    
    -- إنشاء حركات الصادر
    FOR _line IN 
      SELECT pil.*, p.cost_price 
      FROM public.sales_invoice_lines pil
      LEFT JOIN public.products p ON p.id = pil.product_id
      WHERE pil.invoice_id = NEW.id
    LOOP
      IF _branch_id IS NOT NULL THEN
        _movement_number := public.get_next_document_number(_branch_id, 'movement');
      ELSE
        _movement_number := 'MOV-' || to_char(now(), 'YYYYMMDD-HH24MISS') || '-' || substr(_line.id::text, 1, 4);
      END IF;
      
      _product_cost := COALESCE(_line.cost_price, 0);
      
      INSERT INTO public.inventory_movements (
        movement_number, movement_date, product_id, warehouse_id,
        quantity, unit_cost, reference, notes, created_by
      ) VALUES (
        _movement_number, NEW.invoice_date, _line.product_id, NEW.warehouse_id,
        -_line.quantity, _product_cost, NEW.invoice_number,
        'صادر - فاتورة مبيعات ' || NEW.invoice_number, NEW.created_by
      );
      
      _total_cogs := _total_cogs + (_line.quantity * _product_cost);
    END LOOP;
    
    -- إنشاء قيد COGS (وضع المخزون المستمر)
    SELECT setting_value INTO _accounting_mode 
    FROM public.system_settings WHERE setting_key = 'inventory_accounting_mode';
    
    IF _accounting_mode = 'perpetual' AND _total_cogs > 0 THEN
      SELECT setting_value::uuid INTO _cogs_account_id 
      FROM public.system_settings WHERE setting_key = 'default_cogs_account_id' AND setting_value IS NOT NULL;
      
      SELECT setting_value::uuid INTO _inventory_account_id 
      FROM public.system_settings WHERE setting_key = 'default_inventory_account_id' AND setting_value IS NOT NULL;
      
      IF _cogs_account_id IS NOT NULL AND _inventory_account_id IS NOT NULL THEN
        IF _branch_id IS NOT NULL THEN
          _entry_number := public.get_next_document_number(_branch_id, 'journal_entry');
        ELSE
          _entry_number := 'JE-COGS-' || to_char(now(), 'YYYYMMDDHH24MISS');
        END IF;
        
        INSERT INTO public.journal_entries (
          entry_number, entry_date, description, reference,
          branch_id, created_by, is_posted
        ) VALUES (
          _entry_number, NEW.invoice_date, 
          'تكلفة بضاعة مباعة - فاتورة ' || NEW.invoice_number,
          NEW.invoice_number, _branch_id, NEW.created_by, true
        ) RETURNING id INTO _entry_id;
        
        INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
        VALUES 
          (_entry_id, _cogs_account_id, _total_cogs, 0, 'تكلفة البضاعة المباعة'),
          (_entry_id, _inventory_account_id, 0, _total_cogs, 'تخفيض المخزون');
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_invoice_confirmation ON public.sales_invoices;
CREATE TRIGGER trg_sales_invoice_confirmation
AFTER UPDATE ON public.sales_invoices
FOR EACH ROW
EXECUTE FUNCTION public.handle_sales_invoice_confirmation();

-- ============================================
-- منع تعديل بنود الفواتير المؤكدة
-- ============================================
CREATE OR REPLACE FUNCTION public.prevent_modify_confirmed_invoice_lines()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _status text;
BEGIN
  IF TG_TABLE_NAME = 'sales_invoice_lines' THEN
    SELECT status::text INTO _status FROM public.sales_invoices 
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  ELSIF TG_TABLE_NAME = 'purchase_invoice_lines' THEN
    SELECT status::text INTO _status FROM public.purchase_invoices 
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  END IF;
  
  IF _status IS NOT NULL AND _status <> 'draft' THEN
    RAISE EXCEPTION 'لا يمكن تعديل بنود فاتورة مؤكدة. أعد الفاتورة لمسودة أولاً.';
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_sales_invoice_lines ON public.sales_invoice_lines;
CREATE TRIGGER trg_protect_sales_invoice_lines
BEFORE INSERT OR UPDATE OR DELETE ON public.sales_invoice_lines
FOR EACH ROW
EXECUTE FUNCTION public.prevent_modify_confirmed_invoice_lines();

DROP TRIGGER IF EXISTS trg_protect_purchase_invoice_lines ON public.purchase_invoice_lines;
CREATE TRIGGER trg_protect_purchase_invoice_lines
BEFORE INSERT OR UPDATE OR DELETE ON public.purchase_invoice_lines
FOR EACH ROW
EXECUTE FUNCTION public.prevent_modify_confirmed_invoice_lines();

-- ============================================
-- ربط الـ triggers الموجودة من الدفعة 1
-- ============================================
DROP TRIGGER IF EXISTS trg_update_sales_paid ON public.collection_allocations;
CREATE TRIGGER trg_update_sales_paid
AFTER INSERT OR UPDATE OR DELETE ON public.collection_allocations
FOR EACH ROW
EXECUTE FUNCTION public.update_sales_invoice_paid_amount();

DROP TRIGGER IF EXISTS trg_update_purchase_paid ON public.payment_allocations;
CREATE TRIGGER trg_update_purchase_paid
AFTER INSERT OR UPDATE OR DELETE ON public.payment_allocations
FOR EACH ROW
EXECUTE FUNCTION public.update_purchase_invoice_paid_amount();

DROP TRIGGER IF EXISTS trg_validate_collection_alloc ON public.collection_allocations;
CREATE TRIGGER trg_validate_collection_alloc
BEFORE INSERT OR UPDATE ON public.collection_allocations
FOR EACH ROW
EXECUTE FUNCTION public.validate_collection_allocation();

DROP TRIGGER IF EXISTS trg_validate_payment_alloc ON public.payment_allocations;
CREATE TRIGGER trg_validate_payment_alloc
BEFORE INSERT OR UPDATE ON public.payment_allocations
FOR EACH ROW
EXECUTE FUNCTION public.validate_payment_allocation();

DROP TRIGGER IF EXISTS trg_prevent_delete_collection ON public.collections;
CREATE TRIGGER trg_prevent_delete_collection
BEFORE DELETE ON public.collections
FOR EACH ROW
EXECUTE FUNCTION public.prevent_delete_allocated_collection();

DROP TRIGGER IF EXISTS trg_prevent_delete_payment ON public.payments;
CREATE TRIGGER trg_prevent_delete_payment
BEFORE DELETE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.prevent_delete_allocated_payment();

DROP TRIGGER IF EXISTS trg_prevent_delete_posted_sales ON public.sales_invoices;
CREATE TRIGGER trg_prevent_delete_posted_sales
BEFORE DELETE ON public.sales_invoices
FOR EACH ROW
EXECUTE FUNCTION public.prevent_delete_posted_sales_invoice();

DROP TRIGGER IF EXISTS trg_prevent_delete_posted_purchase ON public.purchase_invoices;
CREATE TRIGGER trg_prevent_delete_posted_purchase
BEFORE DELETE ON public.purchase_invoices
FOR EACH ROW
EXECUTE FUNCTION public.prevent_delete_posted_purchase_invoice();