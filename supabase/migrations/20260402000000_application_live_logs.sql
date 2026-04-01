-- Add real-time log streaming and user confirmation gate to applications.
--
-- log_events: array of JSON objects {ts, msg, level} appended by the apply engine
--             during a live run so the dashboard can show progress.
-- preview_screenshot: base64-encoded PNG captured just before Submit is clicked.
--                     Shown in the confirmation modal so the user can verify the form.
--
-- New status values:
--   awaiting_confirmation  apply engine filled the form, paused before Submit
--   confirmed              user approved — engine will click Submit
--   cancelled              user cancelled — engine abandons
--   confirmation_timeout   user never responded within the window

-- 1. Add new columns (idempotent)
alter table public.applications
  add column if not exists log_events  jsonb[]  not null default '{}',
  add column if not exists preview_screenshot text;

-- 2. Drop the old check constraint and re-add with new status values
alter table public.applications
  drop constraint if exists applications_status_check;

alter table public.applications
  add constraint applications_status_check
  check (status in (
    'queued',
    'running',
    'awaiting_confirmation',
    'confirmed',
    'cancelled',
    'confirmation_timeout',
    'requires_auth',
    'applied',
    'failed'
  ));

-- 3. Index so the dashboard real-time query is fast
create index if not exists idx_applications_user_status
  on public.applications (user_id, status, updated_at desc);
