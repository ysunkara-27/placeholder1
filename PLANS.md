# Twin MVP Plan

Last updated: 2026-04-05

This file is the active execution plan for getting `Twin` from its current partial state to a working MVP.

It is intentionally narrower than `docs/master-planning.md`. Use this file for the next concrete steps. Use the master planning doc for broader product truth.

## Current Verified State

Verified in this repo:

- onboarding + profile persistence exist
- dashboard exists and uses DB-backed apply run/application data
- apply lab exists and can plan, queue, and process applications
- apply engine exists with Greenhouse, Lever, and Workday agents
- queue processing endpoints exist
- local queue runner now exists: `npm run process:queue:local`
- direct local queue runner now exists: `npm run process:queue:direct`
- apply lab no longer depends on a bundled vetted seed set; it now reflects jobs sent from Browse Jobs
- tests passing:
  - `npm run test:apply-engine`
  - `python3 -m py_compile $(find apply_engine -name '*.py')`
  - `npm run build`

## Session Handoff — 2026-04-05

Finished:

- admin review `Term` editing now stays dropdown-only by default and only opens freeform input after explicitly selecting `Other`
- fixed the interrupted admin-page term editor bug where selecting `Other` cleared the value without exposing the custom input
- `Clean with AI` now auto-fills the job description summary into the draft on the first run when the field is empty
- admin normalize route now has a deterministic JD-summary fallback from fetched page content when Gemini omits or fails to return `jd_summary`

Still blocked:

- live description extraction quality still depends on how much real HTML is available to server-side fetches for JS-heavy ATS pages
- Greenhouse/Lever should be materially better than before, but Workday/iCIMS-style client-rendered pages will still need real-world validation

Exact next step:

- run live admin review against a small set of pending jobs across Greenhouse, Lever, and one JS-heavy portal and verify first-pass `Clean with AI` behavior for `target_term` and `jd_summary`

Exact verification run:

- `npm run test:apply-engine`
- `python3 -m py_compile $(find apply_engine -name '*.py')`
- `npm run build`

## Current Bottlenecks

The biggest remaining blockers to MVP are:

1. real live-run success rate on supported portals is still not high enough
2. confirm-to-queue-to-process loop is only partially productized
3. Greenhouse is still the main automation bottleneck, but the failure is now narrow: education-field validation has been largely cleared and the remaining repeated live blocker is the ITAR eligibility question on the vetted Rendezvous Robotics run
4. Lever is operationally acceptable for MVP when captcha/manual verification is surfaced as `requires_auth`, but WeRide-style `cards[...]` custom fields still need more live validation
5. Workday is still less reliable than Greenhouse and Lever
6. queue processing is operational locally, but repeated live validation inside this sandbox is now partially blocked by outbound DNS failures to hosted Supabase
6. run telemetry is good, but we still need to turn real failures into targeted fixes quickly
7. unresolved required questions now need to be surfaced to the user before confirmation, not just stored in run data
8. follow-up answers now round-trip through SMS and profile storage, but they still need repeated live validation against real blocked applications

## Product Gap Closure Plan — 2026-04-02

This is the active plan for closing the five repo-level product gaps identified in the latest recursive review:

1. product/marketing claims run ahead of backend truth
2. queue entry points are inconsistent and one path bypasses readiness gating
3. run failure evidence is summarized but not inspectable enough for operator triage
4. portal support breadth is overstated relative to what is operationally real
5. README / planning / setup truth is drifting

Additional architecture issues confirmed after deeper code review:

6. jobs in Supabase can drift from what the website surfaces because the ingest, dedupe, and browse paths do not share one canonical normalization contract
7. profile targeting is too coarse to capture recruiting windows like `Spring 2027 Internship`, `Summer 2027 Internship`, `New Grad 2027`, or `Associate`
8. matching still does broad scans in the ingest/digest paths instead of reducing candidate sets through indexed routing first

### Guardrails for all work in this plan

- prefer deterministic portal logic over AI fallback
- do not add new provider spend unless it lowers total operator cost
- rate limit every externally-triggerable route that can create queue work, provider sends, or expensive engine calls
- Twilio and Plivo should be treated as scarce channels, not default notification sinks
- Anthropic should stay vision-fallback-only and should not be used for routine planning, matching, or reply parsing
- Yutori should remain disabled for MVP until there is a clear cost envelope, route budget, and operator need
- every doc/UI change must move toward stricter truth, not more aspirational scope

