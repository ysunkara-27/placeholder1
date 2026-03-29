# Twin Master Planning Document

Last updated: 2026-03-29

This document is the source of truth for building `Twin` into a fully functional product.

It is intentionally practical. It should reflect:

- what is already implemented in this repo
- what is still mocked, partial, or missing
- what the next execution order should be
- how planning is updated when development shifts between Codex and Claude

If this document and the code disagree, the code wins first, then this document must be updated immediately.

## Planning Rules

1. `docs/master-planning.md` is the primary planning document.
2. `docs/platform-roadmap.md` is legacy and should only exist as a pointer to this file.
3. Research from Claude belongs in `twinmegaresearch.md` or `docs/research/*.md`.
4. Actionable conclusions from research must be translated into this file.
5. A feature is not “done” until:
   - code exists
   - tests exist or a written test gap is recorded
   - this document reflects the new truth
6. Never mark a product capability as live in UI copy unless backend evidence exists.

## Current Reality

As of this update, the repo already has meaningful platform scaffolding.

### Implemented

- Next.js frontend with landing, onboarding, resume flow, dashboard, and internal apply lab
- Supabase-backed onboarding/profile persistence
- Supabase-backed apply run audit trail
- On-demand materialization of seeded job URLs into real `jobs` rows
- Real `applications` records used as the first queue primitive for apply execution
- Queue-backed apply submission with stored request payloads, per-user manual processing, and secret-backed worker processing
- Dashboard recent applications fed from DB-backed `applications` + `jobs`
- Dashboard recent applications now reflect `queued`, `running`, `applied`, `requires_auth`, and `failed` states from DB truth
- Apply runs now capture inline screenshots for filled, final, and failure states
- Apply engine service scaffold in Python with FastAPI endpoints
- Portal detector for Greenhouse, Lever, Workday, Handshake, and fallback vision classification
- Greenhouse and Lever planning/execution flow with:
  - contact field support
  - resume upload support
  - start date, location preference, and salary expectation
  - work authorization and sponsorship
  - normalized custom answer mappings for education/relocation/source
  - recurring screening families for onsite preference, weekly availability, graduation window, and commute preference
  - multi-step next/review/submit flow
  - auth wall detection
  - validation error detection
  - confirmation text and confirmation URL detection
- Fixture-backed tests for selectors and browser behavior
- Internal `/apply-lab` page for planning and dry submit inspection

### Still Not Fully Real

- No production job ingestion pipeline yet
- No real matching engine yet
- No live alerting or inbound SMS reply loop yet
- No always-on scheduler / retry / dead-letter pipeline yet
- No Workday or Handshake real agent yet
- No real Claude vision fallback execution yet
- No screenshot storage separation or replay tooling yet
- No billing, plan caps, or Stripe
- Seeded jobs are only materialized when touched by plan/submit routes, not via a full import/sync pipeline
- Dashboard still overstates some platform readiness relative to backend reality

### Research Input Status

`twinmegaresearch.md` currently contains no usable research content.

That means:

- planning below is based on current repo state and known product direction
- future Claude research should be treated as input, not as source of truth, until integrated here

## Product Goal

Twin should let a student:

1. create and maintain a durable profile
2. ingest, structure, and protect a resume
3. set constraints and preferences
4. ingest and match jobs
5. review or auto-trigger applications
6. submit through major ATS portals
7. track success, failures, manual blockers, and follow-up actions

## Product Principles

- Deterministic first: hardcode known ATS flows before using AI.
- Cheap by default: use AI only when the DOM is too custom or unstable.
- Honest product: do not claim monitoring, applying, or messaging unless it is real.
- Full auditability: every apply attempt needs inputs, actions, outputs, and failure clues.
- Safety before autonomy: hard stops must exist for auth walls, validation blockers, and ambiguous questions.
- Replace guesswork with normalized fields: profile data and screening questions need stable internal keys.

## Architecture Direction

### Main App

- Framework: Next.js
- Runtime split:
  - Vercel for frontend/api routes by default
  - Supabase for auth and Postgres
  - Railway for Python apply engine initially

### Apply Engine

- Python
- FastAPI for plan/apply endpoints
- Playwright for browser automation
- Anthropic for vision fallback only

### Data Plane

- `profiles`
- `jobs`
- `alerts`
- `applications`
- `apply_runs`

### Core Service Boundaries

- Next app owns user-facing product flows
- Apply engine owns browser automation decisions and execution
- Supabase stores user state, jobs, alerts, applications, and run history

## Source-of-Truth Files

- Product/master plan: `docs/master-planning.md`
- Claude research intake: `twinmegaresearch.md`
- Lightweight legacy roadmap: `docs/platform-roadmap.md`
- Apply engine implementation notes: `apply_engine/README.md`
- Seed jobs: `data/job-seeds/live-openings-2026.json`

## Status Semantics

Use these exact meanings in planning updates:

- `not started`: no code exists
- `scaffolded`: code shape exists but not production-real
- `partial`: some real functionality exists but critical gaps remain
- `implemented`: feature is functionally real in normal conditions
- `hardened`: feature has tests, error handling, and operational visibility
- `launched`: safe to expose as a real product capability

## Workstreams

Twin should be developed across these workstreams in parallel but shipped in the order below.

1. Platform truth
2. Dashboard truth
3. Job intake and normalization
4. Matching and alerting
5. Messaging and approvals
6. Apply engine MVP
7. Portal expansion
8. Answer system and document assets
9. Safety, observability, and operations
10. Billing and packaging

## Phase Plan

### Phase 0: Planning Discipline

Status: `partial`

Objective:

- Make planning durable across Codex + Claude handoffs.

Deliverables:

- source-of-truth master planning doc
- collaboration/update protocol
- status semantics
- decision log format
- required test/result logging

Exit criteria:

- every meaningful feature change updates this file
- legacy roadmap points here

Tests:

- no code tests required
- documentation consistency check required after every major feature batch

### Phase 1: Platform Truth

Status: `partial`

Objective:

- Ensure profile/session state is real and consistent.

Deliverables:

- Supabase auth fully configured
- onboarding persistence fully verified
- session management including sign out
- server-safe profile fetch path
- typed DB access helpers

Open items:

- verify anonymous auth flow against actual project config
- verify sign-out/session reset against live Supabase session behavior
- move more dashboard data loading server-side or shared-helper based

Exit criteria:

- onboarding create/update works against live Supabase
- dashboard only loads for completed profiles
- sign-out fully clears session and returns user to entry state

Required tests:

- onboarding persistence integration test
- dashboard redirect behavior test
- signed-in vs signed-out state tests
- DB helper unit tests where practical

### Phase 2: Dashboard Truth

Status: `partial`

Objective:

- Stop showing placeholder platform confidence and replace it with real system state.

Deliverables:

- real stats from persisted records
- recent application attempts and alerts
- explicit state labels:
  - building
  - monitoring
  - paused
  - auth required
  - error
- last sync / next scan / provider status

Open items:

- dashboard still lacks real worker/provider health indicators
- no last queue run / next worker poll visibility yet
- provider/system health states are still missing

Exit criteria:

- every dashboard stat comes from DB-backed records
- every system claim has evidence behind it

Required tests:

- empty state rendering
- failure state rendering
- user isolation for all dashboard records

### Phase 3: Job Intake and Normalization

Status: `partial`

Objective:

- Ingest jobs into a canonical internal model before matching/applying.

Deliverables:

- `job_sources` config
- normalized `jobs` ingestion format
- canonical URL rules
- dedupe rules
- ingest path for manual seeds first
- later automated source jobs

Open items:

- seeded jobs are now persisted on demand through apply plan/submit routes
- there is still no explicit import/sync job for seeds or future sources
- no canonicalization/dedupe implementation yet

Exit criteria:

- seeded jobs can be imported into `jobs`
- duplicates are prevented
- portal and source metadata are attached

Required tests:

- canonicalization
- dedupe
- portal classification
- import idempotency

### Phase 4: Matching Engine

Status: `not started`

Objective:

- Turn user profile data and job metadata into real match decisions.

Deliverables:

- scoring model
- hard constraint filters
- explainable match metadata
- `alerts` creation for qualifying jobs

Matching dimensions:

- industry
- role level
- location
- remote preference
- sponsorship requirement
- compensation range when available
- graduation window where relevant

Exit criteria:

- a job can be marked matched/rejected with stored reasons
- alert creation is deterministic and auditable

Required tests:

- remote/city/multi-location cases
- sponsorship filter
- match explanation persistence
- threshold behavior

### Phase 5: Messaging and Approval Loop

Status: `scaffolded`

Objective:

- Notify users and capture approval or decline signals.

Deliverables:

- provider abstraction
- outbound alerts
- inbound YES / NO / STOP handling
- pause state
- app-only fallback notifications

Provider order:

1. Plivo
2. Twilio fallback
3. email only if needed later

Exit criteria:

- a real matched alert can create a message
- YES can create an application job
- STOP pauses outbound alerts

Required tests:

- outbound payloads
- webhook verification
- reply parsing
- opt-out enforcement

### Phase 6: Apply Engine MVP

Status: `partial`

Objective:

- Make deterministic application execution real for Greenhouse and Lever.

Already implemented:

- detector
- plan/apply endpoints
- queue-backed submit path with application-backed deferred execution
- Greenhouse/Lever selector maps
- normalized profile fields
- custom-answer mapping path
- auth/validation/review/confirmation handling
- internal lab
- apply run persistence

Still needed before `implemented`:

- request/response correlation IDs
- stronger real-world fixture coverage from live portals
- safer stop conditions on ambiguous/custom questions
- better replay tooling for failed runs
- always-on queue scheduling and retry rules

Exit criteria:

- Greenhouse and Lever can submit a stable happy path against real-world samples
- blocked runs are classified correctly
- run metadata is enough to debug failures without guessing

Required tests:

- fixture-backed unit tests
- browser flow tests
- submit/review/confirmation variants
- auth wall classification
- validation failure classification
- file upload coverage
- selector regression tests from real captured pages

### Phase 7: Portal Expansion

Status: `partial`

Objective:

- Extend coverage beyond Greenhouse and Lever.

Target order:

1. Workday
2. Handshake
3. vision fallback hardening

Why:

- Workday is painful but important
- Handshake matters for students but may require different handling
- vision fallback should be a strict fallback, not a lazy default

Exit criteria:

- Workday supports meaningful deterministic coverage
- Handshake has a safe strategy or an explicit product decision not to automate it
- fallback trigger rules are explicit and enforced

Required tests:

- multi-step workday navigation
- slow-load retry behavior
- fallback action schema validation
- screenshot-to-action replay tests where feasible

### Phase 8: Answer System and Document Assets

Status: `partial`

Objective:

- Build reusable answer primitives and stable supporting documents.

Deliverables:

- normalized profile answer library
- cover letter strategy only when required
- resume PDF generation/verification before submit
- short-answer library for recurring prompts

Open items:

- no real cover-letter/document generation pipeline yet
- current answer system is field-level, not prompt-level

Exit criteria:

- common prompt families can be answered from normalized fields
- resume artifacts are verified before apply

Required tests:

- locked data boundary tests
- PDF existence checks
- answer provenance tests

### Phase 9: Safety, Observability, and Operations

Status: `partial`

Objective:

- Make the system operable, replayable, and safe.

Deliverables:

- structured logs
- screenshots
- retry policy
- dead-letter handling
- admin replay tools
- queue visibility
- rate limiting

Exit criteria:

- failures can be replayed or diagnosed from stored evidence
- retry policy does not create duplicate applications

Required tests:

- timeout and retry tests
- duplicate suppression tests
- failure persistence tests
- provider outage behavior

### Phase 10: Billing and Packaging

Status: `not started`

Objective:

- Monetize only after the engine is real.

Deliverables:

- usage counters
- plan caps
- plan enforcement
- Stripe

Exit criteria:

- plans affect queueing and applying behavior

Required tests:

- cap enforcement
- upgrade/downgrade behavior
- billing webhook correctness

## Cross-Cutting Execution Rules

### Rule 1: Do Not Overbuild the Wrong Layer

- do not add polished product copy before backend truth exists
- do not add pricing before real apply throughput exists
- do not build AI-heavy logic where deterministic selectors solve the problem

### Rule 2: Normalize Before You Automate

Any new recurring question family should first become:

1. a normalized internal field key
2. a profile/answer data source
3. a selector mapping or custom selector spec
4. a tested action plan

Only after that should it become browser logic.

### Rule 3: All Automation Must Be Auditable

Every apply run should eventually store:

- request payload
- portal
- normalized question/answer set used
- action list
- screenshots
- final status
- confirmation text or blocker clue

### Rule 4: Ambiguity Must Stop the Automation

If the engine cannot safely determine an answer or portal state, it should:

- stop
- classify the blocker
- persist context
- surface the manual or fallback path

## Immediate Build Queue

This is the current recommended order of execution from today.

1. Add queue-backed apply execution.
2. Implement outbound/inbound messaging loop.
3. Add Workday agent.

## Full Test Strategy

### Python Apply Engine

- unit tests for normalization, selector specs, payload validation
- fixture tests for portal selector coverage
- browser flow tests for:
  - multi-step progression
  - review pages
  - validation blockers
  - auth walls
  - confirmation text
  - confirmation URL
- regression tests for newly added normalized question families

### Next App

- route tests for apply plan/submit proxies
- route tests for apply run persistence
- component tests for dashboard/apply-lab states where feasible
- auth/session behavior tests
- DB integration checks for profile and run history flows

### Manual Verification Checklists

Every major feature batch should include a written manual check for:

- onboarding still persists and reloads
- dashboard still loads for real saved users
- apply lab still runs plan and submit
- recent run history still displays correct status and summary

## Definition of Done by Feature Type

### For a New Normalized Question Family

Must include:

- canonical field key
- alias handling if needed
- profile or answer source
- portal selector mapping
- action generation
- tests
- master document update

### For a New Portal

Must include:

- detector support if needed
- selector map
- happy path
- failure classification
- fixture coverage
- run visibility
- explicit unsupported cases

### For a New Product Capability

Must include:

- DB model if needed
- backend truth
- UI state
- test coverage
- updated product copy
- planning status update

## Decision Log Format

Every meaningful architecture or product decision should be appended under a dated entry in this file or a dedicated decisions file if volume grows.

Use this shape:

```md
### YYYY-MM-DD: Decision Title

- Context:
- Decision:
- Why:
- Tradeoffs:
- Follow-up work:
```

## Feature Update Protocol for Codex + Claude

This is mandatory whenever work shifts between tools.

### Before Starting a Feature

The active model should:

1. read `docs/master-planning.md`
2. read the directly relevant implementation files
3. identify whether the target feature is `not started`, `scaffolded`, `partial`, or `implemented`
4. confirm which tests or gaps will define success

### After Completing a Feature Batch

The active model should update:

1. implementation code
2. tests
3. this planning document
4. any feature-specific research or notes if new knowledge was discovered

### Required Planning Update Fields

When a feature batch lands, record:

- what changed
- what is now real
- what is still missing
- what tests passed
- what tests do not exist yet
- what the next blocking step is

### When Claude Does Research

Claude output should not be treated as implementation truth automatically.

The workflow is:

1. save the research in `twinmegaresearch.md` or `docs/research/*.md`
2. extract concrete conclusions
3. translate those conclusions into:
   - normalized field keys
   - selector specs
   - fallback rules
   - plan changes
4. update this file with the new practical conclusions

### When Codex Implements

Codex should:

1. use the research only after it has been translated into actionable implementation items
2. prefer deterministic code paths first
3. add tests in the same feature batch
4. update this file so Claude does not reason from stale assumptions later

## Suggested Session Update Template

Use this exact template at the end of a feature batch:

```md
### Session Update: YYYY-MM-DD

- Workstream:
- Feature batch:
- Status before:
- Status after:
- Files changed:
- Tests run:
- Tests passed:
- Known gaps:
- Next recommended step:
```

### Session Update: 2026-03-28

