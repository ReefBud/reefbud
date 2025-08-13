-- Seed/update targets for latest user (no ON CONFLICT)
DO $$ DECLARE uid uuid; BEGIN
  SELECT id INTO uid FROM auth.users ORDER BY created_at DESC LIMIT 1;
  IF uid IS NULL THEN RAISE NOTICE 'No users in auth.users'; RETURN; END IF;

  IF EXISTS (SELECT 1 FROM public.targets WHERE user_id = uid) THEN
    UPDATE public.targets
      SET alk=8.2, ca=430, mg=1400, po4=0.03, no3=5, salinity=35, updated_at=now()
      WHERE user_id=uid;
  ELSE
    INSERT INTO public.targets (user_id, alk, ca, mg, po4, no3, salinity, updated_at)
    VALUES (uid, 8.2, 430, 1400, 0.03, 5, 35, now());
  END IF;
END$$;