### Phase G — Product Truth Alignment

Status: `active`

Objective:

- make public and in-app claims match the live platform exactly

Exact actions:

1. narrow landing-page copy to what is real today:
   - durable onboarding/profile
   - real queueing
   - Greenhouse + Lever as current primary execution targets
   - Workday as triaged/in-progress, not equivalent support
2. remove or downgrade any public references that imply:
   - production-grade matching
   - fully live SMS approval for all users
   - screenshot/PDF persistence if not yet stored durably
   - Handshake/custom fallback as live apply channels
3. make dashboard/apply-lab labels reflect support tiers:
   - `live`
   - `partial`
   - `operator-only`
   - `unsupported`
4. update README and planning docs in the same batch as copy changes
5. keep SMS wording honest:
   - Twilio sends updates and status notifications
   - queueing and application approval happen in-product, not by SMS reply

Exit criteria:

- no user-visible surface claims a capability that the code and persistence do not support today

### Phase H — Unified Queue Gating

Status: `queued`

Objective:

- ensure every path to queue creation passes the same readiness and portal support rules

Exact actions:

1. create one shared queue-entry helper for:
   - `/api/apply/submit`
   - `/api/jobs/[jobId]/queue`
   - SMS confirmation queueing
   - prospective-list finalization queueing
2. block queue creation when any of the following is true:
   - critical profile readiness issues exist
   - unresolved required questions are still open
   - portal support tier is below MVP threshold
   - duplicate/recent queue attempt already exists for the same user/job/request fingerprint
3. persist queue rejection reason in a structured way so UI and SMS can explain the block honestly
4. surface the exact blocker before queueing instead of after failed processing

Exit criteria:

- all queue-creation paths enforce the same preflight contract and produce the same rejection semantics

### Phase H2 — Job Hydration Reconciliation

Status: `active`

Objective:

- make the jobs in the database line up with what the website surfaces

Exact actions:

1. define one shared canonical job identity contract for every ingest path:
   - canonical source URL
   - canonical application URL
   - source/provider
   - external job key when available
2. unify normalization between:
   - `/api/jobs/ingest`
   - direct Python Supabase ingest
   - seed-job materialization paths
3. audit and repair existing drift:
   - duplicate URL groups
   - rows with missing portal/industry/qualification tags
   - stale rows left `active`
   - inconsistent `posted_at` values
4. add a reconciliation report/script for operators:
   - jobs present in DB but not browseable
   - browseable jobs missing required metadata
   - duplicate/collision groups
5. make website browse surfaces read only canonical, active, fully tagged rows

Exit criteria:

- the website, alerts, and operator tools all read from the same canonical job truth

### Phase H3 — Qualification Targeting Architecture

Status: `active`

Objective:

- allow user targeting and job tagging to express the actual recruiting windows Twin needs

Target taxonomy:

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

Required profile-side fields:

1. `target_role_families`
2. `target_terms`
3. `target_years`
4. `graduation_year`
5. `graduation_term`
6. `earliest_start_date`
7. `weekly_availability_hours`

Required job-side tags created immediately at ingest:

1. `role_family`
2. `target_term`
3. `target_year`
4. `experience_band`
5. `is_early_career`

Exact actions:

1. extend onboarding/preferences to capture richer qualification targeting
2. keep existing coarse `levels` only as a migration compatibility field
3. backfill old profiles/jobs where inference is safe; otherwise leave them explicit-follow-up required
4. update UI copy and match explanations to use the richer qualification labels

Exit criteria:

- Twin can distinguish `Summer 2027 Internship`, `New Grad 2027`, and `Associate` in both profile intent and job tagging

Future extension to preserve:

## Session Handoff — 2026-04-03

Finished:

- unified job-industry normalization behind `lib/job-industries.ts`
- made `/api/jobs/browse` normalize/fallback industries before applying industry filters so browse results do not depend only on stale stored tags
- changed `/api/jobs/ingest` job writes to preserve existing identity fields on canonical URL collisions instead of blindly overwriting title/company/location with the latest payload
- updated seed-job materialization to use the same industry normalization contract as ingest and browse

Blocked / still incomplete:

- existing bad rows in Supabase are not automatically repaired by this code change
- live DB audit could not be run from this sandbox because outbound DNS to Supabase failed
- `npm run test:apply-engine` still cannot run here because `./.venv/bin/python` is missing

Exact next step:

- run a live job reconciliation against Supabase, identify canonical URL collision groups and rows with bad/missing industries, then apply a one-time data repair/backfill

Exact verification run:

- `python3 -m py_compile $(find apply_engine -name '*.py')`
- `npm run build`
- `node scripts/reconcile-jobs.mjs` attempted but blocked by sandbox DNS failure to Supabase

- add an opt-in `graduation_year_flex` profile setting so a student can explicitly authorize Twin to generate alternate recruiting-window targeting for adjacent years
- the default must remain strict to the user's primary graduation data unless the user opts in
- flexing graduation targeting must never fabricate employment dates, degree dates, or locked resume facts
- this feature is intended to widen internship and new-grad coverage for users whose graduation timing is genuinely flexible
- matching should treat flex years as secondary preference bands, not as unconditional overrides
- if flex mode is enabled and a job is routed through an alternate recruiting window, the generated resume variant for that application may swap only the recruiting-window-specific graduation presentation that the user pre-approved
- every flexed application must persist provenance showing the primary year, the flexed year/window used, and whether the resume artifact was adjusted for that application

### Phase H4 — Efficient Matching Architecture

Status: `active`

Objective:

- remove brute-force matching from normal ingest and digest operation

Architecture direction:

1. tag jobs immediately at ingest:
   - industries
   - role family
   - target term
   - target year
   - portal support tier
   - remote/location family
2. store normalized preference selectors on profiles:
   - industries
   - role families
   - target terms
   - target years
   - remote/location preferences
3. split matching into two stages:
   - Stage A: cheap candidate selection in SQL/routing tables
   - Stage B: in-code scoring only on the reduced candidate set

Recommended implementation:

1. add a SQL helper like `public.select_candidate_profiles_for_job(...)`
2. optionally add a routing table/materialized selector layer keyed by:
   - industry
   - role_family
   - target_term
   - target_year
3. change ingest flow to:
   - normalize and upsert job
   - fetch candidate profile ids only
   - run `matchJobToProfile` on those candidates
   - create alert/digest tasks only for high-confidence matches
4. make digest generation use the same candidate-selection helper instead of a separate broad scan
5. normalize scoring around populated profile data only:
   - missing optional profile fields should reduce confidence, not create hard mismatches
   - only explicitly strict user preferences should generate rejections
   - location and recruiting-window settings should support `strict`, `prefer`, and `ignore`

Exit criteria:

- no normal matching path scans the full profile table
- partially completed but usable profiles still receive sensible ranked matches based on the fields they have actually filled out

Future resume-variant architecture to return to after the current docket:

1. build an `experience vault` model from the structured resume:
   - canonical experience entries
   - tagged bullets
   - skills
   - role-family / industry / seniority tags
2. add deterministic resume assembly before apply:
   - always keep locked bullets
   - score flexible bullets against the matched job
   - render a job-specific resume variant locally from a fixed template
3. support an opt-in graduation-year flex mode:
   - ask in profile/onboarding whether Twin may target adjacent graduation years
   - if enabled, allow resume variants and job targeting to cover multiple internship/new-grad windows
   - if a flexed year is used for a given application, the resume variant may update only the user-approved graduation-year presentation for that role
   - keep explicit provenance of which year/window variant was used for a given application
4. minimize paid API usage:
   - parse/structure once
   - route and assemble variants with SQL plus local deterministic scoring
   - reserve Anthropic for explicit fallback or constrained bullet-rewrite cases only
5. keep incomplete-profile matching normalized:
   - score on available signals only
   - never punish missing optional fields as if they were explicit negative preferences

### Phase I — Operator Evidence Upgrade

Status: `queued`

Objective:

- make failed runs diagnosable from Twin without raw database spelunking

Exact actions:

1. persist and expose operator-safe run evidence:
   - screenshot metadata and durable screenshot references
   - blocked step
   - blocked family
   - recovery family attempted
   - failure source
   - unresolved questions
