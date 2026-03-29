create table if not exists public.apply_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete set null,
  mode text not null check (mode in ('plan', 'submit')),
  url text not null,
  portal text,
  status text not null,
  request_payload jsonb not null default '{}'::jsonb,
  result_payload jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_apply_runs_user_created_at
  on public.apply_runs (user_id, created_at desc);

create index if not exists idx_apply_runs_mode_status
  on public.apply_runs (mode, status, created_at desc);

alter table public.apply_runs enable row level security;

drop policy if exists "apply_runs_select_own" on public.apply_runs;
create policy "apply_runs_select_own"
on public.apply_runs
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "apply_runs_insert_own" on public.apply_runs;
create policy "apply_runs_insert_own"
on public.apply_runs
for insert
to authenticated
with check (auth.uid() = user_id);
