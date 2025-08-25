# ReefBud Dose Assistant (Chat) — Final Drop-in

Files to copy (keep these exact paths):
```
app/api/dose-assistant/route.ts
app/calculator/AssistantPanel.tsx
app/assistant/page.tsx
sql/2025-08-14_regimes_current_doses.sql   (optional)
```

Install:
```bash
npm i openai @supabase/auth-helpers-nextjs
```

.env.local:
```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Then visit `/assistant` to confirm it renders.
Generated 2025-08-14T14:31:20.680716Z
