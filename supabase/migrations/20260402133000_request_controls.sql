create table if not exists public.request_rate_limits (
  scope text not null,
  subject text not null,
  window_started_at timestamptz not null,
  hit_count integer not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (scope, subject)
);

alter table public.request_rate_limits enable row level security;

alter table public.applications
  add column if not exists request_fingerprint text;

create index if not exists idx_applications_request_fingerprint
  on public.applications (user_id, job_id, request_fingerprint);

create or replace function public.consume_rate_limit(
  p_scope text,
  p_subject text,
  p_window_seconds integer,
  p_limit integer
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
as $$
declare
  v_now timestamptz := timezone('utc', now());
  current_window_started_at timestamptz := timezone(
    'utc',
    to_timestamp(
      floor(extract(epoch from v_now) / greatest(p_window_seconds, 1)) * greatest(p_window_seconds, 1)
    )
  );
  existing_row public.request_rate_limits%rowtype;
  next_count integer;
begin
  select *
  into existing_row
  from public.request_rate_limits
  where scope = p_scope
    and subject = p_subject
  for update;

  if not found or existing_row.window_started_at <> current_window_started_at then
    insert into public.request_rate_limits (
      scope,
      subject,
      window_started_at,
      hit_count,
      updated_at
    )
    values (
      p_scope,
      p_subject,
      current_window_started_at,
      1,
      v_now
    )
    on conflict (scope, subject)
    do update
      set window_started_at = excluded.window_started_at,
          hit_count = 1,
          updated_at = excluded.updated_at;

    return query
      select true, greatest(p_limit - 1, 0), current_window_started_at + make_interval(secs => greatest(p_window_seconds, 1));
    return;
  end if;

  next_count := existing_row.hit_count + 1;

  update public.request_rate_limits
  set hit_count = next_count,
      updated_at = v_now
  where scope = p_scope
    and subject = p_subject;

  return query
    select
      next_count <= p_limit,
      greatest(p_limit - least(next_count, p_limit), 0),
      current_window_started_at + make_interval(secs => greatest(p_window_seconds, 1));
end;
$$;
