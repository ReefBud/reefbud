-- ReefBud Dashboard Targets schema (idempotent)
-- Creates/normalizes public.targets with user_id + RLS and salinity column.

create table if not exists public.targets (
  id uuid,
  alk numeric,
  ca numeric,
  mg numeric,
  po4 numeric,
  no3 numeric,
  salinity numeric,
  updated_at timestamptz default now()
);

-- Ensure user_id column exists (rename id if it's uuid)
do $$
declare
  has_user_id boolean;
  has_id_uuid boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='targets' and column_name='user_id'
  ) into has_user_id;

  select exists (
    select 1
    from information_schema.columns
    where table_schema='public' and table_name='targets' and column_name='id'
      and data_type='uuid'
  ) into has_id_uuid;

  if not has_user_id then
    if has_id_uuid then
      execute 'alter table public.targets rename column id to user_id';
    else
      execute 'alter table public.targets add column user_id uuid';
    end if;
  end if;
end$$;

-- Unique index on user_id
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname='public' and tablename='targets' and indexname='targets_user_id_uidx'
  ) then
    execute 'create unique index targets_user_id_uidx on public.targets(user_id)';
  end if;
end$$;

-- Foreign key to auth.users
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname='targets_user_id_fkey' and connamespace = 'public'::regnamespace
  ) then
    execute 'alter table public.targets
             add constraint targets_user_id_fkey
             foreign key (user_id) references auth.users(id) on delete cascade';
  end if;
end$$;

-- Enable RLS
alter table public.targets enable row level security;

-- Policies (create only if missing)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='targets' and policyname='select own targets'
  ) then
    create policy "select own targets"
    on public.targets for select
    to authenticated
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='targets' and policyname='insert own targets'
  ) then
    create policy "insert own targets"
    on public.targets for insert
    to authenticated
    with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='targets' and policyname='update own targets'
  ) then
    create policy "update own targets"
    on public.targets for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;
end$$;

-- Promote user_id to PK if no PK yet
do $$
declare
  has_pk boolean;
begin
  select exists (
    select 1 from pg_constraint
    where conrelid = 'public.targets'::regclass and contype = 'p'
  ) into has_pk;

  if not has_pk then
    execute 'alter table public.targets add primary key (user_id)';
  end if;
end$$;
