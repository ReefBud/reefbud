begin;

create table if not exists public.preferred_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  tank_id uuid not null references public.tanks(id) on delete cascade,
  parameter_id integer not null references public.parameters(id),
  product_id uuid not null references public.products(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.preferred_products'::regclass
      and conname  = 'preferred_products_user_tank_param_key'
  ) then
    alter table public.preferred_products
      add constraint preferred_products_user_tank_param_key
      unique (user_id, tank_id, parameter_id);
  end if;
end $$;

alter table public.preferred_products enable row level security;

drop policy if exists preferred_products_select on public.preferred_products;
create policy preferred_products_select on public.preferred_products
  for select using (user_id = auth.uid());

drop policy if exists preferred_products_write on public.preferred_products;
create policy preferred_products_write on public.preferred_products
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_preferred_products_updated_at on public.preferred_products;
create trigger trg_preferred_products_updated_at
before update on public.preferred_products
for each row execute function public.set_updated_at();

commit;
