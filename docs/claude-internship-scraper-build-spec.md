# Claude Build Spec: Internship Source Scraper

Use this document when handing the internship source-scraper work to Claude.

This is not a generic product brief. It is an implementation brief for adding live job-source ingestion to `Twin` on top of the code that already exists in this repo.

## Objective

Build a low-cost, high-signal internship job scraper system that:

- discovers internship and new-grad postings from the major ATS ecosystems
- normalizes them into Twin's existing ingest schema
- pushes them through the existing `/api/jobs/ingest` route
- dedupes safely
- runs on cheap scheduled infrastructure
- avoids browser automation for listing discovery unless absolutely necessary

The scraper system is for job discovery, not application submission. Submission is already handled separately by the apply engine.

## Current Repo Truth

Claude must treat these as already implemented and build on top of them instead of rebuilding them:

- ingest API: `app/api/jobs/ingest/route.ts`
- ingest schema + upsert mapping: `lib/job-ingest.ts`
- portal detection helpers: `lib/portal.ts`
- generic batch ingest script: `apply_engine/scripts/ingest_jobs.py`
- seed ingest adapter: `apply_engine/scripts/ingest_seed_jobs.py`
- scheduled workflow: `.github/workflows/twin-operations.yml`
- jobs table materialization helper: `lib/jobs.ts`
- apply engine and queue stack already exist and are out of scope for this work

Claude must preserve the existing contract used by `JobIngestPayload` in `apply_engine/scripts/ingest_jobs.py` and the Zod schema in `lib/job-ingest.ts`.

## Non-Goals

Do not spend time on these in the scraper workstream:

- rewriting the apply engine
- changing the user-facing dashboard copy
- replacing the current ingest API with direct DB writes
- using AI for listing discovery
- building a browser-based crawler first
- scraping every job site on the internet

## Product Constraints

The system should be:

- cheap
- deterministic
- easy to run locally
- easy to schedule from GitHub Actions
- idempotent
- source-aware

Default operating model:

- `Supabase` remains the system of record
- `Next.js` remains the authenticated ingest surface
- `GitHub Actions` remains the scheduler
- scraping should be plain HTTP + parsing wherever possible
- Playwright should be a last resort for listing discovery

## Core Design Principle

Separate the system into two planes:

1. Discovery plane
   - find internship postings
   - normalize them
   - emit `JobIngestPayload` records

2. Apply plane
   - take known application URLs
   - detect portal
   - queue applications
   - run portal-specific apply agents

The discovery plane should be much cheaper and simpler than the apply plane.

## Portal Priority Order

Build in this order:

1. Greenhouse
2. Lever
3. Workday
4. Handshake
5. Optional later: LinkedIn, Indeed, iCIMS, SmartRecruiters, company websites

Reason:

- Greenhouse and Lever are usually the highest-value deterministic sources
- Workday matters, but discovery is often more inconsistent
- Handshake may need special handling and should come after the first three are reliable

## Required Architecture

Claude should implement a scraper subsystem with this shape:

```text
apply_engine/
  sources/
    base.py
    greenhouse.py
    lever.py
    workday.py
    handshake.py
    common.py
    registry.py
  scripts/
    scrape_jobs.py
    scrape_and_ingest_jobs.py
  tests/
    test_sources_*.py
    fixtures/
      source_*.json
      source_*.html
```

If Claude wants a different filename layout, that is acceptable only if:

- the separation between source adapters is preserved
- the scripts remain usable from GitHub Actions
- the output contract remains compatible with the existing ingest pipeline

## Required Output Contract

Every source adapter must return normalized job dictionaries matching this shape:

```json
{
  "company": "Acme",
  "title": "Software Engineering Intern",
  "level": "internship",
  "location": "San Francisco, CA",
  "url": "https://source.example/job/123",
  "application_url": "https://source.example/job/123/apply",
  "remote": false,
  "industries": ["SWE"],
  "portal": "greenhouse",
  "jd_summary": "Short summary or notes",
  "posted_at": "2026-03-29T00:00:00.000Z",
  "salary_range": null,
  "tags": ["internship", "source:greenhouse"],
  "deadline": null,
  "headcount": null,
  "source": "greenhouse_source_sync"
}
```

The minimum required fields are:

- `company`
- `title`
- `level`
- `location`
- `url`
- `application_url`

Claude must reuse the existing server-side validation rather than inventing a parallel schema.

## Source Adapter Responsibilities

Each source adapter must do all of the following:

1. Accept a source configuration object.
2. Fetch listing data using the cheapest deterministic mechanism available.
3. Parse only internship/new-grad/co-op/part-time roles relevant to Twin.
4. Normalize each listing into the ingest payload shape.
5. Canonicalize URLs before returning them where practical.
6. Attach source metadata in `tags` or `source`.
7. Avoid emitting duplicates within a single scrape run.
8. Return structured diagnostics:
   - source name
   - company/board
   - number fetched
   - number filtered out
   - number emitted
   - warnings/errors

## Discovery Strategy Rules

