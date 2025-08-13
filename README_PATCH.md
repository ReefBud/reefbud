# ReefBud Calculator Fix — 2025-08-13e

**What’s fixed**

- Per-parameter **Refresh** button now truly refetches Results and recomputes without changing the dropdown.
- **Your current daily dose** recalculates immediately on input (no more dropdown toggle needed).
- Shows **Extra ml/day needed** only, plus **Correction now**, with warnings for safe daily spikes:
  - Alk ≈ 1.0 dKH/day
  - Ca ≈ 20 ppm/day
  - Mg ≈ 50 ppm/day
- **Working** steps are shown so users can validate the math.
- Chemist is hard-removed (route returns 404).

**How it computes**

1) Potency (units/ml/L) = delta_ref_value / (dose_ref_ml × volume_ref_liters)  
2) Per-ml in your tank = potency × tank_L  
3) Observed slope (Results) = units/day  
4) Dose effect from your current dose = currentDailyMl × per-ml-in-tank  
5) Estimated consumption = max(0, doseEffect − slope)  
6) Required ml/day = consumption / per-ml-in-tank  
7) Extra ml/day needed = max(0, required − currentDailyMl)  
8) Correction now (if below target) = delta / per-ml-in-tank, with safe-spike warnings

**Install**

Drop files into your repo at the same paths, then:

```
git add -A && git commit -m "calc: real refresh, immediate recompute on dose input, extra ml/day only, working steps, safe spikes; remove chemist 404" && git push
```

Open `/calculator` and test each card.
