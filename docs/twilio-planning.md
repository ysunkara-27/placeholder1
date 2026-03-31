# Twin Messaging System (Twilio-First) — Full Project Spec
> Goal: real-time internship alerting and one-reply application confirmation over SMS, with a production-safe state machine, clear data ownership, and deterministic backend behavior.

---

## Overview

Twin uses SMS as the fastest decision surface between "job matched" and "start application flow."
This spec defines every major piece needed to run Twilio end to end:

- outbound alert messages
- inbound reply parsing (YES/NO/STOP/unknown)
- Supabase state transitions (`alerts`, `applications`, `profiles`)
- queue handoff into apply execution
- expiration and safety rails
- data sourcing and matching constraints

This document is Twilio-first but compatible with provider abstraction (`plivo` or `twilio`), with Twilio as the target production channel.

---

## Product Goal for Twilio

1. Notify eligible users immediately when a matched job appears.
2. Let users confirm intent with one SMS reply.
3. Convert "YES" into a queued apply task with no manual dashboard action required.
4. Keep behavior predictable and safe with strict parsing and explicit status transitions.
5. Maintain compliance basics (STOP opt-out handling and no unintended auto-apply).

Product policy for launch:

- SMS is the primary real-time decision channel for paid tiers; email/app are fallback channels.
- Only explicit positive intent tokens trigger apply queueing.
- Webhook authenticity, phone canonicalization, and queue scheduling are launch-blocking requirements.

---

## Core Architecture

```text
[Job Ingest API]
   -> parse + normalize job
   -> upsert to jobs
   -> match against all onboarding_completed profiles
   -> create alerts(status=pending)
   -> send outbound SMS via Twilio

[User receives SMS]
   -> replies YES / NO / STOP / other

[Messaging Reply Webhook]
   -> identify sender by phone
   -> resolve latest pending alert
   -> action:
      YES  -> alerts.confirmed + queue application
      NO   -> alerts.skipped
      STOP -> profiles.sms_opt_in=false + expire pending alerts
      other-> prompt user for YES/NO/STOP

[Queue Processor]
   -> claim queued applications
   -> run apply engine
   -> write applications final status
```

---

## Existing Backend Components (Current Code Alignment)

- `app/api/jobs/ingest/route.ts`
  - creates alerts after match and sends SMS when `sms_opt_in && phone`.
- `lib/alerts.ts`
  - constructs SMS body, creates alerts, records response channel and message id.
- `lib/messaging/send.ts`
  - provider send logic; Twilio uses `/Messages.json` with basic auth.
- `app/api/messaging/reply/route.ts`
  - inbound SMS webhook; detects Twilio header and handles YES/NO/STOP.
  - important: currently does not verify Twilio signatures server-side.
- `lib/messaging/reply.ts`
  - token normalization and phone normalization helpers.
- `app/api/internal/cron/expire-alerts/route.ts`
  - expires stale pending alerts.
- `app/api/internal/cron/process-queue/route.ts`
  - drains queued applications.

### Current System Truth (must stay aligned while implementing)

- provider routing in `sendSms` is global (`SMS_PROVIDER` env), not per-profile.
- `profiles.sms_provider` exists in schema but is not used for runtime send selection.
- onboarding persistence currently defaults `sms_provider` to `plivo` when phone is present.
- STOP behavior is implemented; START re-enable is not implemented yet.
- queue drain route exists, but scheduler wiring for it must be explicitly configured.

Target-state decisions (this spec):

- Twilio is default production provider (`SMS_PROVIDER=twilio` in deployed envs).
- START is an implemented command, not just aspirational copy.
- terminal application outcomes mirror into `alerts.status` for unified reporting.

---

## Twilio Scope and Non-Goals

### In Scope

- transactional alerting (new match)
- reply command flow
- statusful backend orchestration
- provider-level send/receive integration
- logging and operational traceability

### Out of Scope (for this layer)

- full marketing/SMS campaign features
- advanced segmentation UI
- deep deliverability analytics dashboards
- custom Twilio Studio flows (backend-driven flow is preferred)

---

## Frontend directory system (components, views, CSS)

