# Twin Execution Agents

Last updated: 2026-03-30

This file defines the working roles for pushing `Twin` to MVP. It is not a product spec. It is an execution document for multi-step development sessions.

If this file and the code disagree, the code wins first. Then update this file.

## Mission

Ship a working MVP where a user can:

1. complete onboarding and save a durable profile
2. see real matched jobs and real queued applications
3. confirm an application run
4. have Twin autofill and submit through the supported ATS portals
5. inspect failures and fix the highest-value blockers quickly

## Ground Rules

1. Do not claim a capability is live unless there is code, persistence, and a visible operator/debug path for it.
2. Prioritize operational truth over breadth.
3. Hardcode deterministic portal behavior before adding AI fallback.
4. Prefer fixes that improve Greenhouse, Lever, and Workday execution over peripheral product work.
5. Every material code batch must end with verification:
   - `npm run test:apply-engine`
   - `python3 -m py_compile $(find apply_engine -name '*.py')`
   - `npm run build`

## Active Roles

### 1. Product Operator

Owns:

- deciding the next MVP-critical slice
- keeping UI claims honest
- choosing what is blocked vs merely incomplete

Current focus:

- real apply execution
- real run triage
- real queue operation

### 2. App Platform Agent

Owns:

- Next.js routes
- Supabase reads/writes
- dashboard and apply-lab operator surfaces
- readiness summaries
- queue endpoints

Done enough to rely on:

- onboarding persistence
- dashboard/apply-lab shells
- apply run persistence
- queue claim/process flow

Still responsible for:

- better operator UX for queued runs
- keeping dashboard data honest
- worker/run diagnostics

### 3. Apply Engine Agent

Owns:

- Python FastAPI contract
- Playwright execution
- portal detection
- portal-specific field strategies
- multi-step navigation
- recovery behavior

Current supported real portals:

- Greenhouse
- Lever
- Workday

Current execution goals:

- maximize real submit success on vetted jobs
- reduce ambiguous validation failures
- attach enough metadata to debug a failure from the dashboard alone

### 4. Research / Normalization Agent

Owns:

- translating ATS question phrasing into normalized field families
- maintaining selector maps and hint aliases
- feeding implementation-grade findings back into code

This role does not mark features done. It only improves execution quality.

### 5. Operator Tooling Agent

Owns:

- vetted live test job sets
- local queue runner commands
- scripts that make repeated real runs faster
- admin-style visibility for recovery/failure trends

## Working Order

When time is limited, work in this order:

1. Apply execution reliability
2. Queue operation and run visibility
3. Confirmation / approval loop
4. Dashboard honesty and operator tooling
5. Scraping / job-source breadth
6. Marketing / landing page polish

## Definition of MVP Done

Twin is MVP-ready when all of the following are true:

1. A user can complete onboarding and land on a truthful dashboard.
2. The system can queue applications from a real matched/vetted job set.
3. A local or hosted worker can process queued applications repeatably.
4. Greenhouse and Lever have stable happy-path success on vetted public jobs.
5. Workday is at least partial but operationally triaged with clear failure metadata.
6. Failures show:
   - portal
   - blocked step
   - blocked family
   - recovery family attempted
   - screenshots
   - whether the root cause was profile data vs automation
7. The confirm-to-apply flow is real, even if messaging is still partial.
8. If Twin cannot answer a required application prompt safely, it must surface that prompt for user follow-up instead of pretending the run is fully autonomous.

## What Not To Do

Do not spend MVP time on:

- broad new scraper expansion before apply reliability is solid
- billing/Stripe
- polished growth features
- AI-heavy answer generation where deterministic answers are enough
- adding more portal types before Greenhouse + Lever are consistently good

## Session Handoff Rule

At the end of any major session:

1. Update `PLANS.md`
2. Update `docs/master-planning.md` if platform truth changed
3. Record:
   - what was finished
   - what remains blocked
   - exact next step
   - exact verification run
