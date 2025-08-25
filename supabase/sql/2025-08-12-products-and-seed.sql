-- Create products table if not exists
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null, -- null means global catalog
  brand text,
  name text not null,
  parameter_key text not null check (parameter_key in ('alk','ca','mg','po4','no3','trace')),
  dose_ref_ml numeric null,
  delta_ref_value numeric null,
  volume_ref_liters numeric null,
  notes text,
  created_at timestamptz default now()
);

-- RLS
alter table public.products enable row level security;

-- Read policy: everyone can read global products (user_id is null)
create policy if not exists "Products: read global"
on public.products for select using (user_id is null);

-- Read own products
create policy if not exists "Products: read own"
on public.products for select using (auth.uid() = user_id);

-- Write own products
create policy if not exists "Products: write own"
on public.products for insert with check (auth.uid() = user_id);

create policy if not exists "Products: update own"
on public.products for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy if not exists "Products: delete own"
on public.products for delete using (auth.uid() = user_id);

-- Seed Tropic Marin Balling products into global catalog
insert into public.products (user_id,brand,name,parameter_key,dose_ref_ml,delta_ref_value,volume_ref_liters,notes)
values
  (null,'Tropic Marin','Balling A (Calcium)','ca',30,15,35,'Guide: 30 ml raises Ca ~15 ppm in 35 L'),
  (null,'Tropic Marin','Balling B (Alkalinity)','alk',30,2.2,35,'Guide: 30 ml raises Alk ~2.2 dKH in 35 L'),
  (null,'Tropic Marin','Balling C (Magnesium)','mg',null,null,null,'Add potency values from bottle'),
  (null,'Tropic Marin','K+ Elements (Trace cations)','trace',null,null,null,'Trace element blend'),
  (null,'Tropic Marin','A- Elements (Trace anions)','trace',null,null,null,'Trace element blend')
on conflict do nothing;

-- Preferred products table (if not already created elsewhere)
create table if not exists public.preferred_products (
  id uuid primary key default gen_random_uuid(),
  tank_id uuid not null references public.tanks(id) on delete cascade,
  parameter_key text not null check (parameter_key in ('alk','ca','mg','po4','no3')),
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz default now(),
  unique (tank_id, parameter_key)
);
alter table public.preferred_products enable row level security;

create policy if not exists "Preferred: read owner"
on public.preferred_products for select using (
  auth.uid() = (select user_id from public.tanks t where t.id = preferred_products.tank_id)
);
create policy if not exists "Preferred: write owner"
on public.preferred_products for insert with check (
  auth.uid() = (select user_id from public.tanks t where t.id = preferred_products.tank_id)
);
create policy if not exists "Preferred: update owner"
on public.preferred_products for update using (
  auth.uid() = (select user_id from public.tanks t where t.id = preferred_products.tank_id)
) with check (
  auth.uid() = (select user_id from public.tanks t where t.id = preferred_products.tank_id)
);
create policy if not exists "Preferred: delete owner"
on public.preferred_products for delete using (
  auth.uid() = (select user_id from public.tanks t where t.id = preferred_products.tank_id)
);

-- refresh
select pg_notify('pgrst','reload schema');