Claude must follow these rules:

### Rule 1: Prefer structured endpoints over HTML scraping

If a portal exposes a structured feed or listing payload, use it.

Only fall back to HTML parsing when no structured payload is available.

### Rule 2: Do not use Playwright for listing discovery first

Playwright is expensive and fragile compared to direct HTTP parsing.

Use Playwright for discovery only if:

- the source is high-value
- the listing content is not otherwise retrievable
- plain HTTP parsing is proven insufficient

### Rule 3: Filter aggressively at the source layer

Only emit roles relevant to Twin's internship/new-grad positioning:

- internships
- new grad
- co-op
- part-time early-career roles

Reject or downrank:

- senior roles
- staff/principal roles
- clearly irrelevant job families

### Rule 4: Prefer stable company/board-level configs

Do not start with a global internet crawler.

Start with a curated source-config model such as:

```json
[
  {
    "id": "scaleai-greenhouse",
    "portal": "greenhouse",
    "company": "Scale AI",
    "board_url": "https://job-boards.greenhouse.io/scaleai",
    "enabled": true
  }
]
```

This should live in a repo-managed config file so GitHub Actions can run deterministically.

## Recommended Source Config

Claude should add a source configuration file, for example:

`data/job-sources/internship-sources.json`

Each record should include:

- `id`
- `portal`
- `company`
- `board_url`
- `enabled`
- `default_location` optional
- `default_industries` optional
- `notes` optional

Optional future fields:

- `region`
- `role_keywords`
- `exclude_keywords`
- `remote_policy`
- `priority`

## Portal-Specific Expectations

Claude should implement each source adapter with these expectations.

### Greenhouse

Expectations:

- scrape company board listings deterministically
- extract job title, office/location, posting URL, and posted date if available
- infer `portal = "greenhouse"`
- infer `level` from title/description keywords
- prefer structured listing data if the board exposes it
- otherwise parse the board HTML

Must support:

- board-level listing fetch
- internship filtering
- application URL extraction

### Lever

Expectations:

- fetch company listing data without browser automation
- infer `portal = "lever"`
- map team/location/commitment metadata where available
- infer `level` from title and any available categories

Must support:

- company-level listing discovery
- internship/new-grad/co-op filtering
- normalized posting URL output

### Workday

Expectations:

- build a practical adapter, not an overengineered universal crawler
- support a config-driven list of Workday career pages or endpoints
- tolerate varying URL shapes
- treat Workday as `partial` until verified against multiple real boards

Must support:

- a board-config-driven fetch path
- structured diagnostics for failures
- safe skipping when the source cannot be scraped deterministically

### Handshake

Expectations:

- treat Handshake as lower-confidence unless a stable deterministic feed is available
- do not build an account-login-dependent flow first
- keep it behind an adapter boundary so it can stay disabled without affecting the rest of the system

If Handshake is not safely automatable for public listing discovery, Claude should:

- build the adapter scaffold
- mark it non-operational
- add explicit TODOs and tests for disabled behavior

## Filtering Rules

Claude should centralize filtering logic in a shared module.

At minimum, implement:

- include keywords:
  - `intern`
  - `internship`
  - `new grad`
  - `co-op`
  - `coop`
  - `university`
  - `campus`
- exclude keywords:
  - `senior`
  - `staff`
  - `principal`
  - `manager`
  - `director`

Filtering should not be title-only if listing metadata provides role family or commitment details.

## Normalization Rules

Claude should centralize these:

- infer `level` from title and metadata
- infer `remote` from location text or remote tags
- infer `industries` using the same style already used in `ingest_seed_jobs.py`
- canonicalize URLs
- attach `source`
- attach stable tags such as:
  - `source:greenhouse`
  - `source:lever`
  - `sync:scheduled`

## Idempotency Rules

The scraper system must be safe to run multiple times per day.

Claude must ensure:

- duplicate source records are collapsed before ingest
- URL canonicalization happens before emit
- the existing `jobs.url` uniqueness constraint remains the final dedupe gate
- source adapters return deterministic ordering where possible

## Scheduling Model

Claude should build for this scheduling shape:

1. GitHub Actions runs a Python script.
2. The script loads configured sources.
3. It scrapes enabled sources.
4. It writes normalized results to a temporary JSON payload in memory or disk.
5. It calls `apply_engine/scripts/ingest_jobs.py`.
6. Twin's `/api/jobs/ingest` handles DB upsert + matching + alert creation.

Do not bypass the ingest API in scheduled jobs.

## Scripts Claude Should Add

Claude should add two high-level scripts:

### `apply_engine/scripts/scrape_jobs.py`

Purpose:

- scrape configured sources
- emit normalized jobs to stdout or a JSON file

Required flags:

- `--sources-file`
- `--output-file`
- `--portal` optional
- `--limit` optional
- `--company` optional

### `apply_engine/scripts/scrape_and_ingest_jobs.py`

Purpose:

- scrape configured sources
- immediately feed the normalized jobs into `process_batch()`

