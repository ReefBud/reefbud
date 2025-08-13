
-- Idempotent RLS policies for targets
ALTER TABLE public.targets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='targets' AND policyname='targets_select_own'
  ) THEN
    CREATE POLICY targets_select_own ON public.targets
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='targets' AND policyname='targets_modify_own'
  ) THEN
    CREATE POLICY targets_modify_own ON public.targets
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;
