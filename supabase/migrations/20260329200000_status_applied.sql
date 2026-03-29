-- Rename 'submitted' → 'applied' in applications.status check constraint.
--
-- The first migration used 'submitted' but every other layer
-- (apply engine, dashboard, SMS loop) uses 'applied'. Align the DB
-- to the product language so there is one canonical status vocabulary.

-- 1. Migrate any existing 'submitted' rows before we touch the constraint
update public.applications
set status = 'applied'
where status = 'submitted';

-- 2. Drop the old check constraint by name (Postgres names it automatically
--    based on table + column; we drop both possible names for safety)
alter table public.applications
  drop constraint if exists applications_status_check;

-- 3. Re-add the constraint with 'applied' in place of 'submitted'
alter table public.applications
  add constraint applications_status_check
  check (status in ('queued', 'running', 'requires_auth', 'applied', 'failed'));