2. add a run-detail view from dashboard/apply-lab instead of summary-only rows
3. make screenshot access authenticated and scoped to the owning user/operator role only
4. keep replay/debug data separate from public-facing “application history”
5. add retention rules so evidence storage does not grow unbounded

Exit criteria:

- an operator can inspect one failed run and know the exact next fix without opening Supabase manually

### Phase J — Support-Tier Truth

Status: `queued`

Objective:

- make portal support explicit and prevent unsupported/partial paths from looking production-ready

Exact actions:

1. define repo-wide support tiers:
   - Greenhouse: `live target`
   - Lever: `live target`
   - Workday: `partial / triaged`
   - Ashby / Handshake / vision fallback: `not for MVP queue default`
2. store and expose support tier in portal helpers and UI badges
3. prevent low-tier portals from being auto-queued by default
4. update seed-job/operator tooling so live validation stays focused on the real MVP set

Exit criteria:

- there is one unambiguous support-tier contract used by the app, docs, and operator tools

### Phase K — Documentation Cohesion

Status: `active`

Objective:

- keep README, PLANS, and master planning synchronized so execution truth does not drift

Exact actions:

1. use `PLANS.md` for the current execution slice only
2. use `docs/master-planning.md` for platform truth and cross-cutting rules
3. trim README to setup + current operating shape, and explicitly point deeper planning to the two files above
4. whenever platform truth changes, update both docs in the same session
5. move stale speculative material out of the active path or mark it clearly as non-authoritative

Exit criteria:

- a new contributor can read README + PLANS + master planning and get one consistent story

### Cross-Cutting Safety / Cost Work Required by Phases G-K

These items are mandatory and not optional polish:

1. Add route-level rate limiting and dedupe for:
   - `/api/apply/plan`
   - `/api/apply/submit`
   - `/api/jobs/[jobId]/queue`
   - `/api/messaging/reply`
   - `/api/messaging/send-alert`
   - internal cron endpoints that fan out provider sends or queue work
2. Add queue-level idempotency:
   - dedupe key at least on `user_id + job_id + request fingerprint`
   - cooldown window for repeated failed requeues unless an operator intentionally overrides
3. Add provider spend controls:
   - prefer in-app state changes over SMS where possible
   - use digest-style batching over one-message-per-event
   - shorten templates to one segment when possible
   - record provider, segment count, and estimated cost per send
4. Keep Anthropic usage bounded:
   - only for explicit fallback cases
   - disabled by default for normal flows
   - log invocation count and reason
5. Keep Yutori disabled for MVP by default:
   - no background activation without explicit cost/abuse controls
6. Add abuse protections:
   - signature verification for Twilio before treating a message as trusted
   - strict worker-secret checks for internal routes
   - no user-controlled URL should trigger repeated expensive engine work without throttling

### Implementation Order

1. Phase G — Product Truth Alignment
2. Phase H2 — Job Hydration Reconciliation
3. Phase H3 — Qualification Targeting Architecture
4. Phase H4 — Efficient Matching Architecture
5. Phase H — Unified Queue Gating
6. Cross-cutting rate limiting + idempotency
7. Phase I — Operator Evidence Upgrade
8. Phase J — Support-Tier Truth
9. Phase K — Documentation Cohesion

### Plan Review Pass 1 — Clarity Check

Questions asked:

- is there one canonical owner for each gap?
- does each phase have a clear exit criterion?
- do the cost controls apply across all queue/provider entry points?
- can a contributor tell what must ship before polish?

Result:

- clear enough to execute
- biggest non-goal clarified: no new portal expansion before queue gating + evidence + truth alignment are fixed
- biggest dependency clarified: route-level rate limiting and queue idempotency must land before broadening SMS approvals or opening more queue entry points

Clarifications added because of this review:

- support-tier labels are now explicit
- shared queue-entry helper is now required, not optional
- README ownership is now narrowed to setup/current operating shape only
- richer qualification targeting is now a first-class architecture change, not a UI tweak
- matching optimization must be shared by ingest and digest paths so there is one routing/scoring contract

### Plan Review Pass 2 — Security / Abuse / Cost Check

Questions asked:

- where can an attacker or buggy client trigger repeated expensive work?
- where can a forged inbound message cause queue creation?
- where can duplicates or retries cause duplicate applications or excess spend?
- where are expensive APIs being used without an explicit budget rule?

