DO $$ DECLARE d text; BEGIN
  SELECT pg_get_functiondef('public.generate_asset_depreciation_schedule'::regproc) INTO d;
  d := replace(d, 'IF NOT FOUND THEN RAISE EXCEPTION ''الأصل غير موجود''; END IF;',
    'IF NOT FOUND THEN RAISE EXCEPTION ''الأصل غير موجود''; END IF;
  IF a.depreciation_start_date IS NULL THEN RAISE EXCEPTION ''حدد تاريخ بداية الإهلاك في بطاقة الأصل قبل احتساب الأقساط''; END IF;
  IF a.status = ''disposed'' THEN RAISE EXCEPTION ''الأصل مستبعد''; END IF;');
  d := replace(d, 'COALESCE(a.depreciation_start_date, a.purchase_date)', 'a.depreciation_start_date');
  EXECUTE d;
END $$;