- Workstream: Initial scaffold
- Feature batch: Next.js app skeleton — onboarding, resume builder, Claude API routes, landing page
- Status before: empty repo with only basicidea.md
- Status after: full Next.js 15 + Tailwind + TypeScript app with working dev server and zero build errors
- Files changed:
  - `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`
  - `lib/types.ts` — ResumeProfile, UserPreferences, GrayAreaSuggestion, ChatMessage, Job, Alert
  - `lib/utils.ts` — cn(), generateId(), INDUSTRY_OPTIONS, LEVEL_OPTIONS, POPULAR_CITIES
  - `lib/claude.ts` — getClaudeClient() singleton, RESUME_SYSTEM_PROMPT, GRAY_AREAS_SYSTEM_PROMPT
  - `components/ui/` — Button, Input, Textarea, Badge, Progress
  - `components/onboarding/` — step-industries, step-level, step-locations, step-notifications, step-gray-areas
  - `components/resume/` — chat-interface, resume-preview, pdf-uploader
  - `app/onboarding/page.tsx` — 5-step animated flow (Framer Motion)
  - `app/resume/page.tsx` — split-pane chat + live preview
  - `app/page.tsx` — landing page
  - `app/api/resume/chat/route.ts` — SSE streaming Claude chat
  - `app/api/resume/parse/route.ts` — PDF → raw text (pdf-parse)
  - `app/api/onboarding/gray-areas/route.ts` — Claude-suggested salary/visa/company size
- Tests run: `npm run build`, `npx tsc --noEmit`
- Tests passed: Next production build passed, zero TypeScript errors
- Known gaps:
  - no Supabase auth or DB — all state in localStorage
  - no apply engine
  - no alerting/messaging
  - brand was still "AutoApply"
- Next recommended step: integrate Supabase, redesign onboarding with profile-first flow and resume annotation

### Session Update: 2026-03-29

- Workstream: Onboarding v2 + resume annotation UX + dashboard scaffold
- Feature batch: 4-step onboarding, locked/flexible resume annotator, Twin dashboard, landing page rebrand
- Status before: 5-step localStorage-only onboarding, chat-driven resume builder, no dashboard, "AutoApply" branding
- Status after: 4-step onboarding wired to Supabase (anonymous auth → profiles upsert), resume annotator with per-bullet lock/flexible toggle, dashboard scaffold reading from DB, brand renamed to "Twin"
- Files changed:
  - `lib/types.ts` — added LockState, AnnotatedBullet, AnnotatedSkill, AnnotatedExperience, AnnotatedResume, PersonalInfo
  - `lib/claude.ts` — added STRUCTURE_SYSTEM_PROMPT
  - `app/api/resume/structure/route.ts` — Claude structures raw PDF text → AnnotatedResume JSON (all bullets/skills default to "flexible")
  - `components/resume/lock-toggle.tsx` — animated sliding pill (indigo = locked, amber = flexible), framer-motion layout spring
  - `components/resume/annotated-bullet.tsx` — border-l-4 color bar for visual scan, inline edit on hover, commit/cancel
  - `components/resume/annotated-skill.tsx` — chip grid, click-to-toggle, add-skill inline input
  - `components/resume/resume-annotator.tsx` — explainer callout, bulk lock/flexible/reset, collapsible experience blocks
  - `components/onboarding/step-profile.tsx` — name, email, school, degree, graduation, GPA
  - `components/onboarding/step-preferences.tsx` — industries + role type + locations + gray areas in one scrollable step (debounced Claude fetch, AbortController)
  - `components/onboarding/step-resume.tsx` — upload → structuring loading state → annotator phases
  - `components/onboarding/step-phone.tsx` — phone input + SMS mockup preview, optional skip
  - `app/onboarding/page.tsx` — full rewrite: Supabase anonymous auth on mount, profile upsert on finish, numbered circle step progress, 4-step STEPS config
  - `app/dashboard/page.tsx` — reads from Supabase session + profiles table, redirect guard, shimmer bar, Twin stats, settings summary
  - `components/dashboard/twin-stats.tsx` — Applied/Queued/Failed stat cards (later updated by Codex to match real queue states)
  - `components/dashboard/applications-list.tsx` — empty state with pulsing rings, status badge row
  - `app/page.tsx` — new headline "While you sleep, your Twin is applying.", single CTA "Build my Twin", portal routing section, renamed to Twin
  - `README.md` — setup guide with env vars, Supabase migrations, apply engine, queue processing
