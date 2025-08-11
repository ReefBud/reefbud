# Phone + 6-digit PIN Auth

Steps in Supabase:
1. Auth -> Providers -> Email: enable Email provider. Turn on "Auto confirm new users" or disable confirmations.
2. Auth -> Configuration -> Password length minimum: 4.
3. Auth -> Settings -> Disable "New users are not allowed to sign up" if it is ON.
4. No SMTP needed since we do not send emails.

Why it failed before:
- Some projects reject unusual TLDs. We now use `${phone}@example.com` as the alias which is always valid.

Test flow:
- Go to /register, create an account with phone + 6-digit PIN.
- It should redirect to /dashboard, then sign out and sign back in at /login.
