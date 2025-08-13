# ReefBud Calculator Patch — 2025-08-13 (d)

What changed
- Added **Refresh** button per parameter (reloads latest Results + trend)
- When you change **Your current daily dose (ml/day)** it recalculates immediately
- Removed "Recommended daily dose" and "Adjustment" UI — now it shows **Extra ml/day needed** only
- Shows **working** (potency, dose effect, consumption estimate, required ml/day, extra ml/day)
- Uses improved consumption model: `consumption = doseEffectPerDay - observedSlope`, clamped to ≥ 0
- Keeps **Correction now** (with safe spike guardrails): Alk ≈ 1.0 dKH/day, Ca ≈ 20 ppm/day, Mg ≈ 50 ppm/day
- Chemist route is hard removed (404)

Drop-in files
- `app/calculator/page.tsx`
- `app/chemist/page.tsx`
- `app/components/ProductSelectInline.tsx`
- `lib/doseMath.ts`
- `lib/types.ts`

One-liner
```
git add -A && git commit -m "calculator: refresh per param, extra ml/day, working, safe spikes; remove chemist route" && git push
```