Result:

- highest-risk surfaces are the queue endpoints, apply plan/submit endpoints, inbound messaging route, and provider-send fanout paths
- current Twilio webhook trust model is too weak for MVP and must be tightened before calling SMS approvals “live”
- current cost risk is over-triggering SMS and engine runs, not database compute

Security/cost requirements added because of this review:

- Twilio signature verification is required before trusted inbound actions
- expensive routes must have per-user/per-IP or per-phone throttles plus idempotency keys
- provider sends must record segment counts and dedupe windows
- Anthropic and Yutori must remain opt-in fallback systems, not ambient dependencies
- provider fanout must happen only after candidate reduction and confidence gating, never before

## MVP Execution Order

### Phase A — Real Run Validation

Status: `active`

Objective:

- stop optimizing in the abstract and start testing the vetted job set repeatedly

Exact actions:

1. Start the app locally:
   - preferred for repeated queue runs: `npx next start -p 3001`
   - use `npm run dev` for normal UI work only
2. Start the apply engine locally:
   - `./.venv/bin/uvicorn apply_engine.main:app --host 127.0.0.1 --port 8000`
3. Open `/apply-lab`
4. Use operator-selected real jobs routed through the live browse/apply flow
5. For each portal:
   - run `plan`
   - queue one job
   - run `npm run process:queue:direct`
   - inspect the resulting run in dashboard/apply-lab
6. Record the first real blocked family per portal

Exit criteria:

- at least one real run attempted on each currently supported portal family in the vetted set
- blocked runs show usable telemetry

### Phase B — Greenhouse Happy Path

Status: `next`

Objective:

- make Greenhouse reliably usable for the vetted job set

Exact actions:

1. Run live Greenhouse applications from the vetted set
2. Fix the top repeated blocker in this order:
   - remaining ITAR/custom-question selector state
   - required field mismatch
   - option text mismatch
   - multi-step navigation stall
   - auth wall false positive
3. Add tests for every fix
4. Repeat until at least one vetted Greenhouse job completes cleanly

Exit criteria:

- at least one vetted Greenhouse job reaches a true applied/confirmation state
- recovery metadata is visible if retries happen

### Phase C — Lever Happy Path

Status: `queued`

Objective:

- get Lever to the same level as Greenhouse on the vetted set

Exact actions:

1. Run live Lever applications from the vetted set
2. Fix blockers in the same order as Greenhouse
3. Add selector/alias coverage for any Lever-specific wording that caused failures

Exit criteria:

- at least one vetted Lever job reaches a true applied/confirmation state

### Phase D — Workday Stabilization

Status: `queued`

Objective:

- keep Workday operationally useful even if not yet as strong as Greenhouse/Lever

Exact actions:

1. Run one real Workday path when a vetted public job is available
2. Focus on:
   - step detection
   - validation capture
   - recovery on EEO/availability/authorization
   - final submit/review transitions
3. Preserve screenshots and blocked step metadata

Exit criteria:

- Workday failures are consistently diagnosable from run data
- at least one Workday path advances through multiple steps without blind failure

### Phase E — Approval Loop

Status: `queued`

Objective:

- make the “confirm then apply” product loop real enough for MVP

Exact actions:

1. Ensure queueing is blocked when critical readiness issues exist
2. Make approval entry clearer in dashboard/apply-lab
3. Connect approval action to queue creation in a single, obvious flow
4. Keep SMS/webhook integration behind truth-based status if not fully live yet

Exit criteria:

- user can explicitly confirm and cause a queued apply attempt without hidden steps

### Phase F — Operator Surface

Status: `queued`

Objective:

- make it fast to debug and improve the system after each real run

Exact actions:

1. Keep recovery summary and blockers summary visible
2. Add any missing run metadata needed for triage
3. Keep queue state obvious:
   - queued
   - running
   - applied
   - requires auth
   - failed

Exit criteria:

- after a failed run, the next engineering action is obvious from the UI

## Commands

### Run the app

```bash
npx next start -p 3001
```

### Run the apply engine

```bash
./.venv/bin/uvicorn apply_engine.main:app --host 127.0.0.1 --port 8000
```

### Drain a few queued applications locally

