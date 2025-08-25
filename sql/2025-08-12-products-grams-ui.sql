-- 2025-08-12: Products UI + grams_per_liter support, simplified listing (no Your/Global sections)

BEGIN;

-- Ensure column grams_per_liter exists on products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='products' AND column_name='grams_per_liter'
  ) THEN
    ALTER TABLE public.products
      ADD COLUMN grams_per_liter NUMERIC;
  END IF;
END$$;

-- Ensure potency reference columns exist (for preview like '10 ml -> +15 ppm in 200 L')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='products' AND column_name='dose_ref_ml'
  ) THEN
    ALTER TABLE public.products
      ADD COLUMN dose_ref_ml NUMERIC;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='products' AND column_name='delta_ref_value'
  ) THEN
    ALTER TABLE public.products
      ADD COLUMN delta_ref_value NUMERIC;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='products' AND column_name='volume_ref_liters'
  ) THEN
    ALTER TABLE public.products
      ADD COLUMN volume_ref_liters NUMERIC;
  END IF;
END$$;

-- Helpful uniqueness for upsert: scope by user (null=user = global), brand, name, parameter
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='products_unique_user_brand_name_param'
  ) THEN
    CREATE UNIQUE INDEX products_unique_user_brand_name_param
      ON public.products (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid), brand, name, parameter_id);
  END IF;
END$$;

COMMIT;
