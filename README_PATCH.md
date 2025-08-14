# ReefBud Calculator — 2025-08-14d

This patch ensures the calculator:
- Reads tank size & targets from Dashboard
- Uses your selected product (preferred_products) + product potency (products)
- Uses a 3/7/14 day Results window to compute slope
- Calculates Maintain dose with: `maintain = currentDailyMl − slope / (potency × tank_L)`
- Shows Add extra/Reduce by and a safe Correction now
- Recomputes immediately on dose input and on per-parameter Refresh

Install:
1) Drop these files into your repo in the same paths.
2) Commit:
   git add -A && git commit -m "calc: maintain formula + trend window; recompute on input; safe correction" && git push
3) Open /calculator and test.
