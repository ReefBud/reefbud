-- Allow safe deletes on 'results' (RLS still restricts to row owner)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='results' and policyname='results_owner_delete'
  ) then
    create policy results_owner_delete
      on public.results
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;

-- Ensure the REST roles can perform the operation; RLS still enforces ownership
grant select, insert, update, delete on table public.results to authenticated;
