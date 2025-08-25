-- 00_fix_schema.sql — idempotent schema repair
BEGIN;
ALTER TABLE public.tanks ADD COLUMN IF NOT EXISTS volume_liters numeric;
ALTER TABLE public.tanks ADD COLUMN IF NOT EXISTS user_id uuid;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.tanks'::regclass AND conname='tanks_user_id_fkey') THEN
    ALTER TABLE public.tanks ADD CONSTRAINT tanks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.targets (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  alk numeric, ca numeric, mg numeric, po4 numeric, no3 numeric, salinity numeric,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.readings ADD COLUMN IF NOT EXISTS parameter_id integer;
ALTER TABLE public.readings ADD COLUMN IF NOT EXISTS measured_at timestamptz;
ALTER TABLE public.readings ADD COLUMN IF NOT EXISTS value numeric;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tanks' AND column_name='volume') THEN
    EXECUTE 'UPDATE public.tanks SET volume_liters = COALESCE(volume_liters, volume)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tanks' AND column_name='liters') THEN
    EXECUTE 'UPDATE public.tanks SET volume_liters = COALESCE(volume_liters, liters)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tanks' AND column_name='tank_volume') THEN
    EXECUTE 'UPDATE public.tanks SET volume_liters = COALESCE(volume_liters, tank_volume)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tanks' AND column_name='size_liters') THEN
    EXECUTE 'UPDATE public.tanks SET volume_liters = COALESCE(volume_liters, size_liters)';
  END IF;
END$$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='readings' AND column_name='created_at') THEN
    EXECUTE 'UPDATE public.readings SET measured_at = COALESCE(measured_at, created_at) WHERE measured_at IS NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='readings' AND column_name='inserted_at') THEN
    EXECUTE 'UPDATE public.readings SET measured_at = COALESCE(measured_at, inserted_at) WHERE measured_at IS NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='readings' AND column_name='recorded_at') THEN
    EXECUTE 'UPDATE public.readings SET measured_at = COALESCE(measured_at, recorded_at) WHERE measured_at IS NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='readings' AND column_name='taken_at') THEN
    EXECUTE 'UPDATE public.readings SET measured_at = COALESCE(measured_at, taken_at) WHERE measured_at IS NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='readings' AND column_name='timestamp') THEN
    EXECUTE 'UPDATE public.readings SET measured_at = COALESCE(measured_at, "timestamp") WHERE measured_at IS NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='readings' AND column_name='measured_on') THEN
    EXECUTE 'UPDATE public.readings SET measured_at = COALESCE(measured_at, measured_on) WHERE measured_at IS NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='readings' AND column_name='date') THEN
    EXECUTE 'UPDATE public.readings SET measured_at = COALESCE(measured_at, (date::timestamptz)) WHERE measured_at IS NULL';
  END IF;
END$$;

DO $$ DECLARE v_type text; BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='readings' AND column_name='parameter_key') THEN
    EXECUTE $$UPDATE public.readings r SET parameter_id = p.id FROM public.parameters p WHERE r.parameter_id IS NULL AND r.parameter_key = p.key$$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='readings' AND column_name='param_key') THEN
    EXECUTE $$UPDATE public.readings r SET parameter_id = p.id FROM public.parameters p WHERE r.parameter_id IS NULL AND r.param_key = p.key$$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='readings' AND column_name='parameter') THEN
    SELECT data_type INTO v_type FROM information_schema.columns WHERE table_schema='public' AND table_name='readings' AND column_name='parameter';
    IF v_type LIKE 'integer%' OR v_type LIKE 'numeric%' OR v_type LIKE 'bigint%' THEN
      EXECUTE 'UPDATE public.readings r SET parameter_id = r.parameter WHERE r.parameter_id IS NULL';
    ELSE
      EXECUTE $$UPDATE public.readings r SET parameter_id = p.id FROM public.parameters p WHERE r.parameter_id IS NULL AND r.parameter = p.key$$;
    END IF;
  END IF;
END$$;

UPDATE public.readings SET measured_at = now() WHERE measured_at IS NULL;

DO $$ BEGIN
  BEGIN
    ALTER TABLE public.readings ADD CONSTRAINT readings_parameter_id_fkey FOREIGN KEY (parameter_id) REFERENCES public.parameters(id) ON DELETE SET NULL;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='readings' AND indexname='idx_readings_tank_param_time') THEN
    EXECUTE 'CREATE INDEX idx_readings_tank_param_time ON public.readings(tank_id, parameter_id, measured_at DESC)';
  END IF;
END$$;
COMMIT;
