# ReefBud_v10 quick instructions
Run these in Supabase → SQL, in order:
  1) supabase/sql/00_fix_schema.sql
  2) supabase/sql/01_dedupe_targets_and_unique.sql
  3) supabase/sql/02_seed_targets_latest_user.sql
  4) supabase/sql/03_set_tank_volume_latest_user.sql
  5) supabase/sql/04_seed_parameters_if_missing.sql
  6) supabase/sql/05_seed_readings_latest_user.sql
  7) supabase/sql/06_set_preferred_from_existing.sql
  8) (optional) supabase/sql/07_seed_demo_products.sql
Then replace:
  - app/dashboard/saveTargetsUpsert.ts
  - app/calculator/page.tsx
