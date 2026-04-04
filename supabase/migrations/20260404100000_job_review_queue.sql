-- Add review queue support to jobs table
-- New status: 'pending' — scraped but not yet admin-verified
-- first_seen_at: immutable, set on first insert
-- last_seen_at: updated every time the scraper re-encounters the job

-- 1. Drop the existing status check constraint so we can add 'pending'
alter table public.jobs
  drop constraint if exists jobs_status_check;

-- Re-add with 'pending' included
alter table public.jobs
  add constraint jobs_status_check
  check (status in ('pending', 'active', 'paused', 'closed'));

-- 2. Change the default status for new jobs to 'pending'
alter table public.jobs
  alter column status set default 'pending';

-- 3. Add timestamp tracking columns
alter table public.jobs
  add column if not exists first_seen_at timestamptz,
  add column if not exists last_seen_at  timestamptz;

-- 4. Back-fill existing rows: treat posted_at as first_seen_at, now as last_seen_at
update public.jobs
set
  first_seen_at = coalesce(first_seen_at, posted_at, now()),
  last_seen_at  = coalesce(last_seen_at, now())
where first_seen_at is null or last_seen_at is null;

-- 5. Trigger: auto-set first_seen_at on INSERT (immutable thereafter)
--    and always refresh last_seen_at
create or replace function public.set_job_seen_timestamps()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    new.first_seen_at := coalesce(new.first_seen_at, now());
    new.last_seen_at  := now();
  elsif TG_OP = 'UPDATE' then
    -- first_seen_at is immutable — restore the old value if caller tried to change it
    new.first_seen_at := coalesce(old.first_seen_at, new.first_seen_at, now());
    new.last_seen_at  := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_job_seen_timestamps on public.jobs;
create trigger trg_job_seen_timestamps
  before insert or update on public.jobs
  for each row execute function public.set_job_seen_timestamps();
