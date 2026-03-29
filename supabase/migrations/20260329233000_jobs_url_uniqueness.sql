with ranked_jobs as (
  select
    id,
    url,
    row_number() over (
      partition by url
      order by created_at desc, id desc
    ) as row_num,
    first_value(id) over (
      partition by url
      order by created_at desc, id desc
    ) as canonical_id
  from public.jobs
  where url is not null
),
duplicate_jobs as (
  select
    id as duplicate_id,
    canonical_id
  from ranked_jobs
  where row_num > 1
)
delete from public.alerts as alerts
using duplicate_jobs
where alerts.job_id = duplicate_jobs.duplicate_id
  and exists (
    select 1
    from public.alerts as canonical_alert
    where canonical_alert.user_id = alerts.user_id
      and canonical_alert.job_id = duplicate_jobs.canonical_id
  );

with ranked_jobs as (
  select
    id,
    url,
    row_number() over (
      partition by url
      order by created_at desc, id desc
    ) as row_num,
    first_value(id) over (
      partition by url
      order by created_at desc, id desc
    ) as canonical_id
  from public.jobs
  where url is not null
),
duplicate_jobs as (
  select
    id as duplicate_id,
    canonical_id
  from ranked_jobs
  where row_num > 1
)
update public.alerts as alerts
set job_id = duplicate_jobs.canonical_id
from duplicate_jobs
where alerts.job_id = duplicate_jobs.duplicate_id;

with ranked_jobs as (
  select
    id,
    url,
    row_number() over (
      partition by url
      order by created_at desc, id desc
    ) as row_num,
    first_value(id) over (
      partition by url
      order by created_at desc, id desc
    ) as canonical_id
  from public.jobs
  where url is not null
),
duplicate_jobs as (
  select
    id as duplicate_id,
    canonical_id
  from ranked_jobs
  where row_num > 1
)
update public.applications as applications
set job_id = duplicate_jobs.canonical_id
from duplicate_jobs
where applications.job_id = duplicate_jobs.duplicate_id;

with ranked_jobs as (
  select
    id,
    url,
    row_number() over (
      partition by url
      order by created_at desc, id desc
    ) as row_num,
    first_value(id) over (
      partition by url
      order by created_at desc, id desc
    ) as canonical_id
  from public.jobs
  where url is not null
),
duplicate_jobs as (
  select
    id as duplicate_id,
    canonical_id
  from ranked_jobs
  where row_num > 1
)
update public.apply_runs as apply_runs
set job_id = duplicate_jobs.canonical_id
from duplicate_jobs
where apply_runs.job_id = duplicate_jobs.duplicate_id;

with ranked_jobs as (
  select
    id,
    url,
    row_number() over (
      partition by url
      order by created_at desc, id desc
    ) as row_num,
    first_value(id) over (
      partition by url
      order by created_at desc, id desc
    ) as canonical_id
  from public.jobs
  where url is not null
),
duplicate_jobs as (
  select
    id as duplicate_id
  from ranked_jobs
  where row_num > 1
)
delete from public.jobs as jobs
using duplicate_jobs
where jobs.id = duplicate_jobs.duplicate_id;

create unique index if not exists idx_jobs_url_unique
  on public.jobs (url);

create index if not exists idx_jobs_application_url
  on public.jobs (application_url);
