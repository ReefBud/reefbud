# Auth Fix + On-Calculator Chat — Drop-in

This adds:
- `/api/whoami` to verify your server sees the logged-in user
- `/auth` page with a simple magic-link sign-in
- Calculator page already rendering the ChatGPT calculator
- Assistant panel shows a banner if not signed in

**Files (keep paths exactly):**
```
app/api/whoami/route.ts
app/api/dose-assistant/route.ts
app/auth/page.tsx
app/calculator/AssistantPanel.tsx
app/calculator/page.tsx
```

**Install deps:**
```bash
npm i openai @supabase/auth-helpers-nextjs
```

**.env.local:**
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

**Check auth:**
- Visit `/auth`, send yourself a magic link, open it, then go to `/api/whoami`.
- If it shows your user, the Calculator chat will use your saved data automatically.

Generated 2025-08-15T10:31:34.244667Z
