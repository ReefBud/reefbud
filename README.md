# ReefBud Dashboard Fix (Vercel-ready)

This patch removes the `@supabase/auth-helpers-nextjs` dependency from Dashboard and uses a shared Supabase client. It also includes an idempotent SQL migration for `public.targets` with `user_id`, salinity, and RLS.

## Files in this ZIP (overlay into your repo)
- `app/dashboard/page.tsx` — Target Parameters UI (with Salinity + gradient inputs) and upsert logic.
- `lib/supabase/client.ts` — Plain Supabase client (no auth-helpers).
- `supabase/sql/2025-08-11-targets-rls.sql` — Safe migration for `public.targets` + RLS.

## Deploy steps (Vercel)
1. Ensure env vars exist in Vercel Project Settings → Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

2. In Supabase → SQL → New query → paste the contents of:
   `supabase/sql/2025-08-11-targets-rls.sql` → **RUN**.

3. In your repo, copy the files from this ZIP over your project (preserve paths). Commit and push:
   ```bash
   git add -A && git commit -m "v2.2.3: Dashboard fix (plain Supabase client), targets RLS, salinity field" && git push
   ```

4. Vercel will build and deploy.

## Notes
- RLS policies scope by `user_id` so each signed-in user only sees their own targets.
- If your existing `targets` table used `id uuid`, the migration renames it to `user_id` automatically.