```bash
npm run process:queue:local
```

Optional:

```bash
TWIN_MAX_RUNS=5 npm run process:queue:local
```

Recommended when the local app server is flaky:

```bash
npm run process:queue:direct
```

### Test + verify

```bash
npm run test:apply-engine
python3 -m py_compile $(find apply_engine -name '*.py')
npm run build
```

## Session Log — 2026-03-30

Completed in this session:

- added portal-specific hint aliases for live question inference
- improved targeted recovery so it can refill alias-matched questions on the blocked step
- added vetted MVP live-run job file
- switched `/apply-lab` to the vetted job set
- added local queue runner command
- added repo-root `AGENTS.md` and `PLANS.md`
- added stable local prod-server path for queue runs with `npx next start -p 3001`
- fixed browser-layer submit selection so visible submit buttons are preferred over hidden matches
- added visible-candidate selection for fill/select/upload/check actions
- added Greenhouse selector coverage for `school--*` and `degree--*`
- added Greenhouse metadata-driven question scanning from `window.__remixContext`
- added Greenhouse combobox handling for portal-defined select questions
- added explicit yes/no inference for ITAR and sponsorship-style Greenhouse questions
- added `discipline` as a normalized education field across selectors and recovery
- added motivation-style fallback answers for prompts like `Why are you interested in this role?`
- added EEO semantic mapping such as `Woman -> Female`
- ran repeated live queue passes against the vetted Greenhouse and Lever jobs
- fixed Greenhouse education handling against real production IDs:
  - `start-month--0`
  - `start-year--0`
  - `end-month--0`
  - `end-year--0`
- added combobox label resolution so Greenhouse select-style answers use display labels like `Yes` instead of raw internal values
- added a hard app-to-engine timeout so one stuck Playwright run does not wedge the queue worker indefinitely
- added unresolved required-question detection in the apply engine
- persisted unresolved questions into apply-run summaries as follow-up items
- added a daily markdown follow-up report script:
  - `npm run report:daily:followups`
- generated the first real report at:
  - `reports/daily-followups-2026-03-30.md`
- added outbound daily follow-up SMS support:
  - internal route: `/api/internal/followups/send-daily`
  - local script: `npm run send:daily:followups`
- added inbound follow-up answer parsing and storage:
  - inbound replies now parse numbered answers from SMS
  - parsed answers are stored on `profiles.gray_areas.follow_up_answers`
  - future apply attempts now reuse exact stored prompt-answer pairs through `custom_answers`

Verified:

- `npm run test:apply-engine` → 87 passing tests
- `python3 -m py_compile $(find apply_engine -name '*.py')`
- `npm run build`

Current live blockers from vetted runs:

- Greenhouse / Scale AI:
  - current classified blocker is `step_0: timed out during step_fill`
- Greenhouse / Rendezvous Robotics:
  - latest code now targets the ITAR authorization wording and `Why Rendezvous Robotics?`, but it still needs a clean rerun on a reclaimed application row
- Lever / SoloPulse:
  - now correctly classifies as `requires_auth` because of hCaptcha/manual verification
- Lever / WeRide:
  - current blocker remains the two required custom text prompts:
    - `When will you graduate? (expected month & year)`
    - `When can you start internship?`
  - the latest code now parses Lever `baseTemplate` metadata so those `field0/field1` prompts map to exact textarea selectors and prompt text instead of opaque field names

Most recent live progress:

- the queue path is stable when run against `next start`
- the Lever hidden-submit issue is fixed in code and covered by tests
- unresolved required prompts can now be queued into a daily report instead of disappearing into generic failed runs
- unresolved required prompts can now also be sent as a daily SMS summary for opted-in users
- inbound SMS replies can now be stored and reused on later apply attempts for the same unresolved prompts
- answered follow-up prompts now drop out of the daily report and SMS batch instead of being resent forever
- the first fresh live Greenhouse run in this session hit the app-to-engine timeout, so the default timeout was widened to 240s for normal runs and 420s for Greenhouse
- added a direct local queue processor so live MVP runs can bypass the local Next HTTP hop and talk to Supabase + the apply engine directly
- Greenhouse execution now has an internal per-step timeout path, so stalled runs return classified errors like `step_0: timed out during step_fill` instead of burning the whole request budget invisibly
- Lever now has two materially better live behaviors:
  - captcha/manual verification is classified as `requires_auth`
  - grouped custom-question scanning now uses the real question prompt instead of `Yes` / `No` option labels