- Tests run: `npm run build`, `npx tsc --noEmit`
- Tests passed: Next production build passed, zero TypeScript errors
- Known gaps:
  - lib/platform/profile.ts, lib/supabase/client.ts not yet written (Codex added later)
  - no apply engine yet
  - no queue execution yet
  - no messaging loop yet
- Next recommended step: wire Supabase helpers and platform profile layer, then apply engine

### Session Update: 2026-03-29

- Workstream: Dashboard truth + job intake bridge
- Feature batch: Materialize seeded jobs on demand, create/update real applications on submit, and load recent applications from DB on the dashboard
- Status before: apply runs were real, but jobs/applications were still mostly disconnected from the visible product
- Status after: plan/submit can attach to real `jobs`, submit can create/update `applications`, and the dashboard recent applications card is DB-backed
- Files changed:
  - `lib/jobs.ts`
  - `lib/applications.ts`
  - `lib/apply-runs.ts`
  - `app/api/apply/plan/route.ts`
  - `app/api/apply/submit/route.ts`
  - `app/api/applications/recent/route.ts`
  - `app/dashboard/page.tsx`
  - `components/dashboard/applications-list.tsx`
- Tests run:
  - `npm run test:apply-engine`
  - `python3 -m py_compile $(find apply_engine -name '*.py')`
  - `npm run build`
- Tests passed:
  - 36 Python tests passed
  - Python bytecode compile passed
  - Next production build passed
- Known gaps:
  - no screenshot capture yet
  - no queue-backed execution yet
  - no live sign-out/session reset verification yet
  - seeded jobs are still created on demand instead of via a true import/sync pipeline
- Next recommended step:
  - implement sign-out/session reset, then screenshot capture for apply runs

### Session Update: 2026-03-29

- Workstream: Platform truth
- Feature batch: Real dashboard sign-out/session reset control
- Status before: dashboard had a dead sign-out button with no auth behavior
- Status after: dashboard sign-out now calls Supabase sign-out, clears the current session, and redirects to `/`
- Files changed:
  - `components/auth/sign-out-button.tsx`
  - `app/dashboard/page.tsx`
  - `docs/master-planning.md`
- Tests run:
  - `npm run build`
  - `npm run test:apply-engine`
  - `python3 -m py_compile $(find apply_engine -name '*.py')`
- Tests passed:
  - Next production build passed
  - 36 Python tests passed
  - Python bytecode compile passed
- Known gaps:
  - no live browser auth integration test yet
  - no queue-backed execution yet
- Next recommended step:
  - add screenshot capture to apply runs

### Session Update: 2026-03-29

- Workstream: Apply engine hardening
- Feature batch: Screenshot capture for apply runs and lab previews
- Status before: apply runs stored only textual evidence and action summaries
- Status after: apply results include inline screenshots for filled/final/failure states, run summaries count screenshots, and the apply lab can preview captured screenshots
- Files changed:
  - `apply_engine/models.py`
  - `apply_engine/schemas.py`
  - `apply_engine/serialize.py`
  - `apply_engine/browser.py`
  - `apply_engine/agents/greenhouse.py`
  - `apply_engine/agents/lever.py`
  - `apply_engine/tests/test_agents.py`
  - `apply_engine/tests/test_browser.py`
  - `apply_engine/tests/test_serialize.py`
  - `lib/apply-engine.ts`
  - `lib/apply-runs.ts`
  - `components/apply/apply-lab.tsx`
  - `components/dashboard/apply-runs-list.tsx`
  - `docs/master-planning.md`
- Tests run:
  - `npm run test:apply-engine`
  - `python3 -m py_compile $(find apply_engine -name '*.py')`
  - `npm run build`
- Tests passed:
  - 37 Python tests passed
  - Python bytecode compile passed
  - Next production build passed
- Known gaps:
  - screenshots are stored inline in run payloads rather than in dedicated storage
  - no replay tooling yet
  - no queue-backed execution yet
- Next recommended step:
  - add recurring screening families, then move to queue-backed execution

### Session Update: 2026-03-29

