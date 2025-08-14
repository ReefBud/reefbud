# ReefBud Dose Assistant (Chat) — Drop-in Addon

This package adds a small chat panel that asks ChatGPT to propose dosing plans using **your user's data**:
- Tank volume
- Target parameters (Dashboard)
- Recent results (last 7 days)
- Preferred products with potency triplets
- Optional: current daily dose per element (ml/day)

It preserves your existing Calculator — you can run both during the transition.

---

## 1) Drag & drop

Copy these files into your project **keeping the same paths**:

```
app/api/dose-assistant/route.ts
app/calculator/AssistantPanel.tsx
app/assistant/page.tsx
sql/2025-08-14_regimes_current_doses.sql   (optional)
README_Dose_Assistant.md
```

---

## 2) Install dependency

```bash
npm i openai @supabase/auth-helpers-nextjs
```

---

## 3) Env vars

Create or edit `.env.local`:

```
OPENAI_API_KEY=sk-your-key-here
# Optional: choose a model (defaults to gpt-4o-mini)
OPENAI_MODEL=gpt-4o-mini
NEXT_PUBLIC_SUPABASE_URL=...your...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...your...
```

Restart dev server after editing env.

---

## 4) SQL — run in Supabase → SQL Editor

### a) Ensure preferred_products has the unique key + RLS (if not already)

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='preferred_products_user_tank_param_key'
  ) THEN
    CREATE UNIQUE INDEX preferred_products_user_tank_param_key
      ON public.preferred_products (user_id, tank_id, parameter_id);
  END IF;
END$$;

ALTER TABLE public.preferred_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS preferred_products_select_policy ON public.preferred_products;
CREATE POLICY preferred_products_select_policy ON public.preferred_products
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS preferred_products_modify_policy ON public.preferred_products;
CREATE POLICY preferred_products_modify_policy ON public.preferred_products
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### b) Optional: store current daily doses (ml/day)

```sql
ALTER TABLE IF EXISTS public.regimes
  ADD COLUMN IF NOT EXISTS alk_daily_ml numeric,
  ADD COLUMN IF NOT EXISTS ca_daily_ml numeric,
  ADD COLUMN IF NOT EXISTS mg_daily_ml numeric;
```

---

## 5) Use it

- Visit **/assistant** in your app to try the chat.
- Or render `<AssistantPanel />` inside your existing Calculator page.

The panel will:
- Pull your private context server-side with Supabase RLS.
- Ask for any missing facts (tank volume, current doses) if needed.
- Call OpenAI to propose a safe plan and show its inputs and math.

---

## 6) Git one-liners

```bash
git switch -c feat/dose-assistant-chat
git add -A
git commit -m "feat(assistant): add ChatGPT dosing assistant with server-side context + API"
git push -u origin feat/dose-assistant-chat
```

Generated: 2025-08-14T13:05:43.058686Z