Twin is a **Next.js 15 App Router** app. There is **no separate `views/` folder** — **route-level screens live under `app/`** as `page.tsx` files. Reusable UI lives under **`components/`**. Shared logic lives under **`lib/`**.

### Conventions (authoritative)

| Concern | Where it goes | Notes |
|--------|----------------|-------|
| **Route / “view” (full page)** | `app/<segment>/page.tsx` | e.g. `app/dashboard/page.tsx`, `app/onboarding/page.tsx`. These compose components and call APIs. |
| **Layouts (shared chrome)** | `app/layout.tsx`, optional nested `app/<segment>/layout.tsx` | Root layout imports global CSS. |
| **Global CSS** | `app/globals.css` | Tailwind directives + any app-wide base styles. **Prefer Tailwind utilities** in components over ad-hoc global CSS. |
| **Feature UI components** | `components/<feature>/` | Group by domain: `onboarding/`, `dashboard/`, `apply/`, `resume/`, `auth/`. |
| **Primitive UI** | `components/ui/` | Buttons, inputs, badges — reusable across features. |
| **Twilio / SMS-specific UI** | **Recommended:** `components/messaging/` | Does not exist yet; add here for SMS prefs, alert previews, delivery status, STOP/START copy. Avoid scattering SMS-only UI across unrelated folders. |
| **API routes (backend)** | `app/api/**/route.ts` | Includes `app/api/messaging/reply/route.ts`, `send-alert`, etc. Not React components. |
| **Shared non-UI code** | `lib/` | e.g. `lib/messaging/*`, `lib/alerts.ts`, `lib/env.ts`. |
| **Tailwind config** | `tailwind.config.ts` | Theme, content paths, plugins. |
| **PostCSS** | `postcss.config.mjs` | Required for Tailwind pipeline. |

### Current repo layout (relevant to messaging / Twilio work)

```text
app/
  layout.tsx              # Root layout; imports globals.css
  globals.css             # Global styles + Tailwind layers
  page.tsx                # Landing
  dashboard/page.tsx      # Dashboard “view”
  onboarding/page.tsx     # Onboarding flow (phone, notifications, etc.)
  apply-lab/page.tsx
  auth/page.tsx
  api/
    messaging/
      reply/route.ts      # Twilio/Plivo inbound webhook
      send-alert/route.ts # Internal outbound trigger
    jobs/ingest/route.ts
    internal/cron/...

components/
  onboarding/             # step-phone, step-notifications, …
  dashboard/                # lists, stats (applications, alerts surface here)
  apply/
  ui/                       # shared primitives
  auth/

lib/
  messaging/              # send, reply parsing, provider selection
  alerts.ts
  ...
```

### Where to add new files for Twilio-related product UI

1. **New page** (e.g. `/settings/notifications` or `/alerts`): add `app/<route>/page.tsx` and optionally `app/<route>/layout.tsx`.
2. **New reusable block** (SMS preview card, opt-in toggle, message template preview): add under `components/messaging/` (create folder) or extend `components/onboarding/` if it is strictly onboarding-step UI.
3. **Styles**: use **Tailwind classes in the component**; only add to `app/globals.css` for true globals (fonts, CSS variables, resets). For feature-scoped one-offs, prefer Tailwind + `clsx`/`cn` patterns already used in the codebase.
4. **Do not** introduce a parallel `views/` or `css/` tree at repo root unless the project explicitly migrates — it would diverge from existing Next.js conventions.

### Summary

- **Views** = `app/**/page.tsx`
- **Components** = `components/**`
- **Global CSS** = `app/globals.css` + Tailwind (`tailwind.config.ts`, `postcss.config.mjs`)
- **Twilio messaging UI** = standardize on `components/messaging/` (when you add it) + existing `components/onboarding/` for phone/SMS prefs

---

## End-to-End Flow Spec

### 0) Daily Prospective Jobs List (curation layer before messaging + apply)

This system introduces a **daily curated list** of jobs per user, called a *prospective list*.
Messaging now happens **after** a prospective list is created (daily), not per-job in real time.

Core idea:

- discovery/ingest produces `jobs`
- matching produces a ranked set of *candidates*
- Twin selects top N candidates into a per-user daily list
- user can opt out of specific numbered items by SMS before cutoff time
- Twin applies only to the final confirmed list
- Twin sends a results summary including any jobs blocked by missing/unclear answers

