
-- Ensure readings.value exists and backfill from likely legacy columns.
BEGIN;

ALTER TABLE public.readings
  ADD COLUMN IF NOT EXISTS value numeric;

-- Try to backfill from common legacy numeric columns if present
DO $$
DECLARE
  col text;
  dtype text;
BEGIN
  FOR col IN
    SELECT c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name='readings'
      AND c.column_name IN ('reading','result','measure','measurement','reading_value','value_ppm','value_dkh','val','ppm','dkh')
  LOOP
    SELECT data_type INTO dtype
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='readings' AND column_name=col;

    IF dtype LIKE 'integer%' OR dtype LIKE 'numeric%' OR dtype LIKE 'double precision%' OR dtype LIKE 'real%' OR dtype LIKE 'bigint%' THEN
      EXECUTE format('UPDATE public.readings SET value = COALESCE(value, %I) WHERE value IS NULL', col);
    END IF;
  END LOOP;
END$$;

COMMIT;
