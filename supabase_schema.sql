-- placeholder; will be extended below


-- preferred_products table for saving selected product per parameter
create table if not exists public.preferred_products (
  id uuid primary key default gen_random_uuid(),
  tank_id uuid not null references public.tanks(id) on delete cascade,
  parameter_key text not null check (parameter_key in ('alk','ca','mg','po4','no3')),
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz default now(),
  unique (tank_id, parameter_key)
);
alter table public.preferred_products enable row level security;
create policy "Preferred readable by owner" on public.preferred_products for select using (
  auth.uid() = (select user_id from public.tanks t where t.id = preferred_products.tank_id)
);
create policy "Preferred writable by owner" on public.preferred_products for insert with check (
  auth.uid() = (select user_id from public.tanks t where t.id = preferred_products.tank_id)
);
create policy "Preferred updatable by owner" on public.preferred_products for update using (
  auth.uid() = (select user_id from public.tanks t where t.id = preferred_products.tank_id)
) with check (
  auth.uid() = (select user_id from public.tanks t where t.id = preferred_products.tank_id)
);
create policy "Preferred deletable by owner" on public.preferred_products for delete using (
  auth.uid() = (select user_id from public.tanks t where t.id = preferred_products.tank_id)
);