This reduces entropy by batching decisions and creating an explicit approval window.

#### Terminology

- **candidate**: a job that matches user preferences with a score and explanation (not yet user-approved)
- **prospective list**: the daily numbered list sent to the user for review
- **final list**: prospective list minus user-skipped items at cutoff
- **blocked application**: apply engine requires an answer Twin does not have (gray/unclear field)

#### User-configurable cadence

Each user has:

- `daily_digest_enabled` (default true for SMS users)
- `daily_digest_time_local` (e.g. `18:30`)
- `daily_digest_timezone` (IANA, e.g. `America/New_York`)
- `daily_review_window_minutes` (default 60; during this window user can reply with skips)

Policy:

- if window is 0 minutes, treat as Turbo auto mode (apply immediately after sending list)
- otherwise, wait until cutoff before queueing applications

---

### 1) Job Enters System

Source: `POST /api/jobs/ingest` (secured with `APPLY_QUEUE_WORKER_SECRET`).

Payload is validated and normalized:

- `level` constrained to: `internship | new_grad | co_op | part_time`
- `industries[]` deduped and trimmed
- `application_url` canonicalized
- `portal` inferred from URL if omitted

Then:

1. upsert into `jobs`
2. select `profiles` where `onboarding_completed = true`
3. run `matchJobToProfile(job, profile)`
4. for matches:
   - do not immediately send per-job SMS in digest mode
   - instead, create or update the user’s next prospective list batch
   - record candidate scoring + provenance for explainability

Digest-mode note:

- The current repo has real-time alert rows (`alerts`) and per-job SMS sends.
- With prospective lists, `alerts` becomes the digest-message lifecycle (one per list) and/or can be deprecated in favor of `prospective_lists` + `prospective_list_items` (see Data Model).

---

### 2) Outbound SMS Delivery

Message template (`lib/alerts.ts`):

```text
Twin found a match:

{company} — {title}
{location} | {level}

Reply YES to apply, NO to skip.
Reply STOP to pause alerts.
```

Twilio send API call:

- endpoint: `https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json`
- form params: `From`, `To`, `Body`
- auth: HTTP basic (`AccountSid:AuthToken`)

On success:

- set `alerts.response_channel = 'sms'`
- store provider message identifier in `alerts.metadata.message_id`

Delivery contract:

- `To` must be canonical E.164.
- transient provider failures retry with backoff: `30s -> 2m -> 10m` (max 3 attempts).
- non-retryable failures (`invalid number`, `opted out`) do not retry.
- fallback policy: if SMS fails and user has email, send one email fallback and record reason in metadata.

---

### 3) Inbound Reply Webhook

Route: `POST /api/messaging/reply`

Incoming parsing:

- provider detect:
  - Twilio if `x-twilio-signature` header exists
  - current behavior: header presence is detection only
  - required production behavior: validate signature against auth token and webhook URL (invalid signature => no state mutation)
- fields:
  - `From`
  - `Body`

Action normalization:

- confirm tokens: `yes, y, yep, yeah, yup, sure, ok, okay, apply, go`
- skip tokens: `no, n, nope, skip, pass, next, not interested`
- stop tokens: `stop, unsubscribe, cancel, quit, end, stopall`
- start tokens: `start, unstop, resume`

Digest reply grammar (skip-by-number):

- `SKIP 2` or `NO 2` => skip item #2 from the latest active prospective list
- `SKIP 2,5,7` => skip multiple items
- `SKIP ALL` => skip all items (no applies today)
- `APPLY ALL` or `YES` => confirm applying to all remaining items immediately (before cutoff)
- `HELP` => return usage help

Parsing rules:

- ignore punctuation; accept spaces and commas
- numbers refer to the list item index in the digest SMS (1-based)
- if numbers are out of range, respond with guidance and do not mutate state

Behavior:

- unknown sender -> no-op 200
- no pending alert -> no-op 200
- STOP:
  - `profiles.sms_opt_in = false`
  - expire all pending alerts for user
  - return TwiML unsubscribe confirmation
