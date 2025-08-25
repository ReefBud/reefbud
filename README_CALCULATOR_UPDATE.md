
# Calculator — Targets from Dashboard, UI arrow, and simplified logic

This update ensures:
- **Targets** are read **only** from the Dashboard `public.targets` table (user-level).
- UI shows **Current → Target** in one column with an arrow.
- **Advanced correction** controls are removed (no alk factor, reference volume, rounding, or "Effective liters (auto)").
- Parameter set limited to: **Alkalinity, Calcium, Magnesium, Phosphate, Nitrate**.
- Potency still comes from your **Chemist** selection via `preferred_products` → `products`.

## Files
- `app/calculator/page.tsx`
- `lib/dose.ts`

## Apply
1. Copy files to your repo.
2. Ensure `public.targets` has columns `alk, ca, mg, po4, no3` and a row for the current `auth.uid()`.
3. Ensure `tanks`, `preferred_products`, and `products` are populated for your test tank.
4. Restart and open `/calculator`.

## Git
```bash
git add -A
git commit -m "feat(calculator): use Dashboard targets, Current→Target arrow UI, remove advanced correction/rounding/effective liters; restrict params to alk/ca/mg/po4/no3"
git push
```
