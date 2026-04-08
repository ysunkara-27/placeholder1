# Twin MVP Plan

Last updated: 2026-04-08

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

## Session Handoff — 2026-04-08 (Profile Geo Tree Selector)

Finished:

- replaced the flat city badge picker in `components/onboarding/step-preferences.tsx` with a cascading geo-tree selector that narrows choices by node depth and resets/collapses after each saved selection
- added `lib/profile-geo.ts` as the shared source for geo node labels, aliases, parent/child relationships, and canonical slug normalization
- updated profile hydration and save paths so location preferences now prefer canonical geo node slugs from taxonomy payloads instead of legacy free-text city strings
- updated applicant-side location ranking so stored geo selections still expand into human-readable search terms for portal autofill and location preference ranking
- kept backward compatibility for existing profiles by normalizing previously saved free-text locations into the new geo-node model when possible
- verified:
  - `python3 -m py_compile $(find apply_engine -name '*.py')`
  - `npm run build`

Still blocked:

- `npm run test:apply-engine` is still blocked locally because the script expects `./.venv/bin/python`, which does not exist in this workspace
- the geo tree currently covers the main saved/profile preference markets in code, but it is still a curated selector set rather than a full taxonomy-backed UI sourced directly from `taxonomy_nodes`

Exact next step:

- live-test onboarding and `/profile` editing with an existing profile plus a fresh onboarding flow, then decide whether to expand the geo tree from the seeded taxonomy table instead of the current curated node set

Exact verification run:

- `npm run test:apply-engine` (blocked: `./.venv/bin/python` missing)
- `python3 -m py_compile $(find apply_engine -name '*.py')`
- `npm run build`

## Session Handoff — 2026-04-05

Finished:

- added a Railway-compatible queue worker entrypoint at `apply_engine/queue_worker.py`
- updated `apply_engine/worker.railway.json` so the worker service polls the Next app queue-drain endpoint instead of launching an unused Celery process
- verified the required repo checks still pass after the worker change:
  - `npm run test:apply-engine`
  - `python3 -m py_compile $(find apply_engine -name '*.py')`
  - `npm run build`
- live-tested the real queue path against a queued Xometry Greenhouse application:
  - before restarting the stale local apply engine, the job failed immediately because the running engine treated the signed Supabase resume URL like a local file path
  - after restarting the engine from current workspace code, the same application successfully moved from `queued` to `running` under `worker_id=queue-worker`
  - after wiring execution context through `lib/application-queue.ts` and `lib/apply-engine.ts`, the same application row started receiving real Python-side `log_events` (`Browser launched`, `Page loaded`, `Filling contact info`, `Navigating form`)

Still blocked:

- the hosted Railway worker path now exists in repo, but it still needs live validation in Railway with `TWIN_APP_BASE_URL` and `APPLY_QUEUE_WORKER_SECRET` set on the service
- the latest Xometry live run now proves queue + telemetry wiring, but still needs terminal-state validation because it appears to stall in the Greenhouse fill/navigation phase
- long-lived local apply-engine processes can mask current code behavior during live tests; operator runs need an explicit restart/check before trusting results

Exact next step:

- deploy/restart the Railway worker service with the new `python queue_worker.py` start command, confirm it can hit the app with the worker secret, and then watch one queued Greenhouse application reach a terminal state from the dashboard/apply-lab flow while checking `applications.log_events` for the last successful step

Exact verification run:

- `npm run test:apply-engine`
- `python3 -m py_compile $(find apply_engine -name '*.py')`
- `npm run build`
- live worker POST to `http://127.0.0.1:3001/api/internal/apply-queue/process`
- live Supabase poll of application `cd8c646b-6847-4cf4-bbad-208b0fa38dfa`
- fresh local queue drain via `node scripts/process-queue-local.mjs` against a restarted apply engine on `127.0.0.1:8000`

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

## Session Handoff — 2026-04-05 (Job Matching Taxonomy Spec)

Finished:

- added an implementation-ready taxonomy attribute spec to `docs/job-matching-standardization-plan.md`
- locked the normalization model around one generic `taxonomy_nodes` system with dimension trees, alias matching, multi-node mappings, and confidence-aware parent fallback
- defined canonical dimensions for geo, work modality, industry, job function, career role, education degree, education field, work authorization, and employment type
- documented two internal profile layers (`match_preferences` and `application_facts`) with one seamless user-facing profile flow
- specified `possible_match` as a first-class match state and documented disclosure-policy handling for optional application data like GPA and demographic fields
- added the full implementation plan for taxonomy schema, company priors, deterministic resolvers, browse cutover, apply-completion cutover, migration order, and verification expectations

Still blocked:

- no schema, migrations, or resolver implementation exists yet for the taxonomy model
- browse filtering, onboarding persistence, RPC routing, and apply-engine profile export still use older flat fields and string matching
- seeded taxonomy coverage and alias dictionaries have not yet been created for industry-heavy role breadth

Exact next step:

- design the initial Supabase schema and migrations for `taxonomy_nodes`, aliases, path expansion support, and profile/job mapping tables or arrays, then implement Phase 0 vocabulary cleanup and the first resolver pass for geo + industry + career-role normalization

Exact verification run:

- docs-only in this session; no code verification run executed

## Session Handoff — 2026-04-05 (Taxonomy Foundation Migration Draft)

Finished:

- drafted the first Supabase taxonomy foundation migration at `supabase/migrations/20260405150000_taxonomy_foundation.sql`
- added schema for taxonomy nodes, aliases, negative aliases, ancestry paths, company priors, job/profile taxonomy mappings, and taxonomy resolution logs
- added the first dual-write-oriented taxonomy columns to `public.jobs` and `public.profiles`
- added indexes, updated-at triggers, initial RLS policies, and a `rebuild_taxonomy_paths()` helper for ancestry expansion refreshes

Still blocked:

- the migration has not been applied against a live/local Supabase database yet
- no seed migration exists yet for taxonomy nodes, aliases, or company priors
- RPCs and app code still read legacy matching fields and do not yet use the new taxonomy schema

Exact next step:

- apply and validate the taxonomy foundation migration, then create the first seed migration for fallback nodes plus initial `industry`, `job_function`, `career_role`, and `geo` trees

Exact verification run:

- migration drafted only; no database apply/test run executed in this session

## Session Handoff — 2026-04-05 (Taxonomy Seed Migration Draft)

Finished:

- drafted the first taxonomy seed migration at `supabase/migrations/20260405153000_taxonomy_seed_mvp.sql`
- seeded initial trees for `industry`, `job_function`, `career_role`, `geo`, `education_degree`, `education_field`, `work_authorization`, and `employment_type`
- added starter positive aliases, negative/disambiguation phrases, and initial company priors for the current internship source-company set
- wired the seed migration to rebuild ancestry paths after inserts so branch expansion can be used by later resolver/matching code

Still blocked:

- the seed migration has not been applied against a live/local Supabase database yet
- no application code uses the seeded taxonomy yet
- the geo seed is still a starter set, not the full intended major-city/state coverage

Exact next step:

- apply both taxonomy migrations, validate schema/seed integrity, and begin implementing the TS resolver and dual-write ingest path against the seeded dimensions

Exact verification run:

- seed migration drafted only; no database apply/test run executed in this session

## Session Handoff — 2026-04-05 (Profile Taxonomy Integration)

Finished:

- implemented profile-side taxonomy serialization in `lib/taxonomy/profile.ts`
- updated `lib/platform/profile.ts` to read/write `profile_match_preferences`, `profile_application_facts`, `profile_taxonomy_summary`, and `profile_work_modality_allow`
- extended onboarding and profile editing flows so they now capture and persist:
  - work setup preferences (`remote` / `hybrid` / `onsite`)
  - relocation openness
  - GPA disclosure policy
  - demographic disclosure policy
- kept the user flow seamless by layering the new structured fields behind the existing profile/onboarding UX rather than exposing internal storage concepts
- expanded profile completeness to reflect the new structured application inputs

Still blocked:

- job ingest and matching code still do not resolve jobs into taxonomy-backed dimensions
- the new profile JSON payloads are being written, but UUID node-array fields are still placeholders until resolver-backed node resolution is implemented
- migrations were drafted but not applied in this session, so the new persisted fields require DB rollout before this code can store them successfully in a real environment
- `npm run test:apply-engine` is still blocked locally because the script expects `./.venv/bin/python`, which does not exist in this workspace

Exact next step:

- apply the taxonomy migrations, then implement TS-side job taxonomy resolution and dual-write ingest so browse matching can consume normalized job and profile dimensions together

Exact verification run:

- `npm run test:apply-engine` (blocked: `./.venv/bin/python` missing)
- `python3 -m py_compile $(find apply_engine -name '*.py')`
- `npm run build`

## Session Handoff — 2026-04-05 (Job Taxonomy Integration)

Finished:

- added deterministic job taxonomy resolution in `lib/taxonomy/job.ts`
- updated `lib/job-ingest.ts` so API ingest now computes and writes taxonomy summaries, work modality, multi-location text, review flags, and taxonomy version metadata alongside legacy fields
- updated `lib/matching.ts` so browse/matching can use taxonomy-based industry, career-role, location, and work-setup overlap when normalized payloads are present, while still falling back to legacy fields
- updated `scraper/ingest_jobs.py` so direct Supabase ingest writes the first taxonomy-oriented job summary fields instead of staying entirely on the old flat shape
- extended generated Supabase TypeScript types for the new job/profile taxonomy columns so the app compiles against the draft schema

Still blocked:

- the Supabase project is not linked in this workspace, so `supabase db push --dry-run` fails with `Cannot find project ref. Have you run supabase link?`
- because the migrations were not applied in this session, runtime writes to the new taxonomy columns still depend on DB rollout before they can succeed against the real database
- UUID node-array columns are still placeholders until node-slug-to-node-id resolution is implemented after DB seed rollout
- `npm run test:apply-engine` is still blocked locally because the script expects `./.venv/bin/python`

Exact next step:

- run `supabase link --project-ref qzwextagotdqbfoyeerz`, apply the two taxonomy migrations, then implement node-id resolution/backfill so slug summaries and UUID node arrays stay in sync

Exact verification run:

- `supabase db push --dry-run` (blocked: project not linked)
- `python3 -m py_compile $(find apply_engine -name '*.py') $(find scraper -name '*.py')`
- `npm run build`

## Session Handoff — 2026-04-05 (Taxonomy Write-Time Resolution)

Finished:

- updated `docs/job-matching-standardization-plan.md` with the exact dimension-by-dimension job-analysis workflow for `industry`, `job_function`, `career_role`, `geo`, `work_modality`, `education`, and `work_authorization`
- added `lib/taxonomy/node-resolution.ts` so taxonomy slug summaries can now be resolved into canonical node UUIDs via `taxonomy_nodes`
- updated profile saves to resolve and persist taxonomy node arrays at write time instead of leaving those fields empty placeholders
- updated job ingest to resolve and persist taxonomy node arrays at write time from the taxonomy summary payload
- added `supabase/migrations/20260405153500_taxonomy_seed_fix.sql` so the corrected level-by-level taxonomy seed now exists in repo history instead of only as manual SQL-editor state

Still blocked:

- the DB still needs the corrective seed state applied/verified in every environment that previously used the partial seed
- browse and routing still rely partly on slug-summary and legacy fallback logic; deeper node-array-first matching and explicit backfill tooling are still pending
- `npm run test:apply-engine` remains blocked by the missing local `./.venv/bin/python`

Exact next step:

- verify the corrective seed counts in Supabase, then add explicit job/profile taxonomy backfill tooling so existing rows receive canonical node IDs without requiring re-save or re-ingest

