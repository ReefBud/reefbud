-- Ensure parameter keys exist
insert into public.parameters (key, unit, display_name) values
  ('alk','dKH','Alkalinity'),
  ('ca','ppm','Calcium'),
  ('mg','ppm','Magnesium'),
  ('po4','ppm','Phosphate'),
  ('no3','ppm','Nitrate'),
  ('salinity','ppt','Salinity')
on conflict (key) do nothing;

-- Ensure tanks columns exist
alter table public.tanks
  add column if not exists name text,
  add column if not exists volume_value numeric,
  add column if not exists volume_unit text;

-- Ensure targets has needed columns (for safety if your schema varies)
alter table public.targets
  add column if not exists tank_id uuid,
  add column if not exists parameter_id integer,
  add column if not exists target_value numeric;

-- Optional: unique constraint for upsert logic
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname='public' and tablename='targets' and indexname='targets_tank_param_uidx'
  ) then
    execute 'create unique index targets_tank_param_uidx on public.targets(tank_id, parameter_id)';
  end if;
end$$;

-- Refresh API schema cache
select pg_notify('pgrst','reload schema');