- START:
  - `profiles.sms_opt_in = true`
  - return TwiML re-subscribe confirmation
- YES:
  - set alert status to `confirmed`
  - build applicant payload from profile
  - queue application row (`applications.status='queued'`)
  - return TwiML confirmation
- NO:
  - set alert status to `skipped`
  - return TwiML acknowledgment
- unknown text:
  - TwiML prompt: "Reply YES to apply, NO to skip, or STOP to pause alerts."

Digest behavior (authoritative):

- replies are interpreted against the **latest active prospective list** in `status='sent'` and before cutoff
- skip commands mutate `prospective_list_items.user_decision='skip'`
- apply-all confirms immediately and queues applications for all non-skipped items
- after cutoff, reply commands apply to the next day’s list (or return a “window closed” message)

Idempotency contract:

- confirm/skip transitions only execute when current alert status is `pending`.
- duplicate YES webhook deliveries for same pending alert must not create duplicate application queue records.
- unknown sender or no pending alert remains no-op (no writes).

---

### 4) Apply Queueing (from final prospective list)

At cutoff (or on APPLY ALL), Twin queues applications for each item in the final list.

Queue input:

- `applications.request_payload` is built from:
  - user profile (`profiles` fields + `resume_json`)
  - job application URL (`jobs.application_url`)

Queue rules:

- one application per `(user_id, job_id)` active row
- retries handled by queue processor; do not enqueue duplicates

---

### 5) Apply Execution + Blocking Gray/Unclear Areas

Apply engine may require answers Twin does not have.
This must surface as a **blocked** outcome, not a silent failure.

Blocking policy:

- if apply engine returns `requires_auth` => treated as blocked; include in results summary
- if apply engine returns validation/required-field error because a custom answer is missing
  - classify as `blocked_missing_answer`
  - record required prompt(s) and field family in `applications.last_error` and `apply_runs.result_payload.summary`

Result semantics:

- `applied` = submitted successfully
- `blocked` = requires auth or missing/unclear answer (not safe to guess)
- `failed` = automation failure not attributable to missing user data

Note: current DB `applications.status` supports `requires_auth` but not a distinct `blocked_missing_answer`. For robustness, either:

- extend status vocabulary, or
- encode blocked subtype in `applications.last_error` + structured metadata.

---

### 6) Results Summary SMS (final applied list + blocked list)

After processing the day’s final list, send the user a summary:

- which jobs were applied to successfully (with confirmation snippets where available)
- which jobs were not applied and why:
  - requires auth
  - missing/unclear answer (include the exact question prompt(s))
  - automation failure

Template (example):

```text
Twin daily apply results:

✅ Applied (3)
1) Stripe — SWE Intern (NYC)
2) Figma — Data Intern (Remote)
3) Apple — PM Intern (Austin)

⚠️ Blocked (2)
4) Workday — SWE Intern (requires login)
5) Jane Street — SWE Intern (needs answer: “Are you legally authorized to work in the US?”)

Reply HELP for commands.
```

---

### 6a) Prospective List SMS (daily digest) — exact copy and structure

Outbound SMS body should be short, numbered, and command-hinting.

Template:

```text
Twin daily matches:

1) Stripe — SWE Intern — NYC
2) Figma — Data Intern — Remote
3) Apple — PM Intern — Austin

Reply:
- APPLY ALL to apply to all
- SKIP 2 or SKIP 1,3 to skip
- STOP to pause alerts
```

Length constraints:

- Aim to keep within a single SMS when possible; if > 3–4 items, consider:
  - limiting to top N and saying `+ X more in dashboard`, or
  - sending multiple messages, but with the same numbering semantics.

JSON representation (internal, not user-facing):

