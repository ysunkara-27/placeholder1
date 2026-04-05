-- Add degree_req to jobs: what degree level a posting targets
-- Values: undergrad, masters, phd, any (null = unknown/not specified)

alter table public.jobs
  add column if not exists degree_req text;

-- Back-fill obvious cases from existing title text
update public.jobs
set degree_req = case
  when lower(title) like '%phd%' or lower(title) like '%ph.d%' or lower(title) like '%doctoral%'
    then 'phd'
  when lower(title) like '%master%' or lower(title) like '%mba%' or lower(title) like '%m.s%' or lower(title) like '%ms %'
    then 'masters'
  when level = 'new_grad'
    then 'any'
  else
    'undergrad'
end
where degree_req is null;

create index if not exists idx_jobs_degree_req
  on public.jobs (degree_req);
