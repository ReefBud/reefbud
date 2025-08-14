-- Optional current-dose columns
ALTER TABLE IF EXISTS public.regimes
  ADD COLUMN IF NOT EXISTS alk_daily_ml numeric,
  ADD COLUMN IF NOT EXISTS ca_daily_ml numeric,
  ADD COLUMN IF NOT EXISTS mg_daily_ml numeric;
