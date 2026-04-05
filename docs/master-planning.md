# Twin Master Planning Document

Last updated: 2026-03-30

This document is the source of truth for building `Twin` into a fully functional product.

It is intentionally practical. It should reflect:

- what is already implemented in this repo
- what is still mocked, partial, or missing
- what the next execution order should be
- how planning is updated when development shifts between Codex and Claude

If this document and the code disagree, the code wins first, then this document must be updated immediately.

## Planning Rules

1. `docs/master-planning.md` leyts r the primary planning document.
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
- Apply engine service scaffold in Python with FastAPI endpoints
- Portal detector for Greenhouse, Lever, Workday, Handshake, and fallback vision classification
- Greenhouse and Lever planning/execution flow with:
  - contact field support
  - resume upload support
  - start date, location preference, and salary expectation
  - work authorization and sponsorship
  - normalized custom answer mappings for education/relocation/source
  - multi-step next/review/submit flow
  - auth wall detection
  - validation error detection
  - confirmation text and confirmation URL detection
- Fixture-backed tests for selectors and browser behavior
- Internal `/apply-lab` page for planning and dry submit inspection
- Daily follow-up reporting for unresolved required application questions
- Internal daily follow-up SMS send path for opted-in users

### Still Not Fully Real

- No production job ingestion pipeline yet
- No real matching engine yet
- Live messaging code exists, but trusted production SMS approval is not complete until signature verification, rate limiting, and spend controls are enforced
- Inbound follow-up answers now parse from SMS and persist onto the profile, but still need repeated live validation against real blocked applications
- Queue-drain endpoints now exist and a Railway worker entrypoint can poll them, but the hosted worker path still needs repeated live validation against real queued applications
- No Workday or Handshake real agent yet
- No real Claude vision fallback execution yet
- No screenshot persistence or replay tooling yet
- No billing, plan caps, or Stripe
- Dashboard still overstates some platform readiness relative to backend reality
- Job ingestion, dedupe, and website hydration are not yet unified behind one canonical job-normalization contract
- Browse filtering now normalizes/falls back job industries at read time, but the live jobs table still needs a one-time repair for previously overwritten or mis-tagged rows
- Profile targeting is still too coarse to express `Spring 2027 Internship` vs `Summer 2027 Internship` vs `New Grad 2027` vs `Associate`
- A concrete taxonomy-based normalization spec now exists in `docs/job-matching-standardization-plan.md`, but the schema, resolvers, and profile/job persistence model are not implemented yet
- Onboarding/profile flows now write taxonomy-oriented profile JSON payloads for match preferences and application facts, but job-side taxonomy resolution and DB rollout are still pending
- Job ingest and matching code now have a first deterministic taxonomy layer in code, but the Supabase project still needs the new taxonomy migrations applied before those writes are production-real

### Immediate Production Priorities

- Harden `/api/jobs/ingest` so external scraper runs do not fail at the Next.js edge
- Keep scraper ingest config compatible with both app env names and standalone env names
- Finish auth/account durability after onboarding
- Replace remaining dashboard placeholders with DB-backed truth
- Align all queue-entry paths behind one readiness/idempotency contract
- Add rate limiting, inbound-message verification, and provider spend controls before broadening SMS-driven apply flows
- Reconcile canonical job hydration across API ingest, direct Supabase ingest, and website browse surfaces
- Preserve existing job identity fields when canonical URL collisions occur during ingest; do not let later payloads silently rewrite older rows
- Expand qualification tagging so matching can target term/year/family without brute-force scans

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

Twin should also understand real early-career recruiting distinctions:

- seasonal internships such as `Spring 2027`, `Summer 2027`, `Fall 2027`
- co-op terms
- `New Grad / Fresh Grad`
- `Associate` early-career roles

## Product Principles

