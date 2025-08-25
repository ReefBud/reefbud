-- OPTIONAL demo products + link preferred
DO $$
DECLARE uid uuid; tid uuid;
  pid_alk int; pid_ca int; pid_mg int; pid_po4 int; pid_no3 int;
BEGIN
  SELECT id INTO uid FROM auth.users ORDER BY created_at DESC LIMIT 1;
  IF uid IS NULL THEN RAISE NOTICE 'No users'; RETURN; END IF;

  SELECT id INTO tid FROM public.tanks WHERE user_id=uid ORDER BY created_at LIMIT 1;
  IF tid IS NULL THEN RAISE NOTICE 'No tank'; RETURN; END IF;

  SELECT id INTO pid_alk FROM public.parameters WHERE key='alk';
  SELECT id INTO pid_ca  FROM public.parameters WHERE key='ca';
  SELECT id INTO pid_mg  FROM public.parameters WHERE key='mg';
  SELECT id INTO pid_po4 FROM public.parameters WHERE key='po4';
  SELECT id INTO pid_no3 FROM public.parameters WHERE key='no3';

  INSERT INTO public.products(id, user_id, brand, name, parameter_id, dose_ref_ml, delta_ref_value, volume_ref_liters, helper_text)
  SELECT gen_random_uuid(), uid, 'Demo', 'Alk Buffer', pid_alk, 30, 1.5, 100, 'Demo potency'
  WHERE pid_alk IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.products WHERE user_id=uid AND parameter_id=pid_alk);
  INSERT INTO public.products(id, user_id, brand, name, parameter_id, dose_ref_ml, delta_ref_value, volume_ref_liters, helper_text)
  SELECT gen_random_uuid(), uid, 'Demo', 'Calcium Part', pid_ca, 30, 15, 100, 'Demo potency'
  WHERE pid_ca IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.products WHERE user_id=uid AND parameter_id=pid_ca);
  INSERT INTO public.products(id, user_id, brand, name, parameter_id, dose_ref_ml, delta_ref_value, volume_ref_liters, helper_text)
  SELECT gen_random_uuid(), uid, 'Demo', 'Magnesium Part', pid_mg, 30, 30, 100, 'Demo potency'
  WHERE pid_mg IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.products WHERE user_id=uid AND parameter_id=pid_mg);
  INSERT INTO public.products(id, user_id, brand, name, parameter_id, dose_ref_ml, delta_ref_value, volume_ref_liters, helper_text)
  SELECT gen_random_uuid(), uid, 'Demo', 'Phosphate Reducer', pid_po4, 30, 0.02, 100, 'Demo potency'
  WHERE pid_po4 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.products WHERE user_id=uid AND parameter_id=pid_po4);
  INSERT INTO public.products(id, user_id, brand, name, parameter_id, dose_ref_ml, delta_ref_value, volume_ref_liters, helper_text)
  SELECT gen_random_uuid(), uid, 'Demo', 'Nitrate Reducer', pid_no3, 30, 2.0, 100, 'Demo potency'
  WHERE pid_no3 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.products WHERE user_id=uid AND parameter_id=pid_no3);

  INSERT INTO public.preferred_products(user_id, tank_id, parameter_id, product_id)
  SELECT uid, tid, p.parameter_id, p.id
  FROM public.products p
  WHERE p.user_id = uid AND p.parameter_id IS NOT NULL
    AND COALESCE(p.dose_ref_ml,0) > 0 AND COALESCE(p.delta_ref_value,0) > 0 AND COALESCE(p.volume_ref_liters,0) > 0
    AND NOT EXISTS (SELECT 1 FROM public.preferred_products pp WHERE pp.user_id=uid AND pp.tank_id=tid AND pp.parameter_id=p.parameter_id);
  RAISE NOTICE 'Demo products created/linked where needed.';
END$$;
