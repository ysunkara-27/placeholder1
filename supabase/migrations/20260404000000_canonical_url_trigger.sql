-- Auto-fill canonical_url from url on every insert/update.
-- Prevents jobs from becoming invisible to the browse API,
-- which hard-filters WHERE canonical_url IS NOT NULL.

create or replace function public.fill_canonical_url()
returns trigger
language plpgsql
as $$
begin
  if new.canonical_url is null then
    new.canonical_url := new.url;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_fill_canonical_url on public.jobs;

create trigger trg_fill_canonical_url
  before insert or update on public.jobs
  for each row
  execute function public.fill_canonical_url();