- Workstream: Apply engine hardening
- Feature batch: Add recurring screening families for onsite preference, weekly availability, graduation window, and commute preference
- Status before: Twin covered core contact, authorization, sponsorship, and some custom education/source fields, but not several common internship gating questions
- Status after: the normalized applicant profile, selector specs, and action planner now support onsite preference, weekly availability hours, graduation window, and commute preference across Greenhouse and Lever
- Files changed:
  - `apply_engine/models.py`
  - `apply_engine/schemas.py`
  - `apply_engine/agents/common.py`
  - `apply_engine/portal_specs.py`
  - `apply_engine/tests/test_agents.py`
  - `apply_engine/tests/test_schemas.py`
  - `apply_engine/tests/fixtures/greenhouse_form.html`
  - `apply_engine/tests/fixtures/lever_form.html`
  - `lib/apply-engine.ts`
  - `lib/platform/applicant.ts`
  - `components/apply/apply-lab.tsx`
  - `docs/master-planning.md`
- Tests run:
  - `npm run test:apply-engine`
  - `python3 -m py_compile $(find apply_engine -name '*.py')`
  - `npm run build`
- Tests passed:
  - 37 Python tests passed
  - Python bytecode compile passed
  - Next production build passed
- Known gaps:
- no queue-backed execution yet
- no screenshot storage separation yet
- no Workday agent yet
- Next recommended step:
  - add always-on queue scheduling, then move into messaging and approval loop

### Session Update: 2026-03-29

- Workstream: Apply engine operations
- Feature batch: Queue-backed apply execution using `applications` as the first queue record
- Status before: apply submission executed inline from the user-facing route, and the dashboard had no truthful queued/running execution state
- Status after: apply submission now queues deterministic request payloads onto `applications`, queued jobs can be processed through a per-user manual route or a secret-backed worker route, worker execution persists apply runs and updates final application state, and the dashboard/apply lab reflect queued and running truth
- Files changed:
  - `supabase/migrations/20260329180000_application_queue.sql`
  - `lib/supabase/database.types.ts`
  - `lib/env.ts`
  - `.env.local.example`
  - `lib/portal.ts`
  - `lib/application-queue.ts`
  - `app/api/apply/submit/route.ts`
  - `app/api/apply/process-next/route.ts`
  - `app/api/internal/apply-queue/process/route.ts`
  - `app/api/applications/recent/route.ts`
  - `app/dashboard/page.tsx`
  - `app/apply-lab/page.tsx`
  - `components/apply/apply-lab.tsx`
  - `components/dashboard/applications-list.tsx`
  - `components/dashboard/twin-stats.tsx`
  - `docs/master-planning.md`
- Tests run:
  - `npm run test:apply-engine`
  - `python3 -m py_compile $(find apply_engine -name '*.py')`
  - `npm run build`
  - `npx tsc --noEmit`
- Tests passed:
  - 37 Python tests passed
  - Python bytecode compile passed
  - Next production build passed
  - standalone TypeScript check passed
- Known gaps:
  - queue processing still needs an always-on scheduler / cron trigger in deployment
  - no retry policy or dead-letter handling yet
  - no request correlation IDs yet
- Next recommended step:
  - add always-on queue scheduling and operational visibility, then build the messaging and approval loop

### Session Update: 2026-03-28

- Workstream: Phase 5 — Messaging and Approval Loop
- Feature batch: Outbound SMS alerts + inbound YES/NO/STOP webhook
- Status before: messaging provider abstraction scaffolded (getSmsProviderSelection), no actual send or receive
- Status after: full outbound+inbound SMS loop implemented — sendSms dispatches via Plivo or Twilio REST API, inbound webhook parses replies, YES queues an application, STOP opts user out
- Files changed:
  - `lib/messaging/send.ts` — sendSms() with Plivo and Twilio HTTP calls, Basic auth, returns messageId
  - `lib/messaging/reply.ts` — normalizeReplyText() (confirm/skip/stop/unknown), extractPhoneNumber() (E.164 normalization)
  - `lib/alerts.ts` — createAlert, sendAlertSms, confirmAlert, skipAlert, expireAlertsForUser, findLatestPendingAlert, findProfileByPhone
  - `app/api/messaging/send-alert/route.ts` — internal route (bearer auth) to send outbound alert SMS for alert_id
  - `app/api/messaging/reply/route.ts` — Plivo/Twilio inbound webhook; YES → confirmAlert + queueApplication; NO → skipAlert; STOP → sms_opt_in=false + expireAlerts; Twilio returns TwiML, Plivo returns empty 200
