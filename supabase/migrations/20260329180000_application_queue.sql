alter table public.applications
  add column if not exists request_payload jsonb,
  add column if not exists last_error text,
  add column if not exists attempt_count integer,
  add column if not exists queued_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists last_run_id uuid references public.apply_runs (id) on delete set null,
  add column if not exists worker_id text;

update public.applications
set
  request_payload = coalesce(request_payload, '{}'::jsonb),
  attempt_count = coalesce(attempt_count, 0),
  queued_at = coalesce(queued_at, created_at),
  completed_at = case
    when status = 'submitted' and completed_at is null then coalesce(applied_at, updated_at)
    else completed_at
  end
where
  request_payload is null
  or attempt_count is null
  or queued_at is null
  or (status = 'submitted' and completed_at is null);

alter table public.applications
  alter column request_payload set default '{}'::jsonb,
  alter column request_payload set not null,
  alter column attempt_count set default 0,
  alter column attempt_count set not null,
  alter column queued_at set default timezone('utc', now()),
  alter column queued_at set not null;

create index if not exists idx_applications_queue_status
  on public.applications (status, queued_at asc, created_at asc);

create or replace function public.claim_next_application(
  p_worker_id text,
  p_user_id uuid default null
)
returns setof public.applications
language plpgsql
as $$
begin
  return query
  with next_application as (
    select id
    from public.applications
    where status = 'queued'
      and (p_user_id is null or user_id = p_user_id)
    order by queued_at asc, created_at asc
    for update skip locked
    limit 1
  )
  update public.applications as applications
  set
    status = 'running',
    started_at = timezone('utc', now()),
    completed_at = null,
    worker_id = p_worker_id,
    attempt_count = applications.attempt_count + 1,
    last_error = null
  from next_application
  where applications.id = next_application.id
  returning applications.*;
end;
$$;
