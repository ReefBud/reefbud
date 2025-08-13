
-- Set volume_liters for the most recent user's first tank.
-- Edit desired_liters before running.
DO $$
DECLARE
  uid uuid;
  tid uuid;
  desired_liters numeric := 250; -- <--- CHANGE THIS
BEGIN
  SELECT id INTO uid FROM auth.users ORDER BY created_at DESC LIMIT 1;
  IF uid IS NULL THEN
    RAISE NOTICE 'No users found.';
    RETURN;
  END IF;

  SELECT id INTO tid FROM public.tanks WHERE user_id = uid ORDER BY created_at LIMIT 1;
  IF tid IS NULL THEN
    INSERT INTO public.tanks (user_id, name, volume_liters)
    VALUES (uid, 'My Tank', desired_liters)
    RETURNING id INTO tid;
  ELSE
    UPDATE public.tanks SET volume_liters = desired_liters WHERE id = tid;
  END IF;

  RAISE NOTICE 'Tank % set to % liters.', tid, desired_liters;
END$$;