Required flags:

- `--sources-file`
- `--base-url`
- `--worker-secret`
- `--portal` optional
- `--company` optional
- `--concurrency` optional

This script should reuse `process_batch()` instead of duplicating ingest logic.

## GitHub Actions Changes Claude Should Make

Claude should extend `.github/workflows/twin-operations.yml` or add a sibling workflow so that:

- repo-seed ingest can remain as a simple fallback
- live source scrape-and-ingest can run separately
- failures are visible in logs
- the workflow can be run manually

Recommended job layout:

1. `ingest-seed-jobs`
2. `scrape-live-sources`
3. `expire-alerts`

The live scrape job should be safe to keep disabled until source configs exist.

## Tests Claude Must Add

This work is not complete without tests.

Claude must add:

### Unit tests

- level inference
- internship/new-grad filtering
- URL canonicalization
- source config parsing
- per-portal normalization logic
- duplicate collapse within a scrape result

### Fixture tests

- one or more Greenhouse listing payload fixtures
- one or more Lever listing payload fixtures
- one or more Workday fixtures if implemented
- expected normalized output snapshots

### Script tests

- `scrape_jobs.py` CLI argument handling
- `scrape_and_ingest_jobs.py` end-to-end orchestration with mocked HTTP client

### Failure-path tests

- source fetch timeout
- malformed payload
- empty listing response
- partial source failure with other sources succeeding

## Logging and Diagnostics Requirements

Every run should surface:

- number of sources attempted
- number of sources succeeded
- number of jobs fetched raw
- number of jobs emitted after filtering
- number of jobs ingested successfully
- number of jobs rejected
- per-source warnings

Claude should not add a complicated observability stack for this. Structured stdout logging is enough for now.

## Acceptance Criteria

The scraper work is only complete when all of these are true:

1. At least one real Greenhouse source can be scraped and ingested on demand.
2. At least one real Lever source can be scraped and ingested on demand.
3. The resulting jobs land in `jobs` through `/api/jobs/ingest`.
4. Running the scraper twice does not create duplicates.
5. The scripts run cleanly from GitHub Actions.
6. Tests cover the normalization and filtering logic.
7. Existing `npm run build` and `npm run test:apply-engine` still pass.

## Explicit Build Order For Claude

Claude should implement in this order:

1. Add `data/job-sources/internship-sources.json`
2. Add source base types and shared normalization/filter helpers
3. Implement Greenhouse source adapter
4. Add Greenhouse fixtures and tests
5. Implement Lever source adapter
6. Add Lever fixtures and tests
7. Add `scrape_jobs.py`
8. Add `scrape_and_ingest_jobs.py`
9. Add GitHub Actions support for live source scraping
10. Add Workday adapter only after Greenhouse and Lever are reliable
11. Leave Handshake disabled or scaffolded unless a deterministic public path is confirmed

## Engineering Guardrails

Claude must not:

- write directly to Supabase from the scraper scripts
- introduce AI-based listing parsing
- require Playwright for Greenhouse or Lever listing discovery
- overfit to one company board if the adapter can be generalized cheaply
- break the existing seed ingest path

Claude should:

- keep adapters narrow and deterministic
- keep source configs explicit
- prefer composable helpers over giant portal-specific files
- add tests before broadening portal coverage

## What Claude Should Report Back

Ask Claude to return:

1. what files it changed
2. what source adapters are real vs scaffolded
3. what commands it ran
4. what tests passed
5. what known gaps remain

## Pasteable Claude Prompt

Use this prompt with Claude:

---

You are working inside the `Twin` repo. Build the live internship source scraper subsystem on top of the existing ingest pipeline.

Read these files first:

- `docs/master-planning.md`
- `docs/claude-internship-scraper-build-spec.md`
- `README.md`
- `apply_engine/README.md`
- `app/api/jobs/ingest/route.ts`
- `lib/job-ingest.ts`
- `apply_engine/scripts/ingest_jobs.py`
- `.github/workflows/twin-operations.yml`

Constraints:

- Reuse the existing ingest API and payload schema.
- Do not write directly to Supabase from scraper scripts.
- Prefer deterministic HTTP parsing over Playwright.
- Build Greenhouse first, then Lever.
- Add tests for every adapter and script.
- Preserve the existing seed-ingest path.
- Keep Workday partial unless you can prove a stable deterministic discovery path.
- Treat Handshake as scaffold-only unless public deterministic scraping is viable.

Implement:

1. source config file for live internship sources
2. source adapter base layer
3. Greenhouse source adapter
4. Lever source adapter
5. fixture-backed tests
6. scrape-only CLI
7. scrape-and-ingest CLI
8. GitHub Actions workflow support for scheduled live scraping

Definition of done:

- one real Greenhouse board works
- one real Lever board works
- output is normalized to the existing ingest schema
- jobs ingest through `/api/jobs/ingest`
- repeated runs are idempotent
- tests pass
- `npm run build` still passes

Return:

- files changed
- commands run
- tests passed
- remaining gaps

---
