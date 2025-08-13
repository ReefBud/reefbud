# ReefBud Patch — 2025-08-13 (b)

- Fix: Calculator now reads latest values from the **Results** table (not `readings`)
- Add: You can enter **your current daily dose (ml/day)** per parameter; we show the adjustment vs recommended
- Remove: Salt-mix water-change preview (UI removed)
- Remove: Chemist tab (route now 404s)

After dropping these files in place, open `/calculator` and test.
If you still see a "Chemist" link in your header, remove that link from your nav component. The route is gone.
