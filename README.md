# ReefBud v2.3.0 - Chemist selections and Products create

Contents:
- app/chemist/page.tsx - Chemist shows only product selectors and saves to preferred_products
- components/ProductPicker.tsx - lists global Tropic Marin and user products for a parameter
- components/ProductCreateForm.tsx - add custom dosing products
- app/products/page.tsx - list and create products
- sql/2025-08-12-preferred-products.sql - DB fixer for preferred_products and RLS

Apply:
1) Copy these files into your repo in the same paths.
2) Run the SQL file in Supabase SQL Editor.
3) Commit and push:
   git add -A && git commit -m "v2.3.0: Chemist preferred product saving + custom products page" && git push origin main
