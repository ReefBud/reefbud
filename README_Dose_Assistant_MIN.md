# ChatGPT Calculator — Direct Replacement for /calculator

**What this zip does:** Clicking your Calculator tab opens the ChatGPT dosing assistant immediately.

Files (keep paths exactly):
```
app/api/dose-assistant/route.ts
app/calculator/AssistantPanel.tsx
app/calculator/page.tsx
```

Install deps:
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

Restart dev: `npm run dev`, then open `/calculator`.

Generated 2025-08-15T10:24:53.989942Z
