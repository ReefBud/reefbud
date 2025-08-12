-- 2025-08-12: Basic results table with RLS and trigger to mirror parameter_key
BEGIN;

CREATE TABLE IF NOT EXISTS public.results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  tank_id uuid NOT NULL REFERENCES public.tanks(id) ON DELETE CASCADE,
  parameter_id integer NOT NULL REFERENCES public.parameters(id),
  parameter_key text,
  value numeric NOT NULL,
  measured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.sync_results_parameter_key()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.parameter_id IS NOT NULL THEN
    SELECT key INTO NEW.parameter_key FROM public.parameters WHERE id = NEW.parameter_id;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_results_sync ON public.results;
CREATE TRIGGER trg_results_sync
BEFORE INSERT OR UPDATE ON public.results
FOR EACH ROW EXECUTE FUNCTION public.sync_results_parameter_key();

CREATE INDEX IF NOT EXISTS results_user_idx     ON public.results (user_id);
CREATE INDEX IF NOT EXISTS results_tank_idx     ON public.results (tank_id);
CREATE INDEX IF NOT EXISTS results_param_idx    ON public.results (parameter_id);
CREATE INDEX IF NOT EXISTS results_measured_idx ON public.results (measured_at);

ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS results_select_policy ON public.results;
CREATE POLICY results_select_policy ON public.results
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS results_modify_policy ON public.results;
CREATE POLICY results_modify_policy ON public.results
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMIT;
