# ReefBud v2.2.6 — Fix FK error on targets (user_id)

Includes:
- `app/dashboard/page.tsx`: Upserts targets with `user_id` included and conflict target `user_id,tank_id,parameter_id`.
- `lib/supabase/client.ts`: Plain Supabase client.
- `supabase/sql/2025-08-11-targets-userid-fk.sql`: Ensures `targets.user_id` exists, adds FK to `auth.users(id)`, creates a composite unique index `(user_id, tank_id, parameter_id)`, and reloads API schema.

Deploy:
1) Supabase → SQL → New query → paste `supabase/sql/2025-08-11-targets-userid-fk.sql` → RUN.
2) Copy files over your repo. Commit and push:

```bash
git add -A && git commit -m "v2.2.6: include user_id in targets upsert; add FK + unique index" && git push
```

Then save in the Dashboard — the FK error will be gone.


## Chemist tab setup (v2.2.7)

This version adds the Chemist tab with:
- Target fields for Alk, Ca, Mg, PO4, NO3
- Product picker per parameter
- Helper text for Tropic Marin Balling A and B
- Preferred product saved per tank

### Database setup

Run this SQL in Supabase → SQL Editor:

- `supabase/sql/2025-08-12-products-and-seed.sql`

This will create the `products` table if missing, add RLS, and seed Tropic Marin Balling products into the global catalog.

### Notes

- Balling A and B potencies are seeded as:
  - 30 ml → +15 ppm Ca in 35 L
  - 30 ml → +2.2 dKH Alk in 35 L
- Balling C, K+, A- are added without potencies. Add values from your bottle when available.

