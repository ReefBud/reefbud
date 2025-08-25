-- Preferred products + policies + TM seed (idempotent)
begin;

-- Ensure parameters exist
create table if not exists public.parameters (
  id serial primary key,
  key text unique not null,
  unit text not null,
  display_name text not null default 'Parameter'
);

insert into public.parameters (key, unit, display_name) values
  ('alk','dKH','Alkalinity'),
  ('ca','ppm','Calcium'),
  ('mg','ppm','Magnesium'),
  ('po4','ppm','Phosphate'),
  ('no3','ppm','Nitrate')
on conflict (key) do update
  set unit = excluded.unit,
      display_name = excluded.display_name;

-- Ensure products table exists
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  brand text not null,
  name text not null,
  parameter_id integer references public.parameters(id),
  dose_ref_ml numeric,
  delta_ref_value numeric,
  volume_ref_liters numeric,
  helper_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helpful uniqueness: scope by user (null=user is global catalog)
create unique index if not exists products_unique_user_brand_name_param
  on public.products (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), brand, name, parameter_id);

-- Ensure preferred_products table + unique triple for upsert
create table if not exists public.preferred_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  tank_id uuid not null references public.tanks(id) on delete cascade,
  parameter_id integer not null references public.parameters(id),
  product_id uuid not null references public.products(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tank_id, parameter_id)
);

-- Enable RLS
alter table public.products enable row level security;
alter table public.preferred_products enable row level security;

-- Products RLS: global (user_id null) visible to all signed-in users; user-owned visible to owner
drop policy if exists products_select_policy on public.products;
create policy products_select_policy on public.products
  for select using (user_id is null or user_id = auth.uid());

drop policy if exists products_modify_policy on public.products;
create policy products_modify_policy on public.products
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Preferred products RLS: only owner can see/modify
drop policy if exists preferred_products_select_policy on public.preferred_products;
create policy preferred_products_select_policy on public.preferred_products
  for select using (user_id = auth.uid());

drop policy if exists preferred_products_modify_policy on public.preferred_products;
create policy preferred_products_modify_policy on public.preferred_products
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists trg_preferred_products_updated_at on public.preferred_products;
create trigger trg_preferred_products_updated_at
before update on public.preferred_products
for each row execute function public.set_updated_at();

-- Seed Tropic Marin products as global catalog (user_id null)
with ids as (
  select
    (select id from public.parameters where key='ca')  as ca_id,
    (select id from public.parameters where key='alk') as alk_id,
    (select id from public.parameters where key='mg')  as mg_id
)
insert into public.products (user_id, brand, name, parameter_id, dose_ref_ml, delta_ref_value, volume_ref_liters, helper_text)
select null, 'Tropic Marin', 'Balling A (Calcium)', ca_id, 30, 15, 35,
       '1 fl.oz./30 ml raises Ca ~15 ppm in 35 L; Alk ~2.2 dKH.'
from ids
on conflict (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), brand, name, parameter_id) do nothing;

with ids as (
  select (select id from public.parameters where key='alk') as alk_id
)
insert into public.products (user_id, brand, name, parameter_id, dose_ref_ml, delta_ref_value, volume_ref_liters, helper_text)
select null, 'Tropic Marin', 'Balling B (Alkalinity)', alk_id, 30, 2.2, 35,
       '1 fl.oz./30 ml raises Ca ~15 ppm in 35 L; Alk ~2.2 dKH.'
from ids
on conflict (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), brand, name, parameter_id) do nothing;

with ids as (
  select (select id from public.parameters where key='mg') as mg_id
)
insert into public.products (user_id, brand, name, parameter_id, helper_text)
select null, 'Tropic Marin', 'Balling C (Magnesium)', mg_id,
       'Use per label; potency not modeled here.'
from ids
on conflict (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), brand, name, parameter_id) do nothing;

commit;
