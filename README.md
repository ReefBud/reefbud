
# ReefBud v2.0

**What’s new**
- Vercel-friendly build (next-env.d.ts, types pinned, Node engines)
- Supabase Auth (magic link)
- Profiles upsert on login
- Dashboard persists tank volume (DB) and saves current values as readings
- Results writes to `readings` and displays a calendar + recent list
- Products CRUD to `products`
- Chemist targets save to `targets`
- Calculator uses DB tank volume + DB product potency

## Setup
1. Copy `.env.example` -> `.env.local`, fill in Supabase keys.
2. In Supabase SQL Editor, run `supabase_schema.sql`.
3. `npm install` then `npm run dev`

## Deploy
Push to GitHub → Vercel builds. Set env vars in Vercel (all envs):
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