- Deterministic first: hardcode known ATS flows before using AI.
- Cheap by default: use AI only when the DOM is too custom or unstable.
- Honest product: do not claim monitoring, applying, or messaging unless it is real.
- Full auditability: every apply attempt needs inputs, actions, outputs, and failure clues.
- Safety before autonomy: hard stops must exist for auth walls, validation blockers, and ambiguous questions.
- Replace guesswork with normalized fields: profile data and screening questions need stable internal keys.
- Tag once, match many: jobs should be normalized and tagged at ingest time so later matching does not recompute basic classification for every user.
- Route before scoring: use cheap coarse filtering to shrink the candidate set before expensive scoring, provider sends, or apply work.

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
- future routing helpers:
  - normalized qualification selectors
  - candidate-selection SQL functions or routing tables
  - job reconciliation outputs

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
4. Qualification targeting and routing
5. Matching and alerting
6. Messaging and approvals
6. Apply engine MVP
7. Portal expansion
8. Answer system and document assets
9. Safety, observability, and operations
10. Billing and packaging

## Qualification Targeting Model

The current `levels` model is too coarse for the recruiting flows Twin is trying to support.

### Normalized job/profile targeting fields

Twin should normalize both jobs and user intent into:

- `role_family`
  - `internship`
  - `co_op`
  - `new_grad`
  - `associate`
  - `part_time`
- `target_term`
  - `spring`
  - `summer`
  - `fall`
  - `winter`
  - `any`
- `target_year`
  - recruiting year such as `2027`
- `experience_band`
  - `student`
  - `new_grad`
  - `early_career`

### Taxonomy direction

The current flat targeting fields are now superseded directionally by a generic taxonomy system with shared node infrastructure and dimension-specific trees.

The implementation target is:

- one generic `taxonomy_nodes` system with alias matching and ancestry-aware traversal
- separate dimensions for:
  - `geo`
  - `work_modality`
  - `industry`
  - `job_function`
  - `career_role`
  - `education_degree`
  - `education_field`
  - `work_authorization`
  - `employment_type`
- multi-node job mappings per dimension where postings are genuinely broad or ambiguous
- two internal profile layers:
  - `profile_match_preferences`
  - `profile_application_facts`
- one seamless user-facing profile flow that populates both layers without exposing the distinction
- a first-class `possible_match` state for branch-only or lower-confidence overlap
- a full implementation plan covering schema, resolvers, company priors, browse migration, and apply-facts migration now lives in `docs/job-matching-standardization-plan.md`

See `docs/job-matching-standardization-plan.md` for the implementation-ready attribute spec, user-facing terms, and internal variable names.

### Profile truth to capture

Profiles should evolve to store:

- compatibility field: `levels`
- richer targeting fields:
  - `target_role_families`
  - `target_terms`
  - `target_years`
  - `graduation_year`
  - `graduation_term`
  - `earliest_start_date`
  - `weekly_availability_hours`

### Job truth to capture at ingest time

Jobs should be tagged immediately with:

- `industries`
- `role_family`
- `target_term`
- `target_year`
- `experience_band`
- `portal_support_tier`
- canonical source and application URLs

These tags should not be deferred to browse-time scoring.

## Matching Architecture Direction

The current brute-force scan pattern is not acceptable for scale, latency, or message spend.

### Required target architecture

Matching should happen in two stages:

1. `candidate selection`
   - cheap filtering by:
     - industry
     - role family
     - target term
     - target year
     - remote/location coarse filters
2. `candidate scoring`
   - run `matchJobToProfile` only on the reduced candidate set

### Recommended implementation shape

- maintain normalized selectors on both jobs and profiles
- add a SQL function such as `public.select_candidate_profiles_for_job(...)`
- optionally add a routing table/materialized selector layer keyed by:
  - `industry`
  - `role_family`
  - `target_term`
  - `target_year`
- make both instant alerts and digest ranking use the same candidate-selection layer

### Rules

- no full-profile scans in normal ingest flow
- no separate matching architecture for digest versus alerting
- no provider send path should run before candidate reduction and confidence gating

## Job Hydration Truth

Twin currently has multiple job-ingest paths and they must converge on one canonical contract.

### Known risk

- API ingest and direct Supabase ingest do not currently share one exact canonicalization implementation
- this can create duplicate or divergent rows based on URL shape, timestamps, or metadata shape
- the website then reflects whichever row happens to be canonical/current

