-- Daily Prospective Jobs List (digest mode) tables + profile settings.
-- This enables a workflow where the app texts a numbered shortlist,
-- the user can `SKIP <n>` / `APPLY ALL`, and Twin queues applications at cutoff.

create table if not exists public.prospective_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  digest_date date not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'finalized', 'applied')),
  sent_at timestamptz,
  cutoff_at timestamptz,
  -- "queued now, results soon" SMS at cutoff
  queued_results_sent_at timestamptz,
  -- Fully resolved outcome SMS after applications finish
  final_results_sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_prospective_lists_user_date
  on public.prospective_lists (user_id, digest_date desc);

drop trigger if exists set_prospective_lists_updated_at on public.prospective_lists;
create trigger set_prospective_lists_updated_at
before update on public.prospective_lists
for each row execute function public.set_updated_at();

create table if not exists public.prospective_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.prospective_lists (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  rank integer not null,
  match_score numeric,
  match_reasons jsonb not null default '{}'::jsonb,
  match_rejections jsonb not null default '[]'::jsonb,
  -- pending: user hasn't responded yet
  -- confirmed: user chose to apply (or finalized at cutoff)
  -- skip: user chose to skip this job
  user_decision text not null default 'pending'
    check (user_decision in ('pending', 'skip', 'confirmed')),
  applied_application_id uuid references public.applications (id) on delete set null,
  blocked_reason jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  unique (list_id, job_id)
);

create index if not exists idx_prospective_list_items_list_rank
  on public.prospective_list_items (list_id, rank asc);

drop trigger if exists set_prospective_list_items_updated_at on public.prospective_list_items;
create trigger set_prospective_list_items_updated_at
before update on public.prospective_list_items
for each row execute function public.set_updated_at();

-- RLS
alter table public.prospective_lists enable row level security;
alter table public.prospective_list_items enable row level security;

drop policy if exists "prospective_lists_select_own" on public.prospective_lists;
create policy "prospective_lists_select_own"
on public.prospective_lists
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "prospective_lists_update_own" on public.prospective_lists;
create policy "prospective_lists_update_own"
on public.prospective_lists
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "prospective_list_items_select_own" on public.prospective_list_items;
create policy "prospective_list_items_select_own"
on public.prospective_list_items
for select
to authenticated
using (
  exists (
    select 1
    from public.prospective_lists l
    where l.id = list_id and l.user_id = auth.uid()
  )
);

drop policy if exists "prospective_list_items_update_own" on public.prospective_list_items;
create policy "prospective_list_items_update_own"
on public.prospective_list_items
for update
to authenticated
using (
  exists (
    select 1
    from public.prospective_lists l
    where l.id = list_id and l.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.prospective_lists l
    where l.id = list_id and l.user_id = auth.uid()
  )
);

-- Profile settings for digest mode.
alter table public.profiles
  add column if not exists daily_digest_enabled boolean not null default false,
  add column if not exists daily_digest_time_local text not null default '18:30',
  add column if not exists daily_digest_timezone text not null default 'UTC',
  add column if not exists daily_review_window_minutes integer not null default 60;

