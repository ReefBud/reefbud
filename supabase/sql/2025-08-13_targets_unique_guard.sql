
-- Only add UNIQUE(user_id) if it does not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.targets'::regclass
      AND conname = 'targets_user_id_key'
  ) THEN
    ALTER TABLE public.targets ADD CONSTRAINT targets_user_id_key UNIQUE (user_id);
  END IF;
END$$;