### Required fix direction

- one shared canonical URL implementation for all ingest paths
- one canonical job identity contract:
  - source URL
  - application URL
  - provider/source
  - external key if available
- a reconciliation path for old rows:
  - duplicates
  - stale active rows
  - missing normalized tags
  - inconsistent `posted_at`

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
- add sign-out behavior
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

- add realtime alert feed instead of fetch-only hydration
- finish account durability flow for anonymous users after onboarding
- expose clearer worker/provider status once scheduled processing is live

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

- `/api/jobs/ingest` still needs a real end-to-end curl verification against a running app
- source lists are noisy and need a vetted enabled subset for reliable daily runs
- live listing scrapers exist only in partial form; source quality is still the bigger issue than raw ingestion

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
- Greenhouse/Lever selector maps
- normalized profile fields
- custom-answer mapping path
- auth/validation/review/confirmation handling
- internal lab
- apply run persistence

Still needed before `implemented`:

- real screenshots attached to failures and optionally success
- request/response correlation IDs
- job-backed application records tied to `applications`
- stronger real-world fixture coverage from live portals
- safer stop conditions on ambiguous/custom questions
- better replay tooling for failed runs

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

Status: `scaffolded`

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
- future deterministic resume-variant pipeline built from a reusable experience vault
- future opt-in graduation-year-flex targeting for students whose recruiting window legitimately spans adjacent years

Open items:

- no real cover-letter/document generation pipeline yet
- current answer system is field-level, not prompt-level
- no per-job tailored resume artifact is generated today; current apply execution still uploads the single stored PDF
- no policy layer exists yet for opt-in graduation-year-flex resume variants

Exit criteria:

- common prompt families can be answered from normalized fields
- resume artifacts are verified before apply

Required tests:

- locked data boundary tests
- PDF existence checks
- answer provenance tests

### Phase 9: Safety, Observability, and Operations

Status: `scaffolded`

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
- inbound provider verification
- queue idempotency
- provider spend telemetry
- expensive-route throttling

Exit criteria:

- failures can be replayed or diagnosed from stored evidence
- retry policy does not create duplicate applications

Required tests:

- timeout and retry tests
- duplicate suppression tests
- failure persistence tests
- provider outage behavior
- webhook signature verification tests
- rate-limit coverage for queue/plan/submit/message routes
- provider dedupe and spend-metadata tests

## 2026-04-02 Product Gap Closure Direction

This section is now the cross-cutting source of truth for closing the current product-design gaps.

### Gaps being actively closed

1. public product claims exceed backend truth
2. queue entry is inconsistent across UI and messaging paths
3. operator evidence is too shallow for fast triage
4. portal support breadth is presented too broadly
5. active docs drift from actual operating truth
6. job hydration can drift between DB truth and website browse truth
7. qualification targeting is too coarse for real early-career recruiting windows
8. matching does broad scans instead of candidate routing first

### Non-negotiable execution rules for this closure work

- no public copy may imply live capability without code, persistence, and an operator/debug path
- Greenhouse and Lever remain the only current live MVP targets
- Workday is operationally useful only as `partial / triaged`
- Ashby, Handshake, and vision fallback are not default MVP queue targets
- Twilio, Plivo, Anthropic, and Yutori are budgeted dependencies and must not be treated as free ambient services

### Required controls before SMS-driven approval can be called live

- verify inbound Twilio signatures
- rate limit inbound reply processing
- dedupe queue creation caused by replies
- shorten templates and prefer digest/in-app delivery where possible
- track provider, segment count, and estimated cost on sends

Current product direction:

- Twilio should be treated as an updates/status channel, not a confirmation channel
- queueing and approval should happen in-product unless a later phase explicitly reintroduces SMS actions with hardened verification and spend controls

### Required controls before expensive apply routes can be called hardened

- per-user or equivalent throttles on `/api/apply/plan`, `/api/apply/submit`, and all queue-entry routes
- idempotent queue creation keyed by user/job/request fingerprint
- portal-support gating that blocks unsupported/low-tier portals before queue creation
- structured rejection reasons returned to UI/operator paths

