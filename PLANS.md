# Twin MVP Plan

Last updated: 2026-03-31

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
- vetted live-run job set now exists: `data/job-seeds/vetted-live-mvp.json`
- tests passing:
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
4. Use only jobs from `data/job-seeds/vetted-live-mvp.json`
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

Keep `Phase A` active and continue direct live runs against Greenhouse first.

That means:

1. run the app
2. run the apply engine
3. queue vetted jobs from `/apply-lab`
4. process them with `npm run process:queue:direct`
5. if a run surfaces unresolved required prompts, review `reports/daily-followups-YYYY-MM-DD.md`
6. optionally send the daily SMS batch with `npm run send:daily:followups`
7. fix the first real blocker that shows up

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