```json
{
  "list_id": "uuid",
  "user_id": "uuid",
  "date": "2026-04-01",
  "sent_at": "2026-04-01T18:30:00Z",
  "cutoff_at": "2026-04-01T19:30:00Z",
  "items": [
    {
      "index": 1,
      "job_id": "uuid-job-1",
      "company": "Stripe",
      "title": "SWE Intern",
      "location": "New York, NY",
      "remote": false,
      "portal": "greenhouse",
      "match_score": 87,
      "match_reasons": ["Industry match: SWE", "Location match: New York"],
      "match_rejections": [],
      "user_decision": "pending"
    },
    {
      "index": 2,
      "job_id": "uuid-job-2",
      "company": "Figma",
      "title": "Data Intern",
      "location": "Remote",
      "remote": true,
      "portal": "lever",
      "match_score": 82,
      "match_reasons": ["Industry match: Data", "Remote role accepted"],
      "match_rejections": [],
      "user_decision": "pending"
    }
  ]
}
```

Parsing helper expectations:

- reply parser receives:
  - the raw text
  - the **active prospective list id**
  - the mapping from index → `prospective_list_items.id`
- it outputs:
  - high-level action (`apply_all`, `skip_items`, `stop`, `start`, `help`)
  - affected item indexes (for `skip_items`)

Example parsed command:

```json
{
  "action": "skip_items",
  "item_indexes": [2, 3]
}
```

The webhook handler then:

- validates indexes against the active list
- writes `user_decision='skip'` for those items
- leaves others as `pending` until cutoff or APPLY ALL.

---

### 7) Queue and Apply Execution (existing runtime)

Internal queue drain route claims queued applications and runs apply engine.

Result mapping:

- `applied` -> `applications.status='applied'`
- `requires_auth` -> `applications.status='requires_auth'`
- `failed` -> `applications.status='failed'`

Operationally this is independent of Twilio transport, but Twilio is what creates most queue demand through YES replies.

---

### 5) Phone Canonicalization Contract (critical integration rule)

All phone handling must use one canonical format (E.164) across write/read/send boundaries.

Required rules:

- write path: normalize onboarding phone to E.164 before storing in `profiles.phone`
- read path: inbound `From` values normalize to same canonical representation
- send path: always send E.164 `To` values to Twilio
- lookup path: `findProfileByPhone` must compare canonicalized forms

Canonical representation for launch:

- US-only scope: `+1XXXXXXXXXX`
- onboarding rejects non-US numbers until international support is explicitly enabled
- one-way normalization occurs before persistence so all downstream services receive canonical values

Current risk if not enforced:

- inbound replies fail to map to profiles
- outbound sends fail or misroute for non-E.164 numbers

---

### 6) Provider Truth Model (Twilio-first vs abstraction)

Target product stance:

- Twilio-first production channel for SMS

Current code stance:

- provider selected globally by `SMS_PROVIDER`
- defaults still point to Plivo in persistence/env examples

Required alignment actions:

1. set Twilio defaults for Twilio-first environments
2. keep provider abstraction for fallback/testing
3. per-profile provider routing is out of scope for MVP; provider selection is global by env

---

### 7) Idempotency and Concurrency Rules

Webhook providers may retry delivery. Queue workers may run concurrently.
The system must be safe under both conditions.

Required rules:

- confirm/skip transitions should only apply when alert is `pending`
- duplicate YES replies should not create duplicate queue work for same `(user_id, job_id)`
- queue claim remains lock-safe via `for update skip locked`
- internal cron/auth routes must reject unauthorized requests

---

### 8) Alert <-> Application Status Synchronization

Current behavior:

- YES updates `alerts.status` to `confirmed`
- apply execution updates `applications.status`
- `alerts.status` is not automatically mirrored to `applied/failed` in current queue completion path

Policy (implemented requirement):

- `alerts` remains the user decision record and also mirrors terminal execution outcomes.
- on application terminal success: set `alerts.status='applied'`.
- on application terminal failure: set `alerts.status='failed'`.
- `applications` remains source of detailed execution state and diagnostics.

---

## Supabase Data Model (Messaging-Relevant)

## `profiles`

Key fields:

- `id` (user id)
- `phone`
- `notification_pref` (`sms` or `email`)
- `sms_provider` (`plivo` or `twilio`)
- `sms_opt_in` (boolean)
- preference fields used in matching:
  - `industries[]`, `levels[]`, `locations[]`, `remote_ok`, `gray_areas`
- `resume_json`, contact fields, work auth fields

Persistence rule:

- `phone` is stored in canonical E.164 format only.
- `sms_provider` for Twilio-first deployments should default to `twilio`.

