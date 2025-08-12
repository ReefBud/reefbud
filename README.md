Delete readings feature patch (v2)
=================================

What changed in v2
- Added missing helper: utils/supabase/client.ts so the import "@/utils/supabase/client" resolves.
- No other changes.

Apply the SQL
1. Open Supabase SQL editor.
2. Run: supabase/sql/2025-08-12_readings_delete_policy.sql

Add files
- Copy `app/components/DeleteReadingButton.tsx` into your project.
- Ensure `utils/supabase/client.ts` exists (included here). If your project does **not** use the "@/..." alias, change the import in DeleteReadingButton to a relative path:
  `import { createClient } from '../../utils/supabase/client'`

Git commit and push
If on a feature branch:
    git add -A
    git commit -m "feat(results): delete readings + supabase client helper"
    git push

Create a new branch:
    git switch -c feat/delete-readings
    git add -A
    git commit -m "feat(results): delete readings + supabase client helper"
    git push -u origin feat/delete-readings

Deploy
Vercel will build on push if connected.
