# Products Tab Patch (v2.3.2)

Changes
- Removed "Your products" vs "Global" sections — single combined list.
- Matched inputs/buttons styling to Dashboard (uses `.card`, `.input`, `.btn`, `.label`).
- New "Add custom product" form fields:
  - Brand (e.g., Tropic Marin)
  - Parameter (e.g., Alkalinity)
  - Name of Product (e.g., Balling B)
  - Grams per liter (g/L)
  - Dose reference (ml), Raises by (units), In tank volume (L)
- Live “Potency preview”, e.g. `10 ml → +15 ppm in 200 L`

How to apply
1. Run the SQL migration in Supabase → SQL → SQL Editor:
   - `sql/2025-08-12-products-grams-ui.sql`
2. Replace these files in your repo:
   - `app/products/page.tsx`
   - `components/ProductForm.tsx`
3. Commit & push:
```
git add app/products/page.tsx components/ProductForm.tsx sql/2025-08-12-products-grams-ui.sql
git commit -m "v2.3.2: products UI simplification; dashboard-styled form; grams_per_liter + potency preview"
git push
```
