ReefBud Calculator Patch

What is included
- lib/doseMath.ts
- app/calculator/page.tsx
- public/dosing-calculator.html

The logic matches the requirement: required_dose_ml = current_dose_ml + ((target - current) / increase_per_ml).
Potency inputs are per-ml-per-liter and are scaled by tank liters.
A tolerance band prevents small oscillations. Output is rounded to your chosen ml step.

How to apply
1) Copy each file to the same path in your project, replacing existing files.
2) Ensure your Next.js dev server restarts, then test the Calculator page.
3) The HTML fallback can be opened directly from /public for a simple check.

Example sanity check
- Tank 35 L, Alk potency 0.073 dKH/ml/L -> 2.555 dKH per ml for full tank.
- Current dose 30 ml, reading 6.7 dKH, target 8.0 dKH.
- Extra = (8.0 - 6.7) / 2.555 ≈ 0.51 ml -> new dose ≈ 30.51 ml.

Git push commands
git add app/calculator/page.tsx lib/doseMath.ts public/dosing-calculator.html
git commit -m "Fix dosing calculator: correct Mg and Ca computations, tank-scaled potency, symmetric adjust with tolerance"
git push origin main
