-- 01_dedupe_targets_and_unique.sql — keep newest row per user, then add UNIQUE(user_id)
BEGIN;
WITH ranked AS (
  SELECT ctid, user_id, updated_at,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC NULLS LAST, ctid DESC) rn
  FROM public.targets
)
DELETE FROM public.targets t
USING ranked r
WHERE t.ctid = r.ctid AND r.rn > 1;

DO $$ BEGIN
  BEGIN
    ALTER TABLE public.targets ADD CONSTRAINT targets_user_id_key UNIQUE (user_id);
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END$$;
COMMIT;
