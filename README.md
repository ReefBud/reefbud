# ReefBud

## Version History

### v2.2.0
- Switched to Google sign-in only. Removed phone + PIN UI.
- Added `components/OAuthButtons.tsx` and `app/auth/callback/page.tsx`.
- Header now links to Google sign-in.
- Existing data is preserved per Supabase `user.id`. See migration notes below if changing auth method for existing users.

### Migration notes (keeping user parameters)
If users previously signed in with phone+PIN, their Supabase `auth.uid()` is different from their Google account `auth.uid()`. To keep their parameters, you can either:
1) Ask the user to sign in once with the old method, then link Google to the same user in-app, or
2) Run a one-time migration to move rows from the old user id to the new Google user id.

Create a SQL function to migrate data between users:
```sql
create or replace function public.migrate_user_data(old_uid uuid, new_uid uuid)
returns void language plpgsql security definer as $$
begin
  update public.profiles set id = new_uid where id = old_uid;
  update public.targets set user_id = new_uid where user_id = old_uid;
  update public.products set user_id = new_uid where user_id = old_uid;
  update public.readings set user_id = new_uid where user_id = old_uid;
end;
$$;
```

Then call it manually with the two ids after the user signs in with Google:
```sql
select public.migrate_user_data('OLD_AUTH_UID', 'NEW_GOOGLE_UID');
```

Make sure your RLS policies allow the service role to perform this migration, or run it from the SQL editor with service role privileges.

