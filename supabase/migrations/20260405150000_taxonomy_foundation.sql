create table if not exists public.taxonomy_nodes (
  id uuid primary key default gen_random_uuid(),
  dimension text not null,
  slug text not null,
  label text not null,
  parent_node_id uuid references public.taxonomy_nodes (id) on delete cascade,
  depth integer not null default 0,
  is_leaf boolean not null default false,
  status text not null default 'active' check (status in ('active', 'draft', 'deprecated')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (dimension, slug)
);

create table if not exists public.taxonomy_aliases (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.taxonomy_nodes (id) on delete cascade,
  alias text not null,
  alias_normalized text not null,
  match_kind text not null default 'positive' check (match_kind in ('positive', 'supporting')),
  field_scope text[] not null default '{}',
  weight numeric not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (node_id, alias_normalized, match_kind)
);

create table if not exists public.taxonomy_negative_aliases (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.taxonomy_nodes (id) on delete cascade,
  phrase text not null,
  phrase_normalized text not null,
  field_scope text[] not null default '{}',
  penalty numeric not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (node_id, phrase_normalized)
);

create table if not exists public.taxonomy_paths (
  ancestor_node_id uuid not null references public.taxonomy_nodes (id) on delete cascade,
  descendant_node_id uuid not null references public.taxonomy_nodes (id) on delete cascade,
  distance integer not null check (distance >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (ancestor_node_id, descendant_node_id)
);

create table if not exists public.company_taxonomy_priors (
  id uuid primary key default gen_random_uuid(),
  company_slug text not null unique,
  company_name text not null,
  company_aliases text[] not null default '{}',
  primary_industry_node_ids uuid[] not null default '{}',
  secondary_industry_node_ids uuid[] not null default '{}',
  default_job_function_node_ids uuid[] not null default '{}',
  confidence text not null default 'high' check (confidence in ('high', 'medium', 'low')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.job_taxonomy_mappings (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  dimension text not null,
  node_id uuid not null references public.taxonomy_nodes (id) on delete cascade,
  is_primary boolean not null default false,
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  resolution_kind text not null,
  source_fields text[] not null default '{}',
  matched_evidence jsonb not null default '[]'::jsonb,
  needs_review boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  unique (job_id, dimension, node_id)
);

create table if not exists public.profile_taxonomy_mappings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  profile_layer text not null check (profile_layer in ('match_preferences', 'application_facts')),
  dimension text not null,
  node_id uuid not null references public.taxonomy_nodes (id) on delete cascade,
  is_primary boolean not null default false,
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  resolution_kind text not null,
  source_fields text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (profile_id, profile_layer, dimension, node_id)
);

create table if not exists public.job_taxonomy_resolution_logs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  resolver_version text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.jobs
  add column if not exists locations_text text[] not null default '{}',
  add column if not exists work_modality text check (work_modality in ('remote', 'hybrid', 'onsite', 'unknown')),
  add column if not exists work_modality_confidence text check (work_modality_confidence in ('high', 'medium', 'low')),
  add column if not exists job_geo_node_ids uuid[] not null default '{}',
  add column if not exists job_industry_node_ids uuid[] not null default '{}',
  add column if not exists job_function_node_ids uuid[] not null default '{}',
  add column if not exists job_career_node_ids uuid[] not null default '{}',
  add column if not exists job_degree_requirement_node_ids uuid[] not null default '{}',
  add column if not exists job_education_field_node_ids uuid[] not null default '{}',
  add column if not exists job_work_auth_node_ids uuid[] not null default '{}',
  add column if not exists job_employment_type_node_ids uuid[] not null default '{}',
  add column if not exists job_taxonomy_summary jsonb not null default '{}'::jsonb,
  add column if not exists taxonomy_resolution_version text,
  add column if not exists taxonomy_needs_review boolean not null default false;

alter table public.profiles
  add column if not exists profile_match_preferences jsonb not null default '{}'::jsonb,
  add column if not exists profile_application_facts jsonb not null default '{}'::jsonb,
  add column if not exists profile_geo_allow_node_ids uuid[] not null default '{}',
  add column if not exists profile_industry_allow_node_ids uuid[] not null default '{}',
  add column if not exists profile_job_function_allow_node_ids uuid[] not null default '{}',
  add column if not exists profile_career_allow_node_ids uuid[] not null default '{}',
  add column if not exists profile_work_modality_allow text[] not null default '{}',
  add column if not exists profile_degree_node_ids uuid[] not null default '{}',
  add column if not exists profile_education_field_node_ids uuid[] not null default '{}',
  add column if not exists profile_work_auth_node_ids uuid[] not null default '{}',
  add column if not exists profile_employment_type_allow_node_ids uuid[] not null default '{}',
  add column if not exists profile_taxonomy_summary jsonb not null default '{}'::jsonb;

create index if not exists idx_taxonomy_nodes_dimension_parent
  on public.taxonomy_nodes (dimension, parent_node_id);

create index if not exists idx_taxonomy_nodes_dimension_depth
  on public.taxonomy_nodes (dimension, depth);

create index if not exists idx_taxonomy_aliases_alias_normalized
  on public.taxonomy_aliases (alias_normalized);

create index if not exists idx_taxonomy_aliases_node_id
  on public.taxonomy_aliases (node_id);

create index if not exists idx_taxonomy_negative_aliases_phrase_normalized
  on public.taxonomy_negative_aliases (phrase_normalized);

create index if not exists idx_taxonomy_paths_descendant
  on public.taxonomy_paths (descendant_node_id);

create index if not exists idx_company_taxonomy_priors_company_name
  on public.company_taxonomy_priors (company_name);

create index if not exists idx_company_taxonomy_priors_primary_industries_gin
  on public.company_taxonomy_priors using gin (primary_industry_node_ids);

create index if not exists idx_company_taxonomy_priors_secondary_industries_gin
  on public.company_taxonomy_priors using gin (secondary_industry_node_ids);

create index if not exists idx_job_taxonomy_mappings_job_dimension
  on public.job_taxonomy_mappings (job_id, dimension);

create index if not exists idx_job_taxonomy_mappings_dimension_node
  on public.job_taxonomy_mappings (dimension, node_id);

create index if not exists idx_job_taxonomy_mappings_needs_review
  on public.job_taxonomy_mappings (needs_review)
  where needs_review = true;

create index if not exists idx_profile_taxonomy_mappings_profile_layer_dimension
  on public.profile_taxonomy_mappings (profile_id, profile_layer, dimension);

create index if not exists idx_profile_taxonomy_mappings_dimension_node
  on public.profile_taxonomy_mappings (dimension, node_id);

create index if not exists idx_job_taxonomy_resolution_logs_job_id
  on public.job_taxonomy_resolution_logs (job_id, created_at desc);

create index if not exists idx_jobs_locations_text_gin
  on public.jobs using gin (locations_text);

create index if not exists idx_jobs_job_geo_node_ids_gin
  on public.jobs using gin (job_geo_node_ids);

create index if not exists idx_jobs_job_industry_node_ids_gin
  on public.jobs using gin (job_industry_node_ids);

create index if not exists idx_jobs_job_function_node_ids_gin
  on public.jobs using gin (job_function_node_ids);

create index if not exists idx_jobs_job_career_node_ids_gin
  on public.jobs using gin (job_career_node_ids);

create index if not exists idx_jobs_job_degree_requirement_node_ids_gin
  on public.jobs using gin (job_degree_requirement_node_ids);

create index if not exists idx_jobs_job_education_field_node_ids_gin
  on public.jobs using gin (job_education_field_node_ids);

create index if not exists idx_jobs_job_work_auth_node_ids_gin
  on public.jobs using gin (job_work_auth_node_ids);

create index if not exists idx_jobs_job_employment_type_node_ids_gin
  on public.jobs using gin (job_employment_type_node_ids);

create index if not exists idx_jobs_work_modality
  on public.jobs (work_modality);

create index if not exists idx_jobs_taxonomy_needs_review
  on public.jobs (taxonomy_needs_review)
  where taxonomy_needs_review = true;

create index if not exists idx_profiles_profile_geo_allow_node_ids_gin
  on public.profiles using gin (profile_geo_allow_node_ids);

create index if not exists idx_profiles_profile_industry_allow_node_ids_gin
  on public.profiles using gin (profile_industry_allow_node_ids);

create index if not exists idx_profiles_profile_job_function_allow_node_ids_gin
  on public.profiles using gin (profile_job_function_allow_node_ids);

create index if not exists idx_profiles_profile_career_allow_node_ids_gin
  on public.profiles using gin (profile_career_allow_node_ids);

create index if not exists idx_profiles_profile_work_modality_allow_gin
  on public.profiles using gin (profile_work_modality_allow);

create index if not exists idx_profiles_profile_degree_node_ids_gin
  on public.profiles using gin (profile_degree_node_ids);

create index if not exists idx_profiles_profile_education_field_node_ids_gin
  on public.profiles using gin (profile_education_field_node_ids);

create index if not exists idx_profiles_profile_work_auth_node_ids_gin
  on public.profiles using gin (profile_work_auth_node_ids);

create index if not exists idx_profiles_profile_employment_type_allow_node_ids_gin
  on public.profiles using gin (profile_employment_type_allow_node_ids);

drop trigger if exists set_taxonomy_nodes_updated_at on public.taxonomy_nodes;
create trigger set_taxonomy_nodes_updated_at
before update on public.taxonomy_nodes
for each row execute function public.set_updated_at();

drop trigger if exists set_taxonomy_aliases_updated_at on public.taxonomy_aliases;
create trigger set_taxonomy_aliases_updated_at
before update on public.taxonomy_aliases
for each row execute function public.set_updated_at();

drop trigger if exists set_taxonomy_negative_aliases_updated_at on public.taxonomy_negative_aliases;
create trigger set_taxonomy_negative_aliases_updated_at
before update on public.taxonomy_negative_aliases
for each row execute function public.set_updated_at();

drop trigger if exists set_company_taxonomy_priors_updated_at on public.company_taxonomy_priors;
create trigger set_company_taxonomy_priors_updated_at
before update on public.company_taxonomy_priors
for each row execute function public.set_updated_at();

alter table public.taxonomy_nodes enable row level security;
alter table public.taxonomy_aliases enable row level security;
alter table public.taxonomy_negative_aliases enable row level security;
alter table public.taxonomy_paths enable row level security;
alter table public.company_taxonomy_priors enable row level security;
alter table public.job_taxonomy_mappings enable row level security;
alter table public.profile_taxonomy_mappings enable row level security;
alter table public.job_taxonomy_resolution_logs enable row level security;

drop policy if exists "taxonomy_nodes_select_authenticated" on public.taxonomy_nodes;
create policy "taxonomy_nodes_select_authenticated"
on public.taxonomy_nodes
for select
to authenticated
using (true);

drop policy if exists "taxonomy_aliases_select_authenticated" on public.taxonomy_aliases;
create policy "taxonomy_aliases_select_authenticated"
on public.taxonomy_aliases
for select
to authenticated
using (true);

drop policy if exists "taxonomy_negative_aliases_select_authenticated" on public.taxonomy_negative_aliases;
create policy "taxonomy_negative_aliases_select_authenticated"
on public.taxonomy_negative_aliases
for select
to authenticated
using (true);

drop policy if exists "taxonomy_paths_select_authenticated" on public.taxonomy_paths;
create policy "taxonomy_paths_select_authenticated"
on public.taxonomy_paths
for select
to authenticated
using (true);

drop policy if exists "company_taxonomy_priors_select_authenticated" on public.company_taxonomy_priors;
create policy "company_taxonomy_priors_select_authenticated"
on public.company_taxonomy_priors
for select
to authenticated
using (true);

drop policy if exists "job_taxonomy_mappings_select_authenticated" on public.job_taxonomy_mappings;
create policy "job_taxonomy_mappings_select_authenticated"
on public.job_taxonomy_mappings
for select
to authenticated
using (
  exists (
    select 1
    from public.jobs
    where jobs.id = job_taxonomy_mappings.job_id
  )
);

drop policy if exists "profile_taxonomy_mappings_select_own" on public.profile_taxonomy_mappings;
create policy "profile_taxonomy_mappings_select_own"
on public.profile_taxonomy_mappings
for select
to authenticated
using (auth.uid() = profile_id);

create or replace function public.rebuild_taxonomy_paths()
returns void
language plpgsql
as $$
begin
  delete from public.taxonomy_paths;

  with recursive path_tree as (
    select
      nodes.id as ancestor_node_id,
      nodes.id as descendant_node_id,
      0 as distance
    from public.taxonomy_nodes as nodes

    union all

    select
      path_tree.ancestor_node_id,
      child.id as descendant_node_id,
      path_tree.distance + 1 as distance
    from path_tree
    join public.taxonomy_nodes as child
      on child.parent_node_id = path_tree.descendant_node_id
  )
  insert into public.taxonomy_paths (ancestor_node_id, descendant_node_id, distance)
  select distinct ancestor_node_id, descendant_node_id, distance
  from path_tree;
end;
$$;
