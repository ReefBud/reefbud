-- V3: Ensure preferred_products upsert key exists (user_id, tank_id, parameter_id)
DO $$
BEGIN
  -- Only create if all three columns exist; otherwise skip silently
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='preferred_products' AND column_name='user_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='preferred_products' AND column_name='tank_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='preferred_products' AND column_name='parameter_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname='public' AND indexname='preferred_products_user_tank_param_key'
    ) THEN
      CREATE UNIQUE INDEX preferred_products_user_tank_param_key
        ON public.preferred_products (user_id, tank_id, parameter_id);
    END IF;
  END IF;
END $$;
