-- V3: Allow safe deletes on public.results (RLS limits to row owner).
-- Run once in Supabase SQL Editor.

-- Enable RLS if table exists (no error if not found).
ALTER TABLE IF EXISTS public.results ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='results' AND policyname='results_owner_delete'
  ) THEN
    CREATE POLICY results_owner_delete
      ON public.results
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Ensure the REST 'authenticated' role can issue deletes (RLS still enforces ownership)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.results TO authenticated;