### Preserved future design: deterministic dynamic resumes

The current system stores:

- one uploaded resume PDF for apply execution
- one structured `resume_json` payload with locked vs flexible bullets

The current system does not yet generate per-job resume variants.

The next-stage design should be:

1. create an `experience vault` from the structured resume:
   - canonical experience records
   - reusable bullets
   - skills
   - tags for industry, role family, seniority, and recruiting window relevance
2. generate resume variants deterministically:
   - keep locked bullets fixed
   - choose flexible bullets by rule-based scoring against the matched job
   - render locally from a fixed template before apply
3. add an explicit user-controlled graduation-year-flex setting:
   - ask during onboarding/profile whether Twin may target adjacent graduation years
   - default to off
   - use only when the user has stated their graduation timing is flexible
   - never change locked degree dates, employment dates, or other fixed facts
   - if enabled, allow the application-specific resume variant to adjust only the user-approved graduation-year presentation needed for that recruiting window
   - persist provenance for the primary year, flexed year/window, and whether a flexed resume artifact was used
4. keep provider spend low:
   - parse and structure once
   - assemble variants with SQL plus local scoring
   - use Anthropic only for narrow fallback rewrite cases, not routine per-job resume generation

### Preserved future design: normalized matching for incomplete profiles

Matching should be normalized around what the user has actually filled out.

Required behavior:

1. missing optional profile fields must not behave like hard mismatches
2. only explicit user preferences should create rejection rules
3. scoring should use available signals only:
   - industries
   - role family
   - recruiting window
   - location
   - remote preference
4. preference modes should exist for at least:
   - location: `strict`, `prefer`, `ignore`
   - recruiting window / target year: `strict`, `prefer`, `ignore`
5. partially completed but usable profiles should still get ranked matches instead of appearing artificially unmatched

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

1. Tie seeded jobs to real `jobs` rows and real `applications` records.
2. Replace dashboard placeholder application list with DB-backed records.
3. Implement sign-out/session reset.
4. Add screenshot capture to apply runs.
5. Add recurring screening families:
   - onsite preference
   - weekly availability / minimum hours
   - graduation window
   - relocation / commute
6. Add queue-backed apply execution.
7. Implement outbound/inbound messaging loop.
8. Add Workday agent.

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

### Session Update: 2026-03-30

- Workstream: Apply engine MVP
- Feature batch: Portal-aware readiness and app/worker portal contract alignment
- Status before: Generic readiness existed, but it did not distinguish queueable vs risky by ATS, and the app-side portal contract did not include Ashby even though the Python engine did.
- Status after: Plan/submit preflight is now portal-aware, the lab and dashboard expose likely blockers for Greenhouse/Lever/Workday-style runs, and the app-side portal contract now includes Ashby.
- Files changed:
  - `lib/platform/apply-readiness.ts`
  - `lib/portal.ts`
  - `lib/apply-engine.ts`
  - `app/api/apply/plan/route.ts`
  - `app/api/apply/submit/route.ts`
  - `components/apply/apply-lab.tsx`
  - `app/dashboard/page.tsx`
- Tests run:
  - `npm run test:apply-engine`
  - `python3 -m py_compile $(find apply_engine -name '*.py')`
  - `npm run build`
- Tests passed:
  - apply engine suite: 65 passing tests
  - Python compile check passed
  - Next production build passed
- Known gaps:
  - portal-aware readiness is heuristic; it is not yet learned from aggregate run history
  - dashboard still shows only Greenhouse/Lever/Workday risk cards, not Ashby/Handshake
  - no dedicated TS unit tests exist yet for the readiness helper
- Next recommended step: Use recent run history to rank likely blockers per portal, then feed that back into selector/retry hardening instead of using one static bucket map for every account.

### Session Update: 2026-03-30

