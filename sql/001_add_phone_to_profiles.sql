-- One-time migration to add phone column to profiles
alter table if exists public.profiles
  add column if not exists phone text;