Exact verification run:

- `python3 -m py_compile $(find apply_engine -name '*.py') $(find scraper -name '*.py')`
- `npm run build`

## Session Handoff — 2026-04-05 (Visual System Pass)

Finished:

- unified the shared visual language around a warmer cream and deep red-orange palette
- updated shared button, input, textarea, navbar, and sign-out styling so more screens inherit the same tone automatically
- simplified the landing page message and reduced visual clutter while keeping the same core structure and feature story
- restyled the dashboard, live application panel, and queued jobs popup to match the same design system

Still blocked:

- several secondary product surfaces still use older gray/indigo styling and should be brought onto the same visual system in follow-up passes
- this pass intentionally did not reposition features or rewrite product flows, so some density remains where the underlying page structure is already crowded

Exact next step:

- propagate the same visual system through `/jobs`, `/apply-lab`, `/profile`, `/auth`, and onboarding so the whole signed-in flow feels consistent

Exact verification run:

- `npm run test:apply-engine`
- `python3 -m py_compile $(find apply_engine -name '*.py')`
- `npm run build`

## Session Handoff — 2026-04-05 (Admin JD Autofill Fix)

Finished:

- `Clean with AI` now prefers the actual job posting URL before the application URL when scraping description text
- admin JD fallback filtering now rejects generic extraction headings and similar scrape-noise lines before auto-filling the description field

Still blocked:

- some JS-heavy portals may still return weak server-side HTML, so live validation is still needed for those sources

Exact next step:

- rerun `Clean with AI` on the affected admin jobs and confirm the description field now fills from the posting page instead of generic scrape labels

Exact verification run:

- `npm run test:apply-engine`
- `python3 -m py_compile $(find apply_engine -name '*.py')`
- `npm run build`

## Session Handoff — 2026-04-05 (UI Rollback And Landing Cleanup)

Finished:

- rolled back the mismatched shared UI styling introduced by the previous visual redesign batch
- restored the site-wide baseline for dashboard/shared controls so the app is no longer split across two different visual systems
- rebuilt the landing page with a simpler hierarchy and cleaner card layout using the same token set already used elsewhere in the site
- simplified the navbar so it reads as part of the existing product instead of a separate design treatment

Still blocked:

- other app surfaces still need a deliberate design pass if the goal is a stronger unified brand system across the entire product
- the current token system is coherent again, but it is still conservative rather than fully polished

Exact next step:

- do a measured pass across `/jobs`, `/auth`, `/profile`, and onboarding to unify spacing, typography scale, and control styling without introducing a second visual language

Exact verification run:

- `npm run test:apply-engine`
- `python3 -m py_compile $(find apply_engine -name '*.py')`
- `npm run build`

## Session Handoff — 2026-04-05 (Full UI Consistency Pass)

Finished:

- propagated the warm shared visual system through `/auth`, `/jobs`, `/profile`, and onboarding
- updated shared controls (`button`, `input`, `textarea`, `badge`, `searchable-select`) so those pages now inherit one consistent interaction style
- restyled onboarding/profile section shells, progress indicators, and form cards to match the existing site token system instead of the old gray/indigo form language
- tightened browse jobs spacing and hierarchy so it reads cleaner without changing the feature layout

Still blocked:

- some secondary surfaces outside this pass still use older neutral styling and may benefit from the same cleanup later
- this was a consistency/polish pass, not a full design-system refactor, so some component-level styling is still duplicated across feature modules

Exact next step:

- do a final polish pass on remaining surfaces like `/resume`, `/applied`, admin tools, and dashboard detail components so the entire product reads as one cohesive UI

Exact verification run:

- `npm run test:apply-engine`
- `python3 -m py_compile $(find apply_engine -name '*.py')`
- `npm run build`

## Session Handoff — 2026-04-05 (Dashboard And Operator UI Unification)

Finished:

- carried the warm shared visual system through `/dashboard`, `/apply-lab`, `/applied`, and `/resume`
- rebuilt the dashboard hero, stats, recent activity feed, live application panel, and queue popup so they now read as the same product as landing/auth/jobs instead of an older gray/indigo admin surface
- restyled apply-lab review shells, applied-job history, portal account storage, saved follow-up answers, notification schedule, blocker/recovery summaries, and related operator cards to use one consistent token set
- cleaned remaining skeleton/loading states and split-pane chrome so the signed-in workflow no longer flips between multiple UI languages page-to-page

Still blocked:

- admin surfaces still need a dedicated pass if they are expected to match the polished product UI instead of remaining mostly operator-first
- some component styling is still feature-local rather than fully abstracted into reusable primitives, so future design tweaks will still touch multiple files

Exact next step:

- do the same controlled consistency pass on admin job review screens and any remaining run-detail/operator surfaces, then decide whether to consolidate repeated card/input patterns into shared UI wrappers

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

## Session Log — 2026-04-05

Completed in this session:

- standardized the user-facing operator palette across dashboard, apply lab, applied-jobs, queue popup, and live application review surfaces
- exposed `surface.strong` in Tailwind so skeleton/loading states can use the same warm token set instead of fallback grays
- aligned the verification editor, queued-jobs list, recent activity, and applied-jobs sections to the shared `canvas / surface / rim / ink / dim / accent` color system

Verified:

- `npm run build`
  - compile + typecheck passed
  - final page-data collection still fails on an existing admin route issue: `/api/admin/jobs/[jobId]`

Could not verify:

- `npm run test:apply-engine`
  - blocked in this workspace because `./.venv/bin/python` does not exist
- `python3 -m py_compile $(find apply_engine -name '*.py')`
  - not rerun in this frontend-only color pass

Current truth after this session:

- the main user-facing app no longer mixes the old gray/indigo operator palette with the newer warm product palette on the primary dashboard/apply-lab flows
- semantic success/error states still keep their own colors, but neutral surfaces and primary actions now share one token-driven theme
- production build verification is currently limited by an unrelated admin page-data collection failure, not by the color-token changes themselves

Exact next step:

1. visually sweep remaining user-facing dashboard subcards that still hardcode gray/indigo utilities
2. decide whether `/applied` should remain as a standalone archive page or be reduced further now that applied jobs live on the dashboard
3. fix the existing `/api/admin/jobs/[jobId]` build-time page-data failure so full production builds can pass cleanly again

## Session Log — 2026-04-05

Completed in this session:

- made the taxonomy job resolver record how `industry` was inferred:
  - known company prior vs deterministic phrase match vs legacy fallback vs branch fallback
- tightened `taxonomy_needs_review` so unknown companies and broad fallback classifications surface for operator follow-up
- added operator scripts:
  - `npm run backfill:taxonomy:jobs`
  - `npm run backfill:taxonomy:profiles`
  - `npm run report:taxonomy:review`
- documented the unknown-`company_slug` add-to-tree algorithm in `docs/job-matching-standardization-plan.md`

Verified:

- `python3 -m py_compile $(find apply_engine -name '*.py') $(find scraper -name '*.py')`
- `npm run build`

Could not verify:

- `npm run test:apply-engine`
  - blocked in this workspace because `./.venv/bin/python` does not exist

Current truth after this session:

- new companies do not require a pre-seeded prior to classify; they classify from deterministic posting evidence and broad branch fallback when needed
- the resolver now persists enough metadata to distinguish:
  - company-prior-based classifications
  - phrase-based classifications
  - legacy fallback
  - broad branch fallback
- there is now an operator path to identify recurring unknown-company slugs that should be promoted into `company_taxonomy_priors`

Exact next step:

1. finish applying the corrected taxonomy seed in Supabase
2. run `npm run report:taxonomy:review` against the real DB to identify unknown companies and fallback-heavy classifications
3. run `npm run backfill:taxonomy:jobs -- --dry-run --limit 50`
4. run `npm run backfill:taxonomy:profiles -- --dry-run --limit 50`
5. if the samples look correct, run both backfills live and then tighten browse queries to lean more directly on taxonomy node arrays