- Workstream: Apply engine MVP
- Feature batch: History-weighted portal readiness
- Status before: Portal-aware readiness existed, but it relied only on static ATS heuristics.
- Status after: Plan/submit readiness now incorporates recent apply-run history for the current user, and the dashboard/lab surface when recent failures reinforce likely blocker families for a portal.
- Files changed:
  - `lib/platform/apply-readiness.ts`
  - `lib/apply-runs.ts`
  - `app/api/apply/plan/route.ts`
  - `app/api/apply/submit/route.ts`
  - `components/apply/apply-lab.tsx`
  - `app/dashboard/page.tsx`
- Tests run:
  - `npm run test:apply-engine`
  - `npm run build`
- Tests passed:
  - apply engine suite: 65 passing tests
  - Next production build passed
- Known gaps:
  - history weighting is still per-user and recent-run based, not globally aggregated
  - blocked family history is bucket-level, not selector-level
  - readiness helper still has no dedicated TS unit tests
- Next recommended step: Use the repeated historical blocker families to prioritize selector/retry hardening per portal, starting with the highest recurring family in Greenhouse, Lever, and Workday run history.

### Session Update: 2026-03-30

- Workstream: Apply engine MVP
- Feature batch: Runtime recovery hints for ambiguous portal validation failures
- Status before: Recent run history influenced preflight, but the apply engine still failed on generic “this field is required” style validation blocks because they classified as `custom`.
- Status after: The app now sends runtime hints with likely and historical blocked families, and Greenhouse, Lever, and Workday can use those hints to choose a targeted recovery family when the raw error text is ambiguous.
- Files changed:
  - `apply_engine/models.py`
  - `apply_engine/schemas.py`
  - `apply_engine/main.py`
  - `apply_engine/agents/common.py`
  - `apply_engine/agents/greenhouse.py`
  - `apply_engine/agents/lever.py`
  - `apply_engine/agents/workday.py`
  - `apply_engine/tests/test_common.py`
  - `apply_engine/tests/test_schemas.py`
  - `lib/apply-engine.ts`
  - `app/api/apply/plan/route.ts`
  - `app/api/apply/submit/route.ts`
  - `app/api/messaging/reply/route.ts`
- Tests run:
  - `npm run test:apply-engine`
  - `npm run build`
- Tests passed:
  - apply engine suite: 67 passing tests
  - Next production build passed
- Known gaps:
  - runtime hints are still bucket-level, not selector-level
  - only current-user recent history is used; there is no cross-user portal learning yet
  - no explicit UI surface yet for showing which runtime hint was used during recovery
- Next recommended step: Add run-summary metadata for which recovery family was actually chosen, then use that to harden the top ambiguous-failure paths per portal.

### Session Update: 2026-03-30

- Workstream: Apply engine MVP
- Feature batch: Recovery-family observability
- Status before: Twin could use runtime hints to choose a targeted recovery family, but the chosen recovery path was not surfaced in result payloads or run summaries.
- Status after: Apply results and persisted run summaries now record whether recovery was attempted and which family was used, and the lab/dashboard show that metadata directly.
- Files changed:
  - `apply_engine/models.py`
  - `apply_engine/schemas.py`
  - `apply_engine/serialize.py`
  - `apply_engine/agents/greenhouse.py`
  - `apply_engine/agents/lever.py`
  - `apply_engine/agents/workday.py`
  - `lib/apply-engine.ts`
  - `lib/apply-runs.ts`
  - `lib/application-queue.ts`
  - `components/apply/apply-lab.tsx`
  - `components/dashboard/apply-runs-list.tsx`
- Tests run:
  - `npm run test:apply-engine`
  - `npm run build`
- Tests passed:
  - apply engine suite: 67 passing tests
  - Next production build passed
- Known gaps:
  - recovery metadata is family-level, not selector-level
  - the dashboard does not yet aggregate “successful recovery vs failed recovery” by portal/family
  - no cross-user learning exists for ambiguous validation paths
- Next recommended step: Aggregate recovery-family outcomes by portal and use them to prioritize the next selector/retry hardening pass, starting with the most frequent failed recovery families in Greenhouse, Lever, and Workday.

### Session Update: 2026-03-30

