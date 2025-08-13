# ReefBud Patch — 2025-08-13

This patch:
- **Removes** the Chemist tab (redirects it to Products)
- **Limits Products** to Alkalinity, Calcium, Magnesium
- **Fixes Calculator** to compute daily dose + gentle correction using product potency and recent consumption
- Adds 20% water-change preview using a user-provided salt mix baseline per parameter

## Files in this patch

- `app/chemist/page.tsx` — stub that redirects to `/products` (functionally removes Chemist)
- `app/products/page.tsx` — parameter choices limited to Alk/Ca/Mg; product form unchanged otherwise
- `app/calculator/page.tsx` — new calculator implementation
- `app/components/ProductSelectInline.tsx` — inline product selector used inside Calculator
- `lib/doseMath.ts` — math helpers (potency, dose, slope, water change)
- `lib/types.ts` — shared types
- `sql/2025-08-13_preferred_products_unique_index.sql` — ensures the `preferred_products` upsert key exists

## What the Calculator does

- Loads your first tank (creates one at 200 L if missing) and its volume in liters
- Uses **targets** from `public.targets` (set these on the Dashboard)
- For Alk/Ca/Mg it:
  - Pulls recent readings (last 14 days) and computes a slope (units/day)
  - Interprets falling values as **consumption**
  - If you select a product, computes:
    - **Daily dose (ml/day)** = consumption / potencyPerMlPerL / tankLiters
    - **Correction (ml now)** if **below** target = delta / potencyPerMlPerL / tankLiters
  - Guardrails:
    - Above target → hold dosing / consider partial water change
    - Near target (Alk ≤ 0.2 dKH, Ca ≤ 10 ppm, Mg ≤ 20 ppm) → maintain, avoid big corrections
  - 20% water-change preview if you enter a salt mix baseline

**Note**: Since you removed the Chemist tab, product selection now happens **inside the Calculator** (one dropdown per parameter).
Your choice is persisted to `preferred_products` so it sticks on refresh.

## DB prerequisites (should already exist)

Tables your app expects:
- `parameters(id, key, unit, display_name)` — includes rows for `alk`, `ca`, `mg` (others may exist; they are ignored in UI)
- `tanks(id, user_id, name, volume_value, volume_unit, volume_liters, created_at)`
- `targets(user_id PK, alk, ca, mg, po4, no3, salinity, updated_at)`
- `products(id, user_id NULLABLE, brand, name, parameter_id, helper_text, dose_ref_ml, delta_ref_value, volume_ref_liters, created_at, updated_at)`
- `preferred_products(id, user_id, tank_id, parameter_id, product_id, created_at, updated_at)` (unique index on `(user_id, tank_id, parameter_id)`)
- `readings(id, user_id, tank_id, parameter_id, value, measured_at, ...)`

RLS policies:
- `products`: SELECT rows where `user_id IS NULL OR user_id = auth.uid()`; modify only own rows
- `preferred_products`: SELECT/INSERT/UPDATE/DELETE only where `user_id = auth.uid()`
- `targets` and `readings`: per-user policies keyed to `auth.uid()`

Run the included index script if needed:
```
-- In Supabase SQL editor
-- File: sql/2025-08-13_preferred_products_unique_index.sql
```

## Install

1) **Drag-and-drop** these files into the same paths in your repo.
   - This patch is additive — it only replaces the four files listed above and adds helpers.
   - Chemist is effectively removed by redirecting its route to `/products`.

2) Commit and push (you always want the one-liner):
```
git add -A && git commit -m "patch: remove Chemist, limit Products to Alk/Ca/Mg, new Calculator with potency+consumption math" && git push
```

3) In Supabase (only if missing), run the unique index script.

4) Open `/calculator`:
   - Choose a product for each parameter you care about.
   - Set targets on the Dashboard.
   - Enter optional salt mix baselines to preview a 20% water change.
   - Verify daily dose/correction numbers — they will be 0 if potency is missing.

## Notes

- If you have **multiple tanks**, this page currently uses the **first** tank. We can add a tank dropdown next.
- If your products **lack potency**, the calculator will show `—` for doses. Add `dose_ref_ml`, `delta_ref_value`, `volume_ref_liters`.
- We kept the Products delete button behavior and RLS safety unchanged.