- Tests run: `npx tsc --noEmit`, `npm run build`
- Tests passed: zero TypeScript errors, Next production build passed (20 routes)
- Known gaps:
  - no alert expiry cron — expires_at is set but nothing enforces it yet
  - no job matching engine to create alerts automatically — alerts must be created manually for now
  - Plivo webhook signature verification not yet implemented (trust IP allowlist in production)
  - no START/re-subscribe handling after STOP
- Next recommended step:
  - add always-on queue scheduler / cron trigger, then Phase 7 Workday agent

### Session Update: 2026-03-29 (Phase 7 + Phase 9)

- Workstream: Phase 7 (Portal Expansion) + Phase 9 (Safety, Observability, Operations)
- Feature batch: Workday agent + always-on queue cron scheduler + alert expiry cron
- Status before: Workday detected by URL but routed to VisionAgent (no real execution); queue required manual trigger or Railway cron call; alert expiry not enforced
- Status after: Workday has a deterministic multi-step agent using data-automation-id selectors; queue drains automatically every minute via Vercel Cron; alerts expire automatically every hour
- Files changed:
  - `apply_engine/portal_specs.py` — WORKDAY_SELECTORS (data-automation-id based: first_name, last_name, email, phone, resume_upload, work_authorization, sponsorship_yes/no, next, submit) + WORKDAY_CUSTOM_SELECTORS (school, degree, graduation_date, gpa, onsite_preference, heard_about_us)
  - `apply_engine/agents/workday.py` — WorkdayAgent: build_actions() fills step-1 fields, execute() multi-step loop advancing via bottom-navigation-next-btn, detects confirmation/auth-wall per step, captures screenshots at each navigation step
  - `apply_engine/registry.py` — WorkdayAgent registered alongside Greenhouse/Lever/Vision
  - `apply_engine/tests/fixtures/workday_form.html` — Workday-style HTML fixture with data-automation-id attributes
  - `apply_engine/tests/test_agents.py` — 5 new Workday tests (build_actions, dry_run, applied_on_confirmation, requires_auth_on_login_wall, sponsorship_yes_when_required)
  - `app/api/internal/cron/process-queue/route.ts` — drains up to 5 queued applications per cron tick (maxDuration=300s, bearer auth)
  - `app/api/internal/cron/expire-alerts/route.ts` — expires pending alerts past expires_at
  - `vercel.json` — Vercel Cron config: process-queue every minute, expire-alerts every hour
- Tests run: `npm run test:apply-engine`, `python3 -m py_compile`, `npx tsc --noEmit`, `npm run build`
- Tests passed: 42 Python tests passed, zero TypeScript errors, 22 Next.js routes
- Known gaps:
  - Workday forms often lazy-load fields — wait_for_load_state not yet used between steps (only wait_for_timeout)
  - Workday Education section (step 2) requires clicking an "Add" button before fields appear — not yet handled
  - No Handshake agent yet
  - No replay tooling for failed runs
  - CRON_SECRET not separately managed — uses APPLY_QUEUE_WORKER_SECRET for both cron and manual triggers
- Next recommended step:
  - Workday Education section step handling, then Handshake strategy decision, then job matching engine (Phase 4)

## Launch Gates

Twin should not be treated as a launchable MVP until all of these are true:

- onboarding/profile persistence is reliable
- dashboard claims are fully backed by real data
- jobs can be ingested and matched
- alerts can be sent and replied to
- Greenhouse and Lever can execute real happy-path applications
- every run is auditable
- failure handling is explicit
- operator visibility exists

## Immediate Notes for Future Research Integration

When `twinmegaresearch.md` is populated, the first things to update here should be:

1. top 20 recurring normalized question families
2. portal-specific phrasing variants
3. selector clues worth encoding first
4. hard stop conditions for ambiguous questions
5. fallback trigger rules for vision
