# ReefBud v2.2.5 — Dashboard fix + Tank Volume + Targets

Includes:
- `app/dashboard/page.tsx`: Corrected JSX (fixes "Unexpected token main"), Tank name/volume/unit controls, Target Parameters (incl. Salinity), upserts 6 target rows per tank.
- `lib/supabase/client.ts`: Plain Supabase client, no `@supabase/auth-helpers-nextjs` needed.
- `supabase/sql/2025-08-11-dashboard-helpers.sql`: Seeds `parameters`, ensures `tanks` + `targets` columns and a unique index for `(tank_id, parameter_id)`, then reloads schema cache.

Deploy:
1) Supabase → SQL → New query → paste the SQL file → RUN.
2) Copy files into your repo and push:

```bash
git add -A && git commit -m "v2.2.5: Dashboard JSX fix + tank volume controls + per-tank target upserts" && git push
```

Vercel will rebuild.
