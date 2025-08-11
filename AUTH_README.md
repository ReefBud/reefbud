# Phone + 4-digit PIN Auth (Add-on)

This project was augmented to support sign-in/up with **Phone number + 4-digit PIN** (no SMS).

## New files
- `app/login/page.tsx`
- `app/register/page.tsx`
- `components/HeaderAuth.tsx`
- `lib/phoneAuth.ts`
- `sql/001_add_phone_to_profiles.sql`

## One-time Supabase settings
- Auth → Configuration → Minimum password length: **4**
- Optional: disable email confirmations (we use alias emails like `27831234567@phone.local`)

## How it works
- We normalize the phone to digits only and convert `0XXXXXXXXX` to `27XXXXXXXXX` (change if needed).
- We build an alias email `${phone}@phone.local` and use Supabase **password** auth.
- RLS continues to work via normal Supabase sessions.
- Register and Login pages redirect to `/dashboard` on success.

## Non-destructive
This was added without removing existing files. If you prefer different routes, move these pages/components and update links accordingly.
