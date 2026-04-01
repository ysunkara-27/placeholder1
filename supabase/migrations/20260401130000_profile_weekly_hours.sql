alter table public.profiles
  add column if not exists weekly_availability_hours text;