- Workstream: Apply engine MVP
- Feature batch: Recovery outcome aggregation
- Status before: Individual runs exposed recovery metadata, but the dashboard did not aggregate whether recovery attempts were actually helping by portal/family.
- Status after: The dashboard now shows recovery patterns by portal/family, including how many retries ended in applied, failed, or auth-blocked outcomes.
- Files changed:
  - `components/dashboard/recovery-summary.tsx`
  - `app/dashboard/page.tsx`
- Tests run:
  - `npm run test:apply-engine`
  - `npm run build`
- Tests passed:
  - apply engine suite: 67 passing tests
  - Next production build passed
- Known gaps:
  - recovery aggregation is still dashboard-only and not fed back automatically into selector strategy
  - no per-selector or per-question recovery outcome tracking exists yet
  - no dedicated component tests exist for the new dashboard recovery summary
- Next recommended step: Use the top failed recovery patterns to tighten portal-specific selectors and retry logic, starting with the highest-frequency failed family in Greenhouse, Lever, and Workday.

### Session Update: 2026-03-30

- Workstream: Apply engine MVP
- Feature batch: Semantic option matching hardening for availability and EEO flows
- Status before: Selector coverage was decent, but dropdown/radio recovery still depended too heavily on near-exact option labels, which is brittle for availability and EEO questions.
- Status after: Semantic option matching now handles common wording variants for onsite/hybrid, weekly hours, veteran status, and disability status more reliably.
- Files changed:
  - `apply_engine/agents/common.py`
  - `apply_engine/tests/test_common.py`
- Tests run:
  - `npm run test:apply-engine`
  - `npm run build`
- Tests passed:
  - apply engine suite: 68 passing tests
  - Next production build passed
- Known gaps:
  - option matching is still heuristic and not per-portal tuned
  - no live portal outcome data is yet being fed back to refine specific selector variants
  - education-family option normalization is still weaker than availability/EEO normalization
- Next recommended step: Apply the same semantic hardening to education-family dropdowns and then tighten the highest-frequency failed recovery family per portal using live run outcomes.

### Session Update: 2026-03-30

- Workstream: Apply engine MVP
- Feature batch: Education-family semantic option matching
- Status before: Education answers like degree, graduation year, and major were still more brittle than availability/EEO flows when portals used inconsistent dropdown wording.
- Status after: Option matching now handles common education variants such as `BS Computer Science`, `Bachelor's Degree`, and `Class of 2027` more reliably.
- Files changed:
  - `apply_engine/agents/common.py`
  - `apply_engine/tests/test_common.py`
- Tests run:
  - `npm run test:apply-engine`
  - `npm run build`
- Tests passed:
  - apply engine suite: 69 passing tests
  - Next production build passed
- Known gaps:
  - semantic option matching is still global, not portal-tuned
  - no selector-level recovery analytics yet exist
  - real live-run data still needs to shape which portal families get hardened next
- Next recommended step: Use recovery outcome aggregation to target the highest-frequency failed recovery family per portal, then add portal-specific option-label aliases where the generic semantic matcher still falls short.

### Session Update: 2026-04-02

