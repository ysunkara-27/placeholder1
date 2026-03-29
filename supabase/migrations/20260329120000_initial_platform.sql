create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  phone text,
  school text,
  degree text,
  graduation text,
  gpa text,
  industries text[] not null default '{}',
  levels text[] not null default '{}',
  locations text[] not null default '{}',
  remote_ok boolean not null default false,
  gray_areas jsonb,
  resume_json jsonb,
  notification_pref text not null default 'email' check (notification_pref in ('email', 'sms')),
  sms_provider text check (sms_provider in ('plivo', 'twilio')),
  sms_opt_in boolean not null default false,
  onboarding_completed boolean not null default false,
  subscription_tier text not null default 'free' check (subscription_tier in ('free', 'pro', 'turbo')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  title text not null,
  level text not null,
  location text not null,
  remote boolean not null default false,
  industries text[] not null default '{}',
  url text not null,
  application_url text not null,
  jd_summary text,
  status text not null default 'active' check (status in ('active', 'paused', 'closed')),
  metadata jsonb not null default '{}'::jsonb,
  posted_at timestamptz not null,
  scraped_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'skipped', 'expired', 'applied', 'failed')),
  response_channel text check (response_channel in ('sms', 'email', 'app')),
  metadata jsonb not null default '{}'::jsonb,
  alerted_at timestamptz not null default timezone('utc', now()),
  replied_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, job_id)
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'requires_auth', 'submitted', 'failed')),
  confirmation_text text,
  browsing_task_id text,
  applied_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_profiles_notification_pref
  on public.profiles (notification_pref);

create index if not exists idx_jobs_posted_at
  on public.jobs (posted_at desc);

create index if not exists idx_jobs_level
  on public.jobs (level);

create index if not exists idx_alerts_user_status
  on public.alerts (user_id, status, alerted_at desc);

create index if not exists idx_applications_user_status
  on public.applications (user_id, status, created_at desc);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_jobs_updated_at on public.jobs;
create trigger set_jobs_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

drop trigger if exists set_alerts_updated_at on public.alerts;
create trigger set_alerts_updated_at
before update on public.alerts
for each row execute function public.set_updated_at();

drop trigger if exists set_applications_updated_at on public.applications;
create trigger set_applications_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.alerts enable row level security;
alter table public.applications enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "jobs_select_authenticated" on public.jobs;
create policy "jobs_select_authenticated"
on public.jobs
for select
to authenticated
using (true);

drop policy if exists "alerts_select_own" on public.alerts;
create policy "alerts_select_own"
on public.alerts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "alerts_insert_own" on public.alerts;
create policy "alerts_insert_own"
on public.alerts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "alerts_update_own" on public.alerts;
create policy "alerts_update_own"
on public.alerts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "applications_select_own" on public.applications;
create policy "applications_select_own"
on public.applications
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "applications_insert_own" on public.applications;
create policy "applications_insert_own"
on public.applications
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "applications_update_own" on public.applications;
create policy "applications_update_own"
on public.applications
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
