-- Create/find tank and ensure volume_liters
DO $$ DECLARE uid uuid; tid uuid; BEGIN
  SELECT id INTO uid FROM auth.users ORDER BY created_at DESC LIMIT 1;
  IF uid IS NULL THEN RAISE NOTICE 'No users'; RETURN; END IF;

  SELECT id INTO tid FROM public.tanks WHERE user_id=uid ORDER BY created_at LIMIT 1;
  IF tid IS NULL THEN
    INSERT INTO public.tanks (user_id, name, volume_liters) VALUES (uid,'My Tank',200) RETURNING id INTO tid;
  END IF;

  UPDATE public.tanks SET volume_liters = COALESCE(volume_liters,200) WHERE id=tid;
  RAISE NOTICE 'Tank % set with volume_liters', tid;
END$$;