- Workstream: Job intake and normalization
- Feature batch: Canonical job routing and richer qualification targeting
- Status before: job ingestion, website hydration, and matching used inconsistent normalization; profile targeting was too coarse; ingest/digest matching still relied on broad scans.
- Status after: the repo now has schema and code support for canonical job identity, richer qualification targeting fields, immediate job routing tags at ingest, and SQL candidate-selection helpers that replace the old broad-scan architecture.
- Follow-up hardening in the same execution slice added DB-backed request controls, queue request fingerprints, and rate limiting on the expensive/apply/message entry points.
- Files changed:
  - `supabase/migrations/20260402120000_job_routing_and_targeting.sql`
  - `lib/job-normalization.ts`
  - `lib/candidate-routing.ts`
  - `lib/job-ingest.ts`
  - `lib/jobs.ts`
  - `lib/matching.ts`
  - `lib/platform/profile.ts`
  - `lib/platform/applicant.ts`
  - `lib/types.ts`
  - `lib/utils.ts`
  - `lib/supabase/database.types.ts`
  - `app/api/jobs/ingest/route.ts`
  - `app/api/jobs/browse/route.ts`
  - `app/api/internal/cron/send-prospective-lists/route.ts`
  - `app/onboarding/page.tsx`
  - `components/onboarding/step-preferences.tsx`
  - `scraper/ingest_jobs.py`
  - `scraper/sources/common.py`
  - `scripts/reconcile-jobs.mjs`
  - `supabase/migrations/20260402133000_request_controls.sql`
  - `lib/request-controls.ts`
  - `app/api/apply/plan/route.ts`
  - `app/api/apply/submit/route.ts`
  - `app/api/jobs/[jobId]/queue/route.ts`
  - `app/api/messaging/reply/route.ts`
  - `app/api/messaging/send-alert/route.ts`
  - `app/api/internal/cron/send-prospective-lists/route.ts`
  - `app/api/internal/cron/finalize-prospective-lists/route.ts`
  - `app/api/internal/cron/send-prospective-results/route.ts`
  - `lib/application-queue.ts`
  - `lib/alerts.ts`
  - `package.json`
  - `README.md`
  - `PLANS.md`
- Tests run:
  - `python3 -m py_compile $(find apply_engine -name '*.py') scraper/ingest_jobs.py scraper/sources/common.py`
  - `npm run build`
- Tests passed:
  - Python syntax compilation passed
  - Next production build passed
- Tests not run:
  - `npm run test:apply-engine`
  - reason: `./.venv/bin/python` is missing in this workspace
- Known gaps:
  - the new Supabase migration must be applied before the candidate-routing SQL helpers and new fields exist in the database
  - the request-controls migration must be applied before DB-backed throttles and queue idempotency exist in the database
  - old job rows may still need reconciliation/backfill before website hydration fully matches canonical job truth
  - onboarding now captures richer qualification targeting, but the rest of the product still needs UI surfacing for those new selectors outside onboarding
- Next recommended step: Apply both new migrations, run `npm run reconcile:jobs`, fix any canonical drift or missing tag groups, validate one real ingest flow plus one real digest flow against the new SQL candidate selectors, and then verify that the protected routes return expected 429/cooldown behavior under repeated identical requests.

### Session Update: 2026-04-02

- Workstream: Queue review and messaging truth
- Feature batch: Split-screen queue verification and updates-only SMS
- Status before: queued applications were visible only as flat rows, there was no in-dashboard verification pane for a selected queued application, and SMS behavior still implied confirmation/approval flows.
- Status after: the dashboard now supports a split-screen queue review flow for recent applications, selected queued applications can be submitted directly through a targeted `Trust Apply` action, and Twilio copy plus the main inbound SMS route now treat SMS as updates-only rather than a confirmation surface.
- Files changed:
  - `app/api/applications/recent/route.ts`
  - `app/api/applications/[applicationId]/trust-apply/route.ts`
  - `components/dashboard/applications-list.tsx`
  - `lib/application-queue.ts`
  - `lib/alerts.ts`
  - `lib/messaging/reply.ts`
  - `lib/prospective-lists.ts`
  - `app/api/messaging/reply/route.ts`
  - `app/dashboard/page.tsx`
  - `app/layout.tsx`
  - `PLANS.md`
- Tests run:
  - `npm run build`
- Tests passed:
  - Next production build passed
- Tests not run:
  - `npm run test:apply-engine`
  - reason: `./.venv/bin/python` is missing in this workspace
- Known gaps:
  - the prospective-list cron subsystem still exists and may need additional simplification so it no longer implies SMS-driven approval semantics anywhere
  - the new split-screen verification pane currently uses the stored application payload plus readiness summaries, but it does not yet render a richer prompt-by-prompt verification surface
  - matching strictness is still too rigid for location and recruiting window defaults
- Next recommended step: soften location/target-year matching into preference modes, add `graduation_year_flex`, and then simplify the remaining prospective-list queue semantics so all approval paths stay consistent with the updates-only SMS direction.

### Session Update: 2026-04-05