Additional fields for digest:

- `daily_digest_enabled` (boolean, default true for SMS-pref users)
- `daily_digest_time_local` (string, `HH:MM`)
- `daily_digest_timezone` (string, IANA)
- `daily_review_window_minutes` (integer, default 60)

## `jobs`

Key fields:

- role metadata: `company`, `title`, `level`, `location`, `remote`, `industries[]`
- links: `url`, `application_url`
- enrichment: `jd_summary`, `portal`, `metadata`
- timestamps: `posted_at`, `scraped_at`

## `alerts`

Key fields:

- relation: `user_id`, `job_id` (unique pair)
- state: `status` in `pending | confirmed | skipped | expired | applied | failed`
- channel: `response_channel` (`sms | email | app`)
- lifecycle times: `alerted_at`, `replied_at`, `expires_at`
- metadata blob for provider ids and debug context

In digest mode, `alerts` can either be:

- one row per digest (recommended), or
- superseded by `prospective_lists` as the primary digest lifecycle table.

## `applications`

Key fields:

- relation: `user_id`, `job_id`
- execution: `status` in `queued | running | requires_auth | applied | failed`
- queue metadata: `request_payload`, `attempt_count`, `worker_id`, `last_run_id`
- result metadata: `confirmation_text`, `last_error`, `applied_at`, timing columns

## `apply_runs`

Audit table for plan/submit runs with request/result payloads and summary metadata.

## `prospective_lists` (new)

Represents a single daily prospective list per user.

Key fields:

- `id` (uuid, primary key)
- `user_id` (uuid, FK to `auth.users`)
- `date` (date, local user date)
- `status` (`pending | sent | finalized | applied`)
- `sent_at` (timestamp)
- `cutoff_at` (timestamp, review window end)
- `created_at`, `updated_at`
- optional linkage to `alerts.id` if reusing alerts as digest envelope

## `prospective_list_items` (new)

Represents one candidate job inside a prospective list.

Key fields:

- `id` (uuid, primary key)
- `list_id` (uuid, FK to `prospective_lists`)
- `job_id` (uuid, FK to `jobs`)
- `rank` (integer, 1-based index used in SMS numbering)
- `match_score` (numeric)
- `match_reasons` (jsonb)
- `match_rejections` (jsonb)
- `user_decision` (`pending | skip | confirmed`)
- `applied_application_id` (uuid, FK to `applications`, nullable)
- `blocked_reason` (text or structured jsonb: `requires_auth`, `missing_answer`, etc.)
- `created_at`, `updated_at`
---

## State Machines

### Alert State Machine

```text
pending
  -> confirmed (YES)
  -> skipped   (NO)
  -> expired   (timeout cron or STOP sweep)

confirmed
  -> applied   (application success; mirrored from applications)
  -> failed    (application failure; mirrored from applications)
```

### SMS Subscription State Machine

```text
sms_opt_in=true
  -> false (STOP)
sms_opt_in=false
  -> true  (START)
```

---

## Data Sourcing and Matching Comments (Required Product Constraints)

The following comments are normative design guidance for data provenance and deterministic matching.

### Comment A: Where job type and industries come from

- Primary source is ingest payload (`level`, `industries`).
- Secondary derivation is allowed from URL and JD text if source omits fields.
- If uncertain:
  - keep confidence score in `jobs.metadata`
  - prefer conservative categorization
  - never infer to a user-restricted category with low confidence

### Comment B: Where user preference signals come from

- Onboarding-selected fields are canonical:
  - `profiles.industries[]`
  - `profiles.levels[]`
  - `profiles.locations[]`
  - `profiles.remote_ok`
  - `profiles.gray_areas`
- Resume text (`resume_json`) can enrich ranking later but should not override explicit user settings without user approval.

### Comment C: How matching should map job data to user profile

- Hard constraints:
  - explicit exclusions (`excluded_companies`, `excluded_industries`)
  - level mismatch
  - location mismatch (unless remote accepted)
- Soft constraints:
  - unknown industry -> partial score, not auto reject
  - missing location details -> downgraded score

Matching send policy:

- SMS alerts are sent only for `matched=true` and zero hard rejections.
- matching rationale is stored in metadata for operator debugging.