- Lever question scanning now also parses hidden `baseTemplate` metadata for card-style custom fields, which should tighten WeRide’s `field0/field1` handling on the next rerun
- the direct runner now reclaims stale `running` applications before processing and retries one transient apply-engine fetch failure
- the vetted queue helper now also requeues stale `running` applications so repeated MVP reruns do not get stuck behind old operator rows
- the next live rerun should focus on:
  - narrowing Greenhouse `step_fill` into a concrete field-level blocker
  - validating that the Lever `baseTemplate` patch closes the WeRide `field0/field1` miss

## Exact Next Step

Keep the new architecture work active before resuming broader live-run loops.

That means:

1. apply the new Supabase migration:
   - `supabase/migrations/20260402120000_job_routing_and_targeting.sql`
2. run the reconciliation report:
   - `npm run reconcile:jobs`
3. inspect and clean any duplicate/canonical drift groups
4. validate onboarding writes the richer qualification targeting fields
5. verify ingest and digest matching are using the new candidate-selection SQL helpers against real data
6. only then return to broader apply reliability work on the vetted live set

## Session Log — 2026-04-02

Completed in this session:

- added a new Supabase migration for:
  - canonical job identity fields
  - richer profile qualification targeting fields
  - job routing tags
  - candidate-selection SQL functions
- added shared job normalization in the app:
  - canonical URL logic
  - job level inference
  - role-family / term / year / experience-band tagging
- updated API ingest to:
  - infer and persist qualification tags immediately
  - upsert on canonical job identity
  - fetch candidate profile ids via SQL instead of scanning all profiles
- updated direct Python Supabase ingest to:
  - use canonical URL normalization
  - persist the same qualification tags
  - upsert on canonical job identity
- added profile-side richer targeting fields:
  - target role families
  - target terms
  - target years
  - graduation year / term support
- extended onboarding preferences UI to capture richer qualification targeting
- updated matching to incorporate:
  - role family
  - recruiting term
  - recruiting year
- updated digest candidate selection to use the SQL job-routing helper instead of broad recent-job scans
- added an operator reconciliation script:
  - `npm run reconcile:jobs`
- added a DB-backed request control layer:
  - rate-limit state table
  - `consume_rate_limit(...)` SQL function
  - application request fingerprints for queue idempotency
- wired rate limiting into:
  - `/api/apply/plan`
  - `/api/apply/submit`
  - `/api/jobs/[jobId]/queue`
  - `/api/messaging/reply`
  - `/api/messaging/send-alert`
  - prospective-list fanout cron routes
- added queue cooldown behavior for recent identical failed/requires-auth retries
- added a resend guard for outbound alert SMS if a message id is already recorded

Verified:

- `python3 -m py_compile $(find apply_engine -name '*.py') scraper/ingest_jobs.py scraper/sources/common.py`
- `npm run build`

Could not verify:

- `npm run test:apply-engine`
  - blocked in this workspace because `./.venv/bin/python` does not exist

Current truth after this session:

- the codebase now has one normalized architecture for:
  - canonical job identity
  - richer qualification targeting
  - candidate routing before scoring
- the migration must be applied before the new routing/tag fields and SQL helpers exist in Supabase
- the request-control migration must also be applied before DB-backed throttles and queue idempotency work
- old data may still need reconciliation before website hydration fully matches canonical job truth

Exact next step:

1. apply the new migration
2. apply the request-control migration
3. run `npm run reconcile:jobs`
4. inspect any canonical drift or missing metadata
5. validate one real ingest path and one real digest path against the new SQL candidate selectors
6. validate that rate limits and queue cooldowns behave as expected on the protected routes

## Session Log — 2026-03-31

Completed in this session:

