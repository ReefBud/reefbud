-- Auto-link preferred products where potency exists
DO $$ DECLARE uid uuid; tid uuid; BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='preferred_products') THEN
    RAISE NOTICE 'preferred_products table not found — skipping'; RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='products') THEN
    RAISE NOTICE 'products table not found — skipping'; RETURN; END IF;

  SELECT id INTO uid FROM auth.users ORDER BY created_at DESC LIMIT 1;
  IF uid IS NULL THEN RAISE NOTICE 'No users'; RETURN; END IF;

  SELECT id INTO tid FROM public.tanks WHERE user_id=uid ORDER BY created_at LIMIT 1;
  IF tid IS NULL THEN RAISE NOTICE 'No tank'; RETURN; END IF;

  INSERT INTO public.preferred_products(user_id, tank_id, parameter_id, product_id)
  SELECT uid, tid, p.parameter_id, p.id
  FROM public.products p
  WHERE p.user_id = uid
    AND p.parameter_id IS NOT NULL
    AND COALESCE(p.dose_ref_ml,0) > 0
    AND COALESCE(p.delta_ref_value,0) > 0
    AND COALESCE(p.volume_ref_liters,0) > 0
    AND NOT EXISTS (SELECT 1 FROM public.preferred_products pp WHERE pp.user_id=uid AND pp.tank_id=tid AND pp.parameter_id=p.parameter_id);
  RAISE NOTICE 'Preferred products linked where possible.';
END$$;