### Comment D: Resume-aware matching strategy

- Use resume tags/bullets only as relevance boosts.
- Do not auto-apply solely because resume keywords overlap.
- User preference vectors (onboarding) remain the policy layer.

### Comment E: Auditing data source origin

Store provenance hints in metadata for explainability:

```json
{
  "classification": {
    "level_source": "ingest_payload",
    "industries_source": "jd_classifier_v1",
    "confidence": 0.83
  }
}
```

---

## Example Function Contracts

These are implementation-oriented examples matching current behavior.

```ts
type ReplyAction = "confirm" | "skip" | "stop" | "unknown";

function normalizeReplyText(text: string): ReplyAction;
function extractPhoneNumber(raw: string): string;
```

```ts
interface SmsSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

async function sendSms(to: string, body: string): Promise<SmsSendResult>;
```

```ts
interface MatchResult {
  matched: boolean;
  score: number;
  reasons: string[];
  rejections: string[];
}

function matchJobToProfile(job: JobRow, profile: ProfileRow): MatchResult;
```

```ts
async function createAlert(
  supabase: SupabaseClient<Database>,
  userId: string,
  jobId: string
): Promise<AlertRow>;

async function sendAlertSms(
  supabase: SupabaseClient<Database>,
  alertId: string
): Promise<{ sent: boolean; error?: string }>;
```

---

## Example JSON Payloads

### Job Ingest Request

```json
{
  "company": "Stripe",
  "title": "Software Engineering Intern - Summer 2027",
  "level": "internship",
  "location": "New York, NY",
  "url": "https://jobs.example.com/stripe/swe-intern-2027",
  "application_url": "https://jobs.example.com/stripe/swe-intern-2027/apply",
  "remote": false,
  "industries": ["SWE", "Fintech"],
  "portal": "greenhouse",
  "posted_at": "2026-09-01T14:00:00Z",
  "jd_summary": "Build internal and external developer tools."
}
```

### Alert Metadata After Twilio Send

```json
{
  "message_id": "SM9d3f2b7f6a4e4f5a1234567890abcd12"
}
```

### Queue Request Payload Stored on `applications.request_payload`

```json
{
  "url": "https://jobs.example.com/stripe/swe-intern-2027/apply",
  "profile": {
    "first_name": "Yash",
    "last_name": "Patel",
    "email": "yash@email.com",
    "phone": "+12025550123",
    "city": "Charlottesville",
    "state_region": "VA",
    "country": "United States",
    "linkedin": "https://linkedin.com/in/yash",
    "website": "",
    "resume_pdf_path": "/tmp/resume.pdf",
    "sponsorship_required": false,
    "work_authorization": "Authorized to work in the United States",
    "location_preference": "New York",
    "salary_expectation": "$35/hour",
    "custom_answers": {
      "school": "University of Virginia",
      "major": "Computer Science"
    }
  }
}
```

---

## Twilio Configuration Spec

Required env:

- `SMS_PROVIDER=twilio`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `APPLY_QUEUE_WORKER_SECRET` (for internal secured routes)

Important alignment notes:

- if Twilio-first is intended, set `SMS_PROVIDER=twilio` in all deployed environments
- avoid mixed defaults between docs and code (`plivo` fallback should be deliberate, not accidental)

Runtime ownership:

- app runtime: Twilio creds + Supabase keys + queue secret
- scheduler runtime (GitHub Actions/cron host): queue secret and app base URL
- never expose Twilio auth token to browser/client bundles

Recommended Twilio Console setup:

1. Buy/configure a US-capable number.
2. Set incoming webhook URL:
   - `https://{your-domain}/api/messaging/reply`
3. Use HTTPS only.
4. Restrict account access and rotate auth token periodically.

---

## Security and Compliance Requirements

1. Validate Twilio signatures server-side (hard requirement for production; header detection alone is insufficient).
2. Enforce idempotency at alert/action layer where possible.
3. Never execute apply action for unknown sender.
4. STOP must always disable future sends immediately (`sms_opt_in=false`).
5. Keep secrets server-only; never expose Twilio auth token in client bundles.
6. Maintain minimal PII in logs (mask phone and message content when possible).
7. START, if advertised, must be live and tested before release.
8. Invalid signature requests return non-success response and generate security telemetry.

