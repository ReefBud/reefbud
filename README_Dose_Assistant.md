# ReefBud Dose Assistant (Chat) — Drop-in Addon (Fixed)

Files to copy:
- app/api/dose-assistant/route.ts
- app/calculator/AssistantPanel.tsx
- app/assistant/page.tsx
- sql/2025-08-14_regimes_current_doses.sql

Install deps:
  npm i openai @supabase/auth-helpers-nextjs

Env (.env.local):
  OPENAI_API_KEY=sk-...
  OPENAI_MODEL=gpt-4o-mini
  NEXT_PUBLIC_SUPABASE_URL=...
  NEXT_PUBLIC_SUPABASE_ANON_KEY=...

Then run dev and visit /assistant.