- unified metadata-driven combobox filling with the low-level shared combobox executor
- added month-number and education-synonym matching to the browser-level combobox matcher
- fixed a DOM wrapper-selection bug where Greenhouse required-input sync could stop at `.select-shell` instead of the real `.select__container`
- added low-level hidden required-input sync directly inside `fill_combobox_input`, not only in later portal-specific cleanup
- added a Greenhouse post-fill verification pass that rechecks education fields and captures field-state diagnostics
- proved through live reruns that Greenhouse education is no longer the main blocker; the failure moved from `School / Degree / Discipline` to the ITAR eligibility question on Rendezvous
- added blocked-page Greenhouse retry logic so the agent re-runs hint-driven autofill on the exact blocked page before falling back to generic selector recovery
- extended blocker classification so ITAR / lawful-permanent-resident / protected-individual wording is treated as `authorization`
- wired proactive Lever `cards[...]` filling into the real agent path before submit and on submit-time recovery instead of leaving it as an unused helper
- added targeted operator diagnostics for Greenhouse question-level failures
- identified an operator-path issue where polling TTY-bound worker sessions could kill the worker and contaminate live runs
- switched back to a non-TTY worker path for live reruns
- patched browser-level combobox commit flow so matched option values are preserved and synced into hidden required inputs, not just visible labels
- patched Greenhouse required-input sync to prefer explicit committed option values over `.select__single-value` text
- fixed a live Greenhouse inference bug where `Start date month` could collide with generic `start_date` and incorrectly fill education month fields with a full ISO date
- upgraded Greenhouse metadata parsing so `multi_select_style: checkbox` questions expose real input-name selectors in addition to react-select option selectors
- upgraded `process:queue:direct` to self-heal the local worker by checking `/health`, auto-starting uvicorn locally, and retrying once after connection-level worker failures

Verified:

- `./.venv/bin/python -m unittest apply_engine.tests.test_agents -v`
- `./.venv/bin/python -m unittest apply_engine.tests.test_browser apply_engine.tests.test_agents -v`
- `npm run test:apply-engine` (`97` passing tests)
- `npm run build`

Current live truth after this session:

- Greenhouse:
  - the old education validation blocker is effectively cleared
  - the remaining repeated live blocker is the ITAR eligibility question on the vetted Rendezvous run
  - the current rerun is the first one exercising both the explicit combobox commit-value patch and the metadata-style selector patch together
  - a transient retry-path regression briefly surfaced `First Name is required`; that was narrowed and patched by reinforcing identity fields before retry
- Lever:
  - captcha/manual verification correctly lands as `requires_auth`
  - proactive `cards[...]` filling is now wired in, but WeRide still needs another clean live validation pass
- Ops:
  - repeated live validation from inside this Codex sandbox is now partially limited by intermittent DNS failures to hosted Supabase (`ENOTFOUND`)

Exact next step:

1. keep `Phase A` active
2. let the current clean Greenhouse rerun finish on the latest commit-value + metadata-style patch set
3. inspect the full persisted error/debug payload for the Rendezvous ITAR field if it still blocks
4. patch the exact ITAR selector-state issue if it still does not commit
5. then rerun WeRide Lever with the proactive `cards[...]` path active

## Session Log — 2026-04-02

Completed in this session:

- added persistent queued-state and direct posting links to the jobs board
- added a one-command apply-plan rate-limit validator and verified route throttling returns `429` after repeated requests
- changed Twilio messaging to updates-only instead of SMS confirmations
- removed SMS reply-driven queueing from the primary messaging path and aligned dashboard/product copy with that change
- added a split-screen dashboard queue-review surface:
  - left side application card list
  - right side verification pane
  - job summary, payload snapshot, readiness summary, and posting link
- added targeted `Trust Apply` processing for a selected queued application instead of only processing the next queued item blindly

Verified:

- `npm run build`

Could not verify:

- `npm run test:apply-engine`
  - blocked in this workspace because `./.venv/bin/python` does not exist

Current truth after this session:

- queued applications can now be reviewed in a split-screen dashboard flow before submit
- a user can bypass detailed review by using `Trust Apply` on the selected queued application
- Twilio now behaves as an updates channel, not a confirmation channel, although older prospective-list automation still exists elsewhere in the codebase and may need further simplification later

Exact next step:

1. soften matching strictness for location and recruiting window
2. add `strict / prefer / ignore` preference controls plus `graduation_year_flex`
3. make the jobs board explain soft mismatches vs hard blockers
4. simplify or retire the remaining prospective-list auto-queue semantics so all queue approval paths stay product-consistent
