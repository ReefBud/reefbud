# ReefBud Products Patch — 2025-08-13

This patch does the following:
- Removes all **Tropic Marin** seeded items from the Products tab (DB-level delete).
- Switches to **manual product entry only**.
- Adds **Remove** buttons in **All visible products**.
- Adds **Trace Elements A-** and **Trace Elements K+** to the parameters list.
- Tightens RLS so **each user only sees/modifies their own products**.

## Files included

- `supabase/sql/2025-08-13_remove_tm_add_trace_and_rls.sql`
- `app/products/page.tsx`
- `app/components/DeleteProductButton.tsx`
- `app/components/ParameterOptions.ts`

> Note: The UI assumes `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set.

## How to apply

1. **Copy files** into your repo at the same paths.
2. In Supabase → **SQL Editor**, paste & run the contents of:
   - `supabase/sql/2025-08-13_remove_tm_add_trace_and_rls.sql`
3. Restart your app.

### Git add/commit/push

```bash
git add -A
git commit -m "feat(products): manual-only products, delete button, add Trace A-/K+, tighten RLS; remove Tropic Marin"
git push
```

## Notes

- The Products page now only shows rows where `products.user_id = auth.uid()`.
- The SQL script deletes existing Tropic Marin rows and removes any `preferred_products` rows that reference them (to avoid FK errors).
- If your parameters dropdowns read from the `parameters` table, **Trace A-/K+** will appear automatically after running the SQL.
- If your UI uses a hard-coded list, import `PARAMETER_OPTIONS` from `app/components/ParameterOptions`.
- The delete button requires the `authenticated` role to have `DELETE` privilege; the SQL sets this grant and RLS ensures users can delete **only their rows**.