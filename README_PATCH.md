# ReefBud Patch — 2025-08-13c

- Calculator now:
  - Reads **latest reading and trend from `results`** (last 14 days)
  - Lets you enter **Your current daily dose (ml/day)** for Alk, Ca, Mg
  - Shows **Adjustment** = Recommended − Current daily
  - Salt‑mix preview **removed**
- Chemist route returns **404** (fully removed)
- Product pickers live inside Calculator and persist to `preferred_products`

## Drop-in paths
- app/calculator/page.tsx
- app/components/ProductSelectInline.tsx
- app/chemist/page.tsx
- lib/doseMath.ts
- lib/types.ts

## Commit
git add -A && git commit -m "calc: latest from Results, add current daily dose + adjustment; remove salt-mix; remove Chemist route" && git push
