
-- Seed one recent reading per parameter for the latest user's first tank.
-- Edit the values below before running.
DO $$
DECLARE
  uid uuid;
  tid uuid;
  v_alk  numeric := 7.8;
  v_ca   numeric := 420;
  v_mg   numeric := 1350;
  v_po4  numeric := 0.04;
  v_no3  numeric := 6;
  pid_alk int;
  pid_ca  int;
  pid_mg  int;
  pid_po4 int;
  pid_no3 int;
BEGIN
  SELECT id INTO uid FROM auth.users ORDER BY created_at DESC LIMIT 1;
  IF uid IS NULL THEN
    RAISE NOTICE 'No users found.';
    RETURN;
  END IF;

  SELECT id INTO tid FROM public.tanks WHERE user_id = uid ORDER BY created_at LIMIT 1;
  IF tid IS NULL THEN
    RAISE NOTICE 'No tank found. Create a tank first.';
    RETURN;
  END IF;

  SELECT id INTO pid_alk FROM public.parameters WHERE key = 'alk';
  SELECT id INTO pid_ca  FROM public.parameters WHERE key = 'ca';
  SELECT id INTO pid_mg  FROM public.parameters WHERE key = 'mg';
  SELECT id INTO pid_po4 FROM public.parameters WHERE key = 'po4';
  SELECT id INTO pid_no3 FROM public.parameters WHERE key = 'no3';

  IF pid_alk IS NOT NULL THEN
    INSERT INTO public.readings (tank_id, parameter_id, value, measured_at)
    VALUES (tid, pid_alk, v_alk, now());
  END IF;
  IF pid_ca IS NOT NULL THEN
    INSERT INTO public.readings (tank_id, parameter_id, value, measured_at)
    VALUES (tid, pid_ca, v_ca, now());
  END IF;
  IF pid_mg IS NOT NULL THEN
    INSERT INTO public.readings (tank_id, parameter_id, value, measured_at)
    VALUES (tid, pid_mg, v_mg, now());
  END IF;
  IF pid_po4 IS NOT NULL THEN
    INSERT INTO public.readings (tank_id, parameter_id, value, measured_at)
    VALUES (tid, pid_po4, v_po4, now());
  END IF;
  IF pid_no3 IS NOT NULL THEN
    INSERT INTO public.readings (tank_id, parameter_id, value, measured_at)
    VALUES (tid, pid_no3, v_no3, now());
  END IF;

  RAISE NOTICE 'Seeded readings for tank %', tid;
END$$;
