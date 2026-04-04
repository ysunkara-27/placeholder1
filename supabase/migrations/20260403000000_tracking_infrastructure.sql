-- ─────────────────────────────────────────────────────────────────────────────
-- Tracking infrastructure: structured events, confirmations, action requests.
--
-- Extends the existing applications/apply_runs schema with:
--   application_events  — queryable structured event log (append-only)
--   application_confirmations — submission evidence keyed to application
--   action_requests     — user-input requests raised mid-run
--
-- Also adds application_id FK on apply_runs so we can navigate
-- from a run back to its parent application.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. application_events ────────────────────────────────────────────────────

create table if not exists public.application_events (
    id              uuid        primary key default gen_random_uuid(),
    application_id  uuid        not null references public.applications(id) on delete cascade,
    user_id         uuid        not null references auth.users(id) on delete cascade,

    -- Which numbered attempt produced this event (1-based, nullable for
    -- lifecycle events emitted before a run starts, e.g. application.created)
    attempt_number  integer,

    -- Structured event taxonomy.  Dot-separated noun.verb pairs.
    -- Examples: application.created, automation.started, field.matched,
    --   field.unmatched, file.uploaded, question.unresolved,
    --   submit.clicked, confirmation.detected, application.completed,
    --   application.failed, application.retry_scheduled,
    --   action_request.created, action_request.resolved
    event_type      text        not null,

    -- log level used for display/filtering
    level           text        not null default 'info'
                    check (level in ('info', 'warn', 'error', 'success', 'confirmation')),

    -- Human-readable summary for display in the dashboard
    summary         text        not null default '',

    -- Machine-readable payload for programmatic use / debugging
    data            jsonb       not null default '{}'::jsonb,

    created_at      timestamptz not null default timezone('utc', now())
);

create index if not exists idx_application_events_app_created
    on public.application_events (application_id, created_at asc);

create index if not exists idx_application_events_user_type
    on public.application_events (user_id, event_type, created_at desc);

create index if not exists idx_application_events_type_level
    on public.application_events (event_type, level, created_at desc);

alter table public.application_events enable row level security;

drop policy if exists "application_events_select_own" on public.application_events;
create policy "application_events_select_own"
    on public.application_events for select to authenticated
    using (auth.uid() = user_id);

-- Service role can insert (apply engine uses service role key)
drop policy if exists "application_events_insert_service" on public.application_events;
create policy "application_events_insert_service"
    on public.application_events for insert to authenticated
    with check (auth.uid() = user_id);


-- ── 2. application_confirmations ─────────────────────────────────────────────

create table if not exists public.application_confirmations (
    id                          uuid    primary key default gen_random_uuid(),
    application_id              uuid    not null unique references public.applications(id) on delete cascade,
    user_id                     uuid    not null references auth.users(id) on delete cascade,
    attempt_number              integer not null,

    -- What kind of confirmation evidence was found
    confirmation_type           text    not null
                                check (confirmation_type in (
                                    'text_snippet',
                                    'application_id',
                                    'email_confirmation',
                                    'screenshot',
                                    'redirect_url'
                                )),

    -- Raw text captured from the confirmation page/email
    detected_text               text,

    -- Application ID as shown by the portal (e.g. ATS reference number)
    external_application_id     text,

    -- URL of the confirmation page
    evidence_url                text,

    -- Storage path for the screenshot (if taken)
    evidence_screenshot_path    text,

    -- 0.0 – 1.0: how confident we are this is a real confirmation
    confidence_score            real    not null default 1.0
                                check (confidence_score between 0.0 and 1.0),

    detected_at                 timestamptz not null default timezone('utc', now())
);

create index if not exists idx_application_confirmations_user
    on public.application_confirmations (user_id, detected_at desc);

alter table public.application_confirmations enable row level security;

drop policy if exists "application_confirmations_select_own" on public.application_confirmations;
create policy "application_confirmations_select_own"
    on public.application_confirmations for select to authenticated
    using (auth.uid() = user_id);

drop policy if exists "application_confirmations_insert_service" on public.application_confirmations;
create policy "application_confirmations_insert_service"
    on public.application_confirmations for insert to authenticated
    with check (auth.uid() = user_id);


-- ── 3. action_requests ───────────────────────────────────────────────────────
-- Raised when the engine hits something it cannot resolve autonomously.
-- The user responds via the dashboard; the worker resumes.

create table if not exists public.action_requests (
    id              uuid    primary key default gen_random_uuid(),
    application_id  uuid    not null references public.applications(id) on delete cascade,
    user_id         uuid    not null references auth.users(id) on delete cascade,
    attempt_number  integer not null,

    -- What kind of input is needed
    action_type     text    not null
                    check (action_type in ('question', 'captcha', 'auth', 'review')),

    -- Prompt shown to the user
    prompt          text    not null,

    -- Extra context: screenshots, field labels, etc.
    context         jsonb   not null default '{}'::jsonb,

    status          text    not null default 'pending'
                    check (status in ('pending', 'responded', 'expired', 'skipped')),

    -- The user's answer (null until responded)
    response        text,

    created_at      timestamptz not null default timezone('utc', now()),
    responded_at    timestamptz,
    expires_at      timestamptz not null
                    default (timezone('utc', now()) + interval '24 hours')
);

create index if not exists idx_action_requests_app_status
    on public.action_requests (application_id, status, created_at desc);

create index if not exists idx_action_requests_user_pending
    on public.action_requests (user_id, status, expires_at asc)
    where status = 'pending';

alter table public.action_requests enable row level security;

drop policy if exists "action_requests_select_own" on public.action_requests;
create policy "action_requests_select_own"
    on public.action_requests for select to authenticated
    using (auth.uid() = user_id);

drop policy if exists "action_requests_insert_service" on public.action_requests;
create policy "action_requests_insert_service"
    on public.action_requests for insert to authenticated
    with check (auth.uid() = user_id);

drop policy if exists "action_requests_update_own" on public.action_requests;
create policy "action_requests_update_own"
    on public.action_requests for update to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);


-- ── 4. apply_runs: add application_id back-reference ─────────────────────────

alter table public.apply_runs
    add column if not exists application_id uuid references public.applications(id) on delete set null;

create index if not exists idx_apply_runs_application_id
    on public.apply_runs (application_id, created_at desc);


-- ── 5. applications: add user_message + execution_status ─────────────────────
-- latest_user_message  — friendly message shown in the dashboard
-- execution_status     — granular internal status (separate from user-facing status)
-- retry_after          — earliest time the worker may retry this application

alter table public.applications
    add column if not exists latest_user_message text,
    add column if not exists execution_status    text,
    add column if not exists retry_after         timestamptz,
    add column if not exists max_attempts        integer not null default 3;


-- ── 6. Function: expire stale action_requests ────────────────────────────────
-- Call this periodically (e.g. pg_cron or a nightly job).

create or replace function public.expire_action_requests()
returns integer
language plpgsql
as $$
declare
    expired_count integer;
begin
    update public.action_requests
    set status = 'expired'
    where status = 'pending'
      and expires_at < timezone('utc', now());

    get diagnostics expired_count = row_count;
    return expired_count;
end;
$$;
