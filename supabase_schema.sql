
-- Schema (same as earlier, trimmed to necessary tables/policies)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Profiles are self-access only" on public.profiles for select using (auth.uid() = id);
create policy "Profiles can insert self" on public.profiles for insert with check (auth.uid() = id);
create policy "Profiles can update self" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create table if not exists public.tanks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  volume_value numeric not null check (volume_value > 0),
  volume_unit text not null check (volume_unit in ('L','gal')),
  created_at timestamptz default now()
);
alter table public.tanks enable row level security;
create policy "Tanks are owner readable" on public.tanks for select using (auth.uid() = user_id);
create policy "Tanks are owner writable" on public.tanks for insert with check (auth.uid() = user_id);
create policy "Tanks are owner updatable" on public.tanks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Tanks are owner deletable" on public.tanks for delete using (auth.uid() = user_id);

create table if not exists public.parameters (
  id serial primary key,
  key text unique not null,
  unit text not null,
  display_name text not null
);
insert into public.parameters (key, unit, display_name)
  values ('alk','dKH','Alkalinity'),('ca','ppm','Calcium'),('mg','ppm','Magnesium'),
         ('po4','ppm','Phosphates'),('no3','ppm','Nitrates')
  on conflict (key) do nothing;

create table if not exists public.targets (
  id uuid primary key default gen_random_uuid(),
  tank_id uuid not null references public.tanks(id) on delete cascade,
  parameter_id int not null references public.parameters(id) on delete restrict,
  target_value numeric not null,
  created_at timestamptz default now(),
  unique (tank_id, parameter_id)
);
alter table public.targets enable row level security;
create policy "Targets readable by owner" on public.targets for select using (
  auth.uid() = (select user_id from public.tanks t where t.id = targets.tank_id)
);
create policy "Targets writable by owner" on public.targets for insert with check (
  auth.uid() = (select user_id from public.tanks t where t.id = targets.tank_id)
);
create policy "Targets updatable by owner" on public.targets for update using (
  auth.uid() = (select user_id from public.tanks t where t.id = targets.tank_id)
) with check (
  auth.uid() = (select user_id from public.tanks t where t.id = targets.tank_id)
);
create policy "Targets deletable by owner" on public.targets for delete using (
  auth.uid() = (select user_id from public.tanks t where t.id = targets.tank_id)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  brand text,
  name text not null,
  parameter_key text not null check (parameter_key in ('alk','ca','mg','po4','no3')),
  dose_ref_ml numeric,
  delta_ref_value numeric,
  volume_ref_liters numeric,
  notes text,
  created_at timestamptz default now()
);
alter table public.products enable row level security;
create policy "Products readable by owner" on public.products for select using (auth.uid() = user_id);
create policy "Products owner insert" on public.products for insert with check (auth.uid() = user_id);
create policy "Products owner update" on public.products for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Products owner delete" on public.products for delete using (auth.uid() = user_id);

create table if not exists public.readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tank_id uuid references public.tanks(id) on delete set null,
  date_iso date not null,
  time_str text not null,
  alk numeric, ca numeric, mg numeric, po4 numeric, no3 numeric,
  created_at timestamptz default now()
);
alter table public.readings enable row level security;
create policy "Readings readable by owner" on public.readings for select using (auth.uid() = user_id);
create policy "Readings writable by owner" on public.readings for insert with check (auth.uid() = user_id);
create policy "Readings deletable by owner" on public.readings for delete using (auth.uid() = user_id);
