Results Delete-in-Tooltip Patch (v6)
====================================

What this adds
- Visible Delete button inside the Recharts tooltip.
- Reusable DeleteReadingButton component.
- Supabase SQL policy to allow row-owner deletes.
- Client/Server examples for wiring.

Files
- supabase/sql/2025-08-12_readings_delete_policy.sql
- utils/supabase/client.ts
- app/components/DeleteReadingButton.tsx
- app/results/InjectDeleteIntoRechartsTooltip.tsx
- app/results/ResultsChart.example.tsx
- app/results/page.server.example.tsx

Quick wire-up
1) Ensure each reading in your chart data includes an id matching the DB row.
2) Replace your Recharts <Tooltip /> with:
   <Tooltip content={
     <InjectDeleteIntoRechartsTooltip onLocalDelete={(id) =>
       setReadings(prev => prev.filter(r => r.id !== id))
     } />
   }/>
3) If your Results page is a Server Component, render the chart via a client component or dynamic import (ssr: false). See page.server.example.tsx.
4) Run the SQL once in Supabase.

Git
- Current branch:
  git add -A
  git commit -m "feat(results): Delete button in chart tooltip + RLS delete policy"
  git push

- New branch:
  git switch -c feat/results-delete-tooltip
  git add -A
  git commit -m "feat(results): Delete button in chart tooltip + RLS delete policy"
  git push -u origin feat/results-delete-tooltip
