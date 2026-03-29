-- Add portal column to jobs so the apply engine knows which agent to use
-- without re-detecting from the URL every time.
alter table public.jobs
  add column if not exists portal text
    check (portal in ('greenhouse','lever','workday','handshake','linkedin','indeed','icims','smartrecruiters','company_website','other'));
