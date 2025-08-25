-- V3: Add salinity to targets + ensure RLS policies (idempotent).
CREATE TABLE IF NOT EXISTS public.targets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  alk numeric,
  ca numeric,
  mg numeric,
  po4 numeric,
  no3 numeric,
  salinity numeric,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.targets ENABLE ROW LEVEL SECURITY;

-- Add column if migrating an older table
ALTER TABLE IF EXISTS public.targets
  ADD COLUMN IF NOT EXISTS salinity numeric;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='targets' AND policyname='select own targets'
  ) THEN
    CREATE POLICY "select own targets" ON public.targets
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='targets' AND policyname='insert own targets'
  ) THEN
    CREATE POLICY "insert own targets" ON public.targets
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='targets' AND policyname='update own targets'
  ) THEN
    CREATE POLICY "update own targets" ON public.targets
      FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
