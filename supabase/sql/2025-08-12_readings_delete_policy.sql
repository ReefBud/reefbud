do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='readings' and policyname='delete own readings'
  ) then
    create policy "delete own readings"
      on public.readings
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;

grant delete on table public.readings to authenticated;
