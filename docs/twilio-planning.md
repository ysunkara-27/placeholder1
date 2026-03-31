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

## End-to-End Flow Spec

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
   - create `alerts` row (`status=pending`, `expires_at`)
   - if SMS opt-in valid, send Twilio message

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

---

### 3) Inbound Reply Webhook

Route: `POST /api/messaging/reply`

Incoming parsing:

- provider detect:
  - Twilio if `x-twilio-signature` header exists
  - current behavior: header presence is detection only
  - required production behavior: validate signature against auth token and webhook URL
- fields:
  - `From`
  - `Body`

Action normalization:

- confirm tokens: `yes, y, yep, yeah, yup, sure, ok, okay, apply, go`
- skip tokens: `no, n, nope, skip, pass, next, not interested`
- stop tokens: `stop, unsubscribe, cancel, quit, end, stopall`

Behavior:

- unknown sender -> no-op 200
- no pending alert -> no-op 200
- STOP:
  - `profiles.sms_opt_in = false`
  - expire all pending alerts for user
  - return TwiML unsubscribe confirmation
  - do not claim START support unless START handling is implemented
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

---

### 4) Queue and Apply Execution

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
3. clearly document whether per-profile provider routing is in or out of scope

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

Decision required (document as policy):

- either keep alerts as decision-log only (`pending/confirmed/skipped/expired`)
- or mirror final execution outcome to `alerts.applied/failed` for unified lifecycle reporting

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

## `applications`

Key fields:

- relation: `user_id`, `job_id`
- execution: `status` in `queued | running | requires_auth | applied | failed`
- queue metadata: `request_payload`, `attempt_count`, `worker_id`, `last_run_id`
- result metadata: `confirmation_text`, `last_error`, `applied_at`, timing columns

## `apply_runs`

Audit table for plan/submit runs with request/result payloads and summary metadata.

---

## State Machines

### Alert State Machine

```text
pending
  -> confirmed (YES)
  -> skipped   (NO)
  -> expired   (timeout cron or STOP sweep)

confirmed
  -> applied   (application success, optional mirror update)
  -> failed    (application failed, optional mirror update)
```

### SMS Subscription State Machine

```text
sms_opt_in=true
  -> false (STOP)
  -> true  (future START support)
```

Note: current implementation handles STOP but not explicit START re-enable command.

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
7. If STOP response text references START, START handling must exist and be tested.

---

## Reliability and Observability

Track metrics:

- outbound send success/failure rate
- webhook parse failure rate
- command distribution (`YES`, `NO`, `STOP`, `unknown`)
- queue enqueue latency after `YES`
- apply completion latency and status distribution
- alert expiration volume

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
   - treat as unknown until START command support is implemented
   - avoid contradictory user copy in webhook responses

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
- Twilio signature invalid -> reject/ignore per policy
- START behavior -> tested only when feature is implemented

### Data Integrity

- unique `(user_id, job_id)` alert behavior
- queue claim locking correctness
- proper `applications.status` transitions
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

---

## Future Enhancements

- START keyword re-subscribe flow.
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
