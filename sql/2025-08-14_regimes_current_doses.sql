-- Optional: store user's current daily doses (ml/day) so the assistant doesn't need to ask every time
-- Safe to run multiple times
ALTER TABLE IF EXISTS public.regimes
  ADD COLUMN IF NOT EXISTS alk_daily_ml numeric,
  ADD COLUMN IF NOT EXISTS ca_daily_ml numeric,
  ADD COLUMN IF NOT EXISTS mg_daily_ml numeric;
