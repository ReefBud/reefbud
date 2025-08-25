-- Ensure preferred_products has the required unique key for upserts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='preferred_products_user_tank_param_key'
  ) THEN
    CREATE UNIQUE INDEX preferred_products_user_tank_param_key
      ON public.preferred_products (user_id, tank_id, parameter_id);
  END IF;
END$$;

-- RLS reminder (should already exist in your project)
-- Products: SELECT where (user_id IS NULL OR user_id = auth.uid())
-- Preferred_products: SELECT/INSERT/UPDATE/DELETE where (user_id = auth.uid())
