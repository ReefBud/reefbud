-- Ensure targets has user_id and matching constraints for upsert
alter table public.targets
  add column if not exists user_id uuid;

-- Add FK if missing
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='targets_user_id_fkey' and connamespace = 'public'::regnamespace
  ) then
    execute 'alter table public.targets
             add constraint targets_user_id_fkey
             foreign key (user_id) references auth.users(id) on delete cascade';
  end if;
end$$;

-- Ensure NOT NULL (only if you want to enforce it; skip if your data doesn't yet populate user_id for old rows)
-- alter table public.targets alter column user_id set not null;

-- Create composite unique index to match onConflict 'user_id,tank_id,parameter_id'
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname='public' and tablename='targets' and indexname='targets_user_tank_param_uidx'
  ) then
    execute 'create unique index targets_user_tank_param_uidx on public.targets(user_id, tank_id, parameter_id)';
  end if;
end$$;

-- Refresh API schema cache
select pg_notify('pgrst','reload schema');
