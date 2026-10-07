DO $$ DECLARE d text; BEGIN
  SELECT pg_get_functiondef('public.post_asset_depreciation'::regproc) INTO d;
  d := replace(d, 'IF s.period_date > CURRENT_DATE THEN RAISE EXCEPTION ''لا يمكن ترحيل قسط مستقبلي''; END IF;',
    'IF date_trunc(''month'', s.period_date) > date_trunc(''month'', CURRENT_DATE) THEN RAISE EXCEPTION ''لا يمكن ترحيل قسط شهر لم يبدأ بعد''; END IF;');
  EXECUTE d;
END $$;