# ReefBud Dose Assistant — Drop-in (WORKING)

Copy these files (keep exact paths):
```
app/api/dose-assistant/route.ts
app/calculator/AssistantPanel.tsx
app/assistant/page.tsx
```

Install deps:
```bash
npm i openai @supabase/auth-helpers-nextjs
```

Add `.env.local`:
```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Restart `npm run dev`, then visit `/assistant`.
If your calculator is under a route group like `app/(main)/calculator/page.tsx`, move the assistant page into the same group:
```
app/assistant/page.tsx  ->  app/(main)/assistant/page.tsx
```
Generated 2025-08-14T15:22:36.217051Z
