ReefBud – V3 Patch (Results delete fix + small hardening)

What this patch does
--------------------
1) Fixes the "Remove" action in Results without using a chasing tooltip:
   • You now click a point to select it. A stable action bar appears under the chart with a Remove button.
   • This avoids the cursor-chasing tooltip issue entirely.

2) Adds a Manage Results page at /results/manage so you can quickly remove bad entries.

3) Adds safe Supabase SQL policies (idempotent) so deletes work for the row owner only (RLS).
   • Run the 3 SQL files in supabase/sql/v3/ in order.

4) Small quality fixes:
   • Deterministic ordering when loading results.
   • Consistent Supabase client helper: lib/supabaseClient.ts
   • Y-axis unit rendering on the chart.
   • Client-side filtering by parameter if your 'results' rows include parameter_key/parameter. If not, it still works.

How to apply
------------
1) Extract this ZIP at your repository root and allow overwrites when asked.

2) In Supabase → SQL editor, run these three files (copy/paste each file content and RUN):
   a) supabase/sql/v3/001_results_delete_policy.sql
   b) supabase/sql/v3/002_preferred_products_key.sql   (optional but recommended)
   c) supabase/sql/v3/003_targets_salinity_and_policies.sql (for Dashboard salinity + RLS sanity)

3) Start your app and test:
   • /results → click a point → press Remove in the bar below the chart.
   • /results/manage → Remove buttons on each row.

Typical gotchas (and how this patch avoids them)
-----------------------------------------------
• Tooltip "bubble runs away" → The delete is no longer inside the Tooltip; it's in a fixed action bar.
• "Clicked but nothing deleted" → The SQL now grants DELETE on 'results' and adds owner-only RLS policy.
• "Column not found" during load → The page selects a superset of fields and falls back to a minimal shape.
• Import paths → Components use relative imports, no custom alias required.

One-line git commit/push you asked for
--------------------------------------
git add -A && git commit -m "v3: fix(results) click-to-select delete + manage page; RLS policies & small hardening" && git push

Files included (relative to repo root)
--------------------------------------
lib/supabaseClient.ts
app/components/DeleteReadingButton.tsx
components/ResultsChart.tsx
app/results/page.tsx
app/results/manage/page.tsx
supabase/sql/v3/001_results_delete_policy.sql
supabase/sql/v3/002_preferred_products_key.sql
supabase/sql/v3/003_targets_salinity_and_policies.sql

If anything errors
------------------
• If Supabase complains about a missing column on preferred_products when running 002_*.sql, you can skip it for now; it's only to stabilize Chemist upserts.
• If your project already has a different Supabase client helper, keep yours or align imports.

Built: 2025-08-12T13:01:57.395995Z
