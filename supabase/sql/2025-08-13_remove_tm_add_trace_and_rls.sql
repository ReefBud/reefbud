BEGIN;

-- 0) Ensure products.user_id exists (if older schema didn't have it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='products' AND column_name='user_id'
  ) THEN
    ALTER TABLE public.products ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END$$;

-- 1) Remove Tropic Marin products (and any references), so only manual entries remain
--    If preferred_products references exist, remove those first to avoid FK errors.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='preferred_products'
  ) THEN
    DELETE FROM public.preferred_products
    WHERE product_id IN (
      SELECT id FROM public.products WHERE brand = 'Tropic Marin'
    );
  END IF;
END$$;

DELETE FROM public.products WHERE brand = 'Tropic Marin';

-- 2) Tighten RLS on products: users can only see/modify their own rows.
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Drop legacy policies if present
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='products' AND policyname='products_select_policy'
  ) THEN
    DROP POLICY products_select_policy ON public.products;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='products' AND policyname='products_modify_policy'
  ) THEN
    DROP POLICY products_modify_policy ON public.products;
  END IF;
END $$;

-- Select own only
CREATE POLICY products_select_policy ON public.products
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Insert/Update/Delete own only
CREATE POLICY products_modify_policy ON public.products
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Ensure DELETE privilege (RLS still enforces row ownership)
GRANT DELETE ON TABLE public.products TO authenticated;

-- 3) Add new parameters for Trace Elements A- and K+
--    If your parameters table lacks display_name, this will still upsert unit/key; you can add display_name later.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='parameters' AND column_name='display_name'
  ) THEN
    -- display_name is optional in some older schemas
    INSERT INTO public.parameters (key, unit) VALUES
      ('trace_anions',  'ppm'),
      ('trace_cations', 'ppm')
    ON CONFLICT (key) DO UPDATE SET unit = EXCLUDED.unit;
  ELSE
    INSERT INTO public.parameters (key, unit, display_name) VALUES
      ('trace_anions',  'ppm', 'Trace Elements A-'),
      ('trace_cations', 'ppm', 'Trace Elements K+')
    ON CONFLICT (key) DO UPDATE SET unit = EXCLUDED.unit, display_name = EXCLUDED.display_name;
  END IF;
END $$;

COMMIT;