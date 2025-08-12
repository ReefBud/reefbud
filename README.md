Delete readings feature patch
=============================

What this adds
- Supabase policy that lets a signed-in user delete only their own readings
- Grant for authenticated role so PostgREST accepts DELETE
- A small React button component to trigger the delete
- Example list integration that also removes the item from state and calendar

Apply the SQL
1. Open Supabase SQL editor.
2. Paste and run: supabase/sql/2025-08-12_readings_delete_policy.sql
   You can safely run it more than once.

Wire up the UI
1. Copy app/components/DeleteReadingButton.tsx into your project.
2. Import and render <DeleteReadingButton id={reading.id} onDeleted={...} /> wherever you list readings.
3. In onDeleted, remove the item from your list state and calendar events.

Git commit and push
If you are already on a feature branch:
    git add -A
    git commit -m "feat(results): allow deleting readings safely with RLS and UI button"
    git push

If you want to create a new branch first:
    git switch -c feat/delete-readings
    git add -A
    git commit -m "feat(results): allow deleting readings safely with RLS and UI button"
    git push -u origin feat/delete-readings

If you are unsure which branch you are on:
    git rev-parse --abbrev-ref HEAD

Deploy
Vercel will deploy on push if your project is already connected.
