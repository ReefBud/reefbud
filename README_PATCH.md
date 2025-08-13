# ReefBud Calculator Update — 2025-08-14a

What changed

- Shows **Maintain dose: X ml/day** as the final daily dosing required to hold steady.
- Shows **Add extra** or **Reduce by** relative to your current daily dose.
- Keeps **Correction now** for a one-time bump to reach target, with safe-spike guidance.
- Per-parameter **Refresh** re-fetches Results and recomputes.
- Dose input recalculates immediately.
- Working steps are shown for peace of mind.

Safe correction guidance

- Alk: about 1.0 dKH per day
- Ca: about 20 ppm per day
- Mg: about 50 ppm per day

If the correction exceeds these, the UI suggests the number of days to split it evenly.

Install

Drop the files into your repo, then:

```
git add -A && git commit -m "calc: show maintain dose + extra or reduce, correction with safe split, real refresh and instant recompute" && git push
```

Open `/calculator` and test each parameter card.
