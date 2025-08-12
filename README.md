Delete Readings – Complete Patch (v8)
====================================

What you get
- /results/manage page with clear Remove buttons (works independently of your chart).
- Delete button in Recharts tooltip so the action appears right next to the line chart.
- Idempotent RLS delete policy SQL.
- A tiny Supabase client helper.
- Example chart + server rendering example.

Install
1) Copy files into the same paths in your repo.
2) Run Supabase SQL once: supabase/sql/2025-08-12_readings_delete_policy.sql.
3) Visit /results/manage while signed in and delete a test row to confirm backend + RLS are correct.
4) Wire the tooltip near your chart by replacing your <Tooltip /> with:
   <Tooltip content={
     <InjectDeleteIntoRechartsTooltip onLocalDelete={(id) =>
       setReadings(prev => prev.filter(r => r.id !== id))
     } />
   }/>
   Ensure the dataset you pass to the chart includes an id field for each point.

Path alias
- Files use @/… If you don’t have this alias, either:
  - Add to tsconfig.json:
    {
      "compilerOptions": {
        "baseUrl": ".",
        "paths": { "@/*": ["./*"] }
      }
    }
  - Or change imports to relative paths (e.g. ../../utils/supabase/client).

Git commands
- Current branch:
  git add -A
  git commit -m "feat(results): manage page + tooltip delete; RLS policy for safe deletes"
  git push

- New branch:
  git switch -c feat/results-delete-complete
  git add -A
  git commit -m "feat(results): manage page + tooltip delete; RLS policy for safe deletes"
  git push -u origin feat/results-delete-complete

Troubleshooting
- 401/403 when deleting? Confirm: signed-in session, readings.user_id = auth.uid(), RLS enabled, policy & grant applied.
- Button not visible near chart? Ensure the chart renders on the client (wrap with a client component or use dynamic import with ssr: false) and that you replaced the Tooltip with the one provided.
- Still stuck? Send me your app/results/... chart component and I’ll ship a targeted patch.