## Session Log — 2026-04-05

Completed in this session:

- expanded the geo taxonomy baseline to full US state coverage and added Canadian province/territory coverage in the taxonomy seed set
- cleaned city display labels to `City, ST/Province`
- added corrective geo migrations:
  - `20260405170000_taxonomy_geo_label_cleanup.sql`
  - `20260405171000_taxonomy_geo_all_states.sql`
  - `20260405172000_taxonomy_geo_canada_provinces.sql`
- upgraded job ingest and scraper taxonomy parsing to treat multi-location postings as explicit location option sets instead of one flat location string
- upgraded apply payload generation so queued applications can carry:
  - best-fit `location_preference`
  - ranked `location_preferences`
  - available `job_location_options`
- taught the Python apply engine schema and hint inference layer to use ranked/preferred location answers for office-choice prompts

Verified:

- `node --check scripts/backfill-taxonomy.mjs`
- `python3 -m py_compile $(find apply_engine -name '*.py') $(find scraper -name '*.py')`
- `npm run build`

Could not verify:

- `npm run test:apply-engine`
  - blocked in this workspace because `./.venv/bin/python` does not exist

Current truth after this session:

- a job can now preserve multiple available application locations through taxonomy summary and `locations_text`
- apply requests generated from queued jobs now choose location answers relative to the specific job, not just the user profile’s first saved city
- Canada now has province-level geo nodes, and the US has full state-level coverage under the existing regions

Exact next step:

1. run the new geo corrective SQL in Supabase:
   - `20260405170000_taxonomy_geo_label_cleanup.sql`
   - `20260405171000_taxonomy_geo_all_states.sql`
   - `20260405172000_taxonomy_geo_canada_provinces.sql`
2. verify geo counts and spot-check state/province labels
3. run `npm run backfill:taxonomy:jobs -- --dry-run --limit 50`
4. confirm multi-location rows now show expanded `locations_text` and `job_taxonomy_summary.location_options_text`
5. then run the job/profile backfills live
## Session Log — 2026-04-07

Completed in this session:

- validated the Browse Jobs -> queued application -> Apply Lab/direct worker path against a real Xometry Greenhouse application
- confirmed per-application `applications.log_events` now receives Python-side execution logs from the apply engine
- narrowed the active Greenhouse blocker from queue/worker plumbing to React-select field commitment during form fill
- added step-level Greenhouse logs, per-question selector logging, and per-field timeout guards so blocked runs no longer look like silent hangs
- fixed a bad phone-country control classification so the phone search/combobox control is no longer treated as the real phone field
- added explicit Greenhouse country/location targeting for `#country` and `#candidate-location`

Verified:

- `npm run test:apply-engine`
- `python3 -m py_compile $(find apply_engine -name '*.py')`
- `npm run build`
- `python3 -m py_compile apply_engine/agents/common.py apply_engine/agents/greenhouse.py`

Current truth after this session:

- queue claiming and local direct-worker processing work against real Supabase data
- Apply Lab/application log visibility works for Python execution events
- the tested Xometry Greenhouse run reaches terminal `failed` status instead of hanging
- phone is now filled through the real `#phone` tel input, not the phone-country combobox
- Xometry still blocks on Greenhouse-required React-select fields: `Country*`, `Location (City)*`, and `Are you legally authorized to work in the United States?*`
- the next fix should target React-select commit/state behavior for selectors `#country`, `#candidate-location`, and `#question_10998491007`

Exact next step:

1. instrument `fill_combobox_input` to report selected option/commit status for Greenhouse React-select fields
2. make Greenhouse country/location/auth selects commit through the same state path Greenhouse validation reads, not only through visible input text or hidden required input mutation
3. rerun application `cd8c646b-6847-4cf4-bbad-208b0fa38dfa` until the terminal error no longer includes Country, Location, or authorization
4. then rerun the full required verification batch after the React-select commit fix
