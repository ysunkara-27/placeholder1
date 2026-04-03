alter table public.jobs
  add column if not exists canonical_url text,
  add column if not exists canonical_application_url text,
  add column if not exists external_job_key text,
  add column if not exists role_family text,
  add column if not exists target_term text,
  add column if not exists target_year integer,
  add column if not exists experience_band text,
  add column if not exists is_early_career boolean not null default true;

alter table public.profiles
  add column if not exists target_role_families text[] not null default '{}',
  add column if not exists target_terms text[] not null default '{}',
  add column if not exists target_years integer[] not null default '{}',
  add column if not exists graduation_year integer,
  add column if not exists graduation_term text;

update public.jobs
set
  canonical_url = coalesce(canonical_url, url),
  canonical_application_url = coalesce(canonical_application_url, application_url),
  role_family = coalesce(
    role_family,
    case level
      when 'internship' then 'internship'
      when 'co_op' then 'co_op'
      when 'new_grad' then 'new_grad'
      when 'part_time' then 'part_time'
      else null
    end
  ),
  experience_band = coalesce(
    experience_band,
    case level
      when 'internship' then 'student'
      when 'co_op' then 'student'
      when 'new_grad' then 'new_grad'
      when 'part_time' then 'student'
      else 'early_career'
    end
  )
where canonical_url is null
   or canonical_application_url is null
   or role_family is null
   or experience_band is null;

update public.profiles
set
  target_role_families = case
    when coalesce(array_length(target_role_families, 1), 0) > 0 then target_role_families
    else levels
  end,
  graduation_year = coalesce(
    graduation_year,
    case
      when graduation ~ '20[0-9][0-9]' then substring(graduation from '(20[0-9][0-9])')::integer
      else null
    end
  )
where coalesce(array_length(target_role_families, 1), 0) = 0
   or graduation_year is null;

create unique index if not exists idx_jobs_canonical_url_unique
  on public.jobs (canonical_url);

create index if not exists idx_jobs_canonical_application_url
  on public.jobs (canonical_application_url);

create index if not exists idx_jobs_role_family
  on public.jobs (role_family);

create index if not exists idx_jobs_target_year
  on public.jobs (target_year);

create index if not exists idx_jobs_target_term
  on public.jobs (target_term);

create index if not exists idx_jobs_is_early_career
  on public.jobs (is_early_career);

create index if not exists idx_jobs_industries_gin
  on public.jobs using gin (industries);

create index if not exists idx_profiles_industries_gin
  on public.profiles using gin (industries);

create index if not exists idx_profiles_target_role_families_gin
  on public.profiles using gin (target_role_families);

create index if not exists idx_profiles_target_terms_gin
  on public.profiles using gin (target_terms);

create or replace function public.select_candidate_profiles_for_job(
  p_industries text[],
  p_role_family text,
  p_target_term text,
  p_target_year integer,
  p_remote boolean,
  p_location text
)
returns table (
  id uuid
)
language sql
stable
as $$
  select profiles.id
  from public.profiles as profiles
  where profiles.onboarding_completed = true
    and (
      coalesce(array_length(profiles.industries, 1), 0) = 0
      or coalesce(array_length(p_industries, 1), 0) = 0
      or profiles.industries && p_industries
    )
    and (
      coalesce(array_length(profiles.target_role_families, 1), 0) = 0
      or p_role_family is null
      or p_role_family = any(profiles.target_role_families)
      or (
        p_role_family = 'associate'
        and 'new_grad' = any(profiles.target_role_families)
      )
    )
    and (
      coalesce(array_length(profiles.target_terms, 1), 0) = 0
      or p_target_term is null
      or 'any' = any(profiles.target_terms)
      or p_target_term = any(profiles.target_terms)
    )
    and (
      coalesce(array_length(profiles.target_years, 1), 0) = 0
      or p_target_year is null
      or p_target_year = any(profiles.target_years)
      or profiles.graduation_year = p_target_year
    )
    and (
      p_remote = true
      or profiles.remote_ok = true
      or coalesce(array_length(profiles.locations, 1), 0) = 0
      or exists (
        select 1
        from unnest(profiles.locations) as preferred_location
        where lower(p_location) like '%' || lower(preferred_location) || '%'
           or lower(preferred_location) like '%' || lower(p_location) || '%'
      )
    );
$$;

create or replace function public.select_candidate_jobs_for_profile(
  p_profile_id uuid,
  p_since timestamptz default null
)
returns setof public.jobs
language sql
stable
as $$
  with profile as (
    select *
    from public.profiles
    where id = p_profile_id
      and onboarding_completed = true
  )
  select jobs.*
  from public.jobs as jobs
  cross join profile
  where jobs.status = 'active'
    and (p_since is null or jobs.posted_at >= p_since)
    and (
      coalesce(array_length(profile.industries, 1), 0) = 0
      or coalesce(array_length(jobs.industries, 1), 0) = 0
      or jobs.industries && profile.industries
    )
    and (
      coalesce(array_length(profile.target_role_families, 1), 0) = 0
      or jobs.role_family is null
      or jobs.role_family = any(profile.target_role_families)
      or (
        jobs.role_family = 'associate'
        and 'new_grad' = any(profile.target_role_families)
      )
    )
    and (
      coalesce(array_length(profile.target_terms, 1), 0) = 0
      or jobs.target_term is null
      or 'any' = any(profile.target_terms)
      or jobs.target_term = any(profile.target_terms)
    )
    and (
      coalesce(array_length(profile.target_years, 1), 0) = 0
      or jobs.target_year is null
      or jobs.target_year = any(profile.target_years)
      or profile.graduation_year = jobs.target_year
    )
    and (
      jobs.remote = true
      or profile.remote_ok = true
      or coalesce(array_length(profile.locations, 1), 0) = 0
      or exists (
        select 1
        from unnest(profile.locations) as preferred_location
        where lower(jobs.location) like '%' || lower(preferred_location) || '%'
           or lower(preferred_location) like '%' || lower(jobs.location) || '%'
      )
    )
  order by jobs.posted_at desc;
$$;
