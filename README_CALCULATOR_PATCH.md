# Calculator fix — read potencies from selected Chemist product

This patch makes the Calculator read *your selected product per parameter* (from `preferred_products`) and use the potency stored on that product (`dose_ref_ml`, `delta_ref_value`, `volume_ref_liters`) together with your tank volume and targets.

## Files
- `app/calculator/page.tsx` — UI that joins Tanks → Targets → Preferred Products → Products and computes dose.
- `lib/dose.ts` — math helper (double-checked).
- `supabase/sql/2025-08-13_verify_calculator_sources.sql` — optional helper view for debugging data.

## Formula (double-checked)

- Potency is stored as: **dose_ref_ml ml** raises **delta_ref_value** units in **volume_ref_liters** liters.
- Units per ml per liter: `delta_ref_value / (dose_ref_ml * volume_ref_liters)`
- Units per ml in your tank: `units_per_ml_per_L * V_tank`
- **Dose needed (ml)**: `delta_target / units_per_ml_in_tank`

## How to apply
1. Copy the files to your repo at the same paths.
2. (Optional) Run the view in Supabase → SQL:
   - `supabase/sql/2025-08-13_verify_calculator_sources.sql`
3. Ensure you have these tables set up and filled:
   - `tanks (user_id, volume_liters)`
   - `parameters (id, key)`
   - `targets` (user-level) or `tank_targets` (per tank) for desired values
   - `preferred_products (user_id, tank_id, parameter_id, product_id)`
   - `products (id, user_id, parameter_id, dose_ref_ml, delta_ref_value, volume_ref_liters)`
4. Restart your app and open `/calculator`.

## Git
```bash
git add -A
git commit -m "fix(calculator): read Chemist selection + product potency; compute dose using tank volume and targets"
git push
```