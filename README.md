
# ReefBud v9 — Fixes for your latest errors

You hit:
- targets UNIQUE already exists
- readings.value does not exist (seed failed)

Run these in Supabase → SQL:

1) (If you haven't yet) Run the earlier hardeners:
   - 2025-08-13_readings_hardening_v2.sql (from ReefBud_v8)

2) Add and backfill `readings.value` so seeding works:
   - `supabase/sql/2025-08-13_readings_add_value_and_backfill.sql`

3) If needed, guard UNIQUE on targets (no-op if it exists):
   - `supabase/sql/2025-08-13_targets_unique_guard.sql`

4) (Optional) Ensure RLS on targets is correct:
   - `supabase/sql/2025-08-13_targets_rls_policies.sql`

5) Re-run the readings seed you used before (e.g., `2025-08-13_seed_readings_v2.sql`)
   - Now it will find `parameter_id`, `measured_at`, and `value`

### Dashboard saving: use UPSERT
If your Dashboard is still trying to INSERT, switch to UPSERT. See:
- `app/dashboard/dashboard_upsert_example.ts`

This uses `upsert(..., { onConflict: 'user_id' })` so it updates the existing row instead of causing a duplicate key error.

---
Git:
```
git add -A
git commit -m "chore(db): add readings.value with safe backfill; guard UNIQUE(targets.user_id); example upsert for Dashboard targets"
git push
```
