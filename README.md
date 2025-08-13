
# How to clear the messages in Calculator

You're seeing:
- "No recent reading."
- "Tank volume unknown."
- "No product selected in Chemist."

This bundle helps in two ways:
1) The calculator now tolerates older tank schemas by coalescing volume across `volume_liters`, `volume`, `liters`, `tank_volume`, `size_liters`.
2) Two SQL helpers to quickly set a tank volume and seed readings.

## Files

- `app/calculator/page.tsx` — drop-in replacement that uses the COALESCE-style fallback on tank volume.
- `lib/dose.ts` — calculation helper.
- `supabase/sql/2025-08-13_set_tank_volume_easy.sql` — set tank volume (edit liters at top).
- `supabase/sql/2025-08-13_seed_latest_readings_template.sql` — seed a reading per parameter (edit values at top).

## Steps

1) **Set your tank liters**
   - In Supabase → SQL → run: `supabase/sql/2025-08-13_set_tank_volume_easy.sql`
   - Change `desired_liters` to your actual tank size first.

2) **Seed one reading per parameter** (or log through your UI)
   - Run: `supabase/sql/2025-08-13_seed_latest_readings_template.sql`
   - Edit the v_alk / v_ca / v_mg / v_po4 / v_no3 values first.

3) **Ensure Chemist selection exists**
   - In your app, go to **Chemist** and select a product for Alk, Ca, Mg, PO4, NO3.
   - Make sure the product has potency (dose ml / delta units / ref liters).

4) **Replace Calculator page**
   - Copy `app/calculator/page.tsx` into your project, overwriting the existing page.
   - Restart your dev server and open `/calculator`.

When those three pieces exist (volume, target, product+potency, recent reading), you'll get a dose instead of warnings.