- Workstream: Deterministic taxonomy normalization
- Feature batch: unknown-company inference path and operator backfill tooling
- Status before: taxonomy writes existed in app code, but the operational path for new `company_slug` values and post-migration backfill/review was still implicit.
- Status after: the job taxonomy resolver now records whether `industry` came from company prior, phrase evidence, legacy fallback, or branch fallback; unknown-company and broad fallback cases are marked for review; and the repo now includes dedicated taxonomy backfill and taxonomy review scripts.
- Files changed:
  - `lib/taxonomy/job.ts`
  - `scripts/backfill-taxonomy.mjs`
  - `scripts/report-taxonomy-review.mjs`
  - `package.json`
  - `docs/job-matching-standardization-plan.md`
  - `PLANS.md`
- Tests run:
  - `python3 -m py_compile $(find apply_engine -name '*.py') $(find scraper -name '*.py')`
  - `npm run build`
- Tests passed:
  - Python syntax compilation passed
  - Next production build passed
- Tests not run:
  - `npm run test:apply-engine`
  - reason: `./.venv/bin/python` is missing in this workspace
- Known gaps:
  - the corrected taxonomy seed still needs to be fully applied in Supabase before node-ID backfill can run cleanly against the live database
  - browse and matching still use taxonomy summaries plus legacy fallbacks; node-array-first filtering is not the sole source of truth yet
  - company priors are still seeded/curated manually rather than learned through an admin UI workflow
- Next recommended step: complete the corrected seed rollout, run the taxonomy review report to identify unknown or fallback-heavy companies, backfill jobs/profiles, and then shift browse filtering toward the normalized taxonomy UUID arrays.

### Session Update: 2026-04-05

- Workstream: Geo taxonomy completion and multi-location apply support
- Feature batch: full US-state baseline, Canadian provinces, and job-specific location choice payloads
- Status before: geo taxonomy only had partial state coverage, Canada effectively only had Ontario, and queued apply requests only carried a single profile-level `location_preference`.
- Status after: the taxonomy seed set now covers all US states plus Canadian provinces/territories, city labels are normalized for display, multi-location job strings are parsed into explicit option sets during ingest, and queued apply requests now carry ranked job-specific location choices into the Python engine.
- Files changed:
  - `lib/platform/applicant.ts`
  - `app/api/jobs/[jobId]/queue/route.ts`
  - `app/api/internal/cron/finalize-prospective-lists/route.ts`
  - `lib/apply-engine.ts`
  - `apply_engine/models.py`
  - `apply_engine/schemas.py`
  - `apply_engine/agents/common.py`
  - `lib/taxonomy/job.ts`
  - `lib/taxonomy/profile.ts`
  - `scraper/ingest_jobs.py`
  - `scripts/backfill-taxonomy.mjs`
  - `supabase/migrations/20260405153000_taxonomy_seed_mvp.sql`
  - `supabase/migrations/20260405153500_taxonomy_seed_fix.sql`
  - `supabase/migrations/20260405170000_taxonomy_geo_label_cleanup.sql`
  - `supabase/migrations/20260405171000_taxonomy_geo_all_states.sql`
  - `supabase/migrations/20260405172000_taxonomy_geo_canada_provinces.sql`
  - `PLANS.md`
- Tests run:
  - `node --check scripts/backfill-taxonomy.mjs`
  - `python3 -m py_compile $(find apply_engine -name '*.py') $(find scraper -name '*.py')`
  - `npm run build`
- Tests passed:
  - Node syntax check passed
  - Python syntax compilation passed
  - Next production build passed
- Tests not run:
  - `npm run test:apply-engine`
  - reason: `./.venv/bin/python` is missing in this workspace
- Known gaps:
  - the new corrective geo migrations still need to be run in Supabase for the live DB to match repo truth
  - the apply engine now has ranked location data available, but there is not yet an admin/operator surface for reviewing the chosen location against a specific application question
  - browse filtering still needs a follow-up pass to expose parent/child geo filters more directly
- Next recommended step: apply the new geo migrations, verify counts/labels in Supabase, run taxonomy backfill dry-runs, then backfill live rows so multi-location jobs and full state/province nodes are present in production data.