---

## Reliability and Observability

Track metrics:

- outbound send success/failure rate
- webhook parse failure rate
- command distribution (`YES`, `NO`, `STOP`, `unknown`)
- queue enqueue latency after `YES`
- apply completion latency and status distribution
- alert expiration volume

SLO targets:

- `YES -> queued` P95 under 60 seconds
- `queued -> running` P95 under 3 minutes
- queue backlog alert when oldest queued item age exceeds 10 minutes

Suggested alerting:

- spike in Twilio API failures
- sudden drop in webhook volume
- queue stuck (`queued` age over threshold)
- abnormal unknown-reply percentage

### Scheduler Coverage (operational integration checklist)

Must have recurring execution for all four:

1. job ingest trigger(s)
2. alert expiry cron (`/api/internal/cron/expire-alerts`)
3. queue drain cron (`/api/internal/cron/process-queue`)
4. optional follow-up sender flow (if enabled for product tier)

Current repo note:

- workflow currently schedules ingest + expire-alerts
- process-queue scheduling must be explicitly wired for continuous apply execution

Required launch state:

- process-queue runs at least every minute in production
- expire-alerts runs at least hourly
- ingest cadence follows season policy from product plan

---

## Failure Modes and Expected Behavior

1. Twilio send fails:
   - keep alert as pending
   - mark error in logs/ops
   - optional retry strategy
2. User replies without pending alert:
   - noop 200, no side effects
3. Invalid body/from data:
   - noop 200
4. Queue/apply fails after YES:
   - application transitions to `failed`
   - retain run/error context in `apply_runs` + `applications.last_error`
5. Reply says START but START unsupported:
   - not allowed in release candidate builds
   - START command support and tests are required before go-live

---

## Test Matrix (Must Pass Before Production)

### Outbound

- sends valid Twilio payload
- stores `message_id` in alert metadata
- rejects send when credentials missing
- rejects send when profile has no opt-in/no phone

### Inbound

- YES -> confirm + queue
- NO -> skipped
- STOP -> opt-out + expire pending
- unknown -> guidance response
- unknown sender -> no-op
- no pending alert -> no-op
- Twilio signature invalid -> reject with no state writes
- START behavior -> enable opt-in and return confirmation

### Data Integrity

- unique `(user_id, job_id)` alert behavior
- queue claim locking correctness
- proper `applications.status` transitions
- `alerts` terminal mirror (`applied/failed`) consistency with `applications`
- canonical E.164 phone format at write/read/send boundaries

### Security

- unauthorized internal cron routes return 401
- webhook signature verification test coverage (when implemented)

---

## Rollout Plan

1. Stage environment with Twilio test number.
2. Enable Twilio provider in env and align provider defaults with Twilio-first policy.
3. Start with internal users only (allowlist on profiles).
4. Enforce webhook signature validation before broad external traffic.
5. Wire scheduler for queue drain and verify no queue backlog.
6. Monitor unknown replies, command distribution, and send failure rates.
7. Launch paid tier SMS access gates and track COGS per apply.

Release gate (must pass):

- signature verification enabled
- E.164 canonicalization deployed and backfilled
- START support implemented (or START references removed everywhere)
- queue scheduler live with healthy latency metrics

---

## Future Enhancements

- localized command parsing and multilingual templates.
- message templating by tier and urgency.
- dynamic send windows by user timezone and preferences.
- richer explainability in SMS ("matched because: remote + SWE + internship").
- per-user digest mode fallback when volume spikes.

---

## Final Product Constraint Summary

1. Never auto-apply from SMS unless explicit positive intent (`YES` class) or Turbo policy explicitly enabled by user.
2. Preference-based matching is policy truth; resume-based features are ranking assists.
3. STOP must be immediate and global for pending SMS alerts.
4. Canonical phone format must be consistent across storage, lookup, and provider sends.
5. Every transition must be reflected in Supabase statuses for recoverability and audit.
6. Twilio is transport; backend state machine is source of truth.
7. Webhook authenticity and idempotency are mandatory, not optional hardening.
