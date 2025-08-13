# ReefBud Calculator — dashboard targets + products + results trend (2025-08-14b)

What this does
- Reads **tank size** and **targets** from your Dashboard tables (`tanks`, `targets`).
- Reads **which product you are using** from `preferred_products`, and its **potency** from `products`.
- Reads **previous parameters** from `results` to compute the trend (slope).
- Computes the **Maintain dose** as an absolute daily number:
  - `maintain = max(0, currentDailyMl − slope / (potency × tank_L))`
- Shows **Add extra** or **Reduce by** vs your current daily input.
- Computes **Correction now** to reach target using product potency and warns if it exceeds safe daily spikes.

Safe correction guidance
- Alk ≈ 1.0 dKH/day
- Ca ≈ 20 ppm/day
- Mg ≈ 50 ppm/day

Install
Drop the files in place, then:

```
git add -A && git commit -m "calc: dashboard targets + tank; preferred products + potency; results trend; maintain dose with math shown" && git push
```

Open `/calculator`, pick products (if not already saved), type your current daily dose for each parameter, and click Refresh after logging a new Result.
