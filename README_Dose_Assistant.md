# ReefBud Dose Assistant (Chat) — SSR cookie + TS fix

Files:
- app/api/dose-assistant/route.ts
- app/calculator/AssistantPanel.tsx
- app/assistant/page.tsx
- sql/2025-08-14_regimes_current_doses.sql

Install:
  npm i @supabase/ssr openai

Env (.env.local):
  OPENAI_API_KEY=sk-...
  OPENAI_MODEL=gpt-4o-mini
  NEXT_PUBLIC_SUPABASE_URL=...
  NEXT_PUBLIC_SUPABASE_ANON_KEY=...

Go to /assistant to test.
