# OroBit Reef Alkalinity Dosing Calculator — Spec Build (2025-08-14)

Implements your exact spec and variable names.

Reads:
- `tank_L` and targets from Dashboard
- `dose_ref_ml`, `volume_ref_L`, `delta_ref_dkh` from Products (selected via preferred_products)
- Trend from Results over 3/7/14 days (default 7)

Outputs:
- One-time correction (ml)
- Daily maintenance (ml/day) from consumption
- Dose today (ml) = correction + maintenance
- Show working with the same variable names as your spec

Install:
1) Unzip into your repo at the same paths.
2) Commit & deploy:
   git add -A && git commit -m "calc: implement OroBit spec dosing calculator" && git push
3) Open `/calculator` and select your product, optionally adjust strength factor.
