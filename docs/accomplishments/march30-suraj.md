# March 30 Accomplishments (Suraj)

This document captures the latest implementation updates for the Twilio/digest pipeline, dashboard controls, and profile-driven schedule management.

## 1) Daily Prospective List Pipeline (Built)

- Added digest-mode persistence and workflow support:
  - `prospective_lists`
  - `prospective_list_items`
- Added fixed per-user schedule fields and schedule editing support:
  - `daily_digest_shortlist_time_local`
  - `daily_digest_cutoff_time_local`
  - `daily_digest_goal_submit_time_local`
- Added cron-backed digest endpoints:
  - `POST /api/internal/cron/send-prospective-lists`
  - `POST /api/internal/cron/finalize-prospective-lists`
  - `POST /api/internal/cron/send-prospective-results`
- Updated inbound SMS parsing for active prospective lists:
  - `APPLY ALL` / `YES`
  - `SKIP ALL` / `NO`
  - `SKIP <n>` (and bare number like `2`)
  - `HELP`
  - `STOP` cancels active list behavior for the user.

## 2) Fixed-Time Scheduling (No Relative Offsets)

- Moved from offset-based review windows to fixed daily times for key milestones.
- Enforced schedule constraints:
  - shortlist time must be before cutoff
  - cutoff must be before goal submit time
  - minimum buffer of 60 minutes between cutoff and goal
- `send-prospective-lists` now:
  - reads the profile’s fixed local schedule
  - validates schedule before sending
  - sends only near shortlist time (local timezone)
  - stores a concrete `cutoff_at` timestamp for downstream finalization.

## 3) Dashboard Improvements for User Control

- Added a new **Notification schedule** card to dashboard:
  - user can edit shortlist time, cutoff time, and goal submit time
  - clear explanations for each time point
  - save with inline success/error feedback
- Added API endpoint to persist schedule:
  - `POST /api/profile/notification-schedule`
  - validates ordering + minimum execution buffer before saving.

## 4) Gray-Area Clarification UX (Dashboard + API)

- Added a dashboard editor for stored follow-up answers:
  - view/edit/remove existing `gray_areas.follow_up_answers`
  - add new reusable answers manually
- Added API endpoint:
  - `POST /api/profile/followup-answers`
  - saves validated answers into `profiles.gray_areas.follow_up_answers`
  - updates `last_follow_up_response_at`.

## 5) Ingest Behavior Update for Digest Users

- Updated `app/api/jobs/ingest/route.ts` behavior:
  - digest-enabled users do not receive per-job alert SMS at ingest time
  - those users are handled by daily shortlist flow instead.

## 6) Workflow / Ops Updates

- Updated workflow scheduling in `.github/workflows/twin-operations.yml` to include:
  - prospective list send
  - prospective list finalize
  - prospective results send
- Updated `README.md` with:
  - new migration setup
  - digest mode enablement steps
  - local test commands for digest cron endpoints and reply webhook.

## 7) Verification

- TypeScript build passed after changes (`npm run build`).
- Lint checks passed.
- Python syntax checks for apply engine files passed.

