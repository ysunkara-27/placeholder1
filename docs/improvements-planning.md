# Twin Platform Improvement Suggestions

_Generated from a recursive repo review of the public tree, with emphasis on code-level fixes, platform speed, database efficiency, and messaging-cost reduction._

## 1. Executive Summary

Twin already has a strong decomposition: Next.js app surfaces, Supabase-backed domain state, a Python scraper, a Python apply engine with portal agents, and queue-processing scripts. The main engineering opportunity is not "start over". It is to tighten the contract between these layers so the product is faster, cheaper to operate, and more reliable.

The highest-impact issues are:

1. **Matching is too shallow for an expensive downstream apply pipeline.**
2. **Job ingest currently fans out against all onboarded profiles in application code, which will not scale.**
3. **Alert creation and SMS send paths cause avoidable extra reads and expensive message volume.**
4. **Onboarding validation is over-constrained and will reduce conversion.**
5. **Anonymous auth and broad jobs read access should be narrowed or explicitly productized.**
6. **Queue processing needs heartbeat, retry metadata, and worker deployment assumptions formalized.**
7. **Documentation and source-of-truth drift across README / plans / research docs should be collapsed into one canonical implementation spec.**

---

## 2. Cross-System Improvement Goals

### Goal A — Reduce wasted work
Only alert users when the match quality is high enough and the system is actually ready to help.

### Goal B — Push filtering earlier
Move profile eligibility filtering and job dedupe closer to ingest/database boundaries rather than doing broad scans in the API layer.

### Goal C — Lower message spend
Reduce unnecessary outbound SMS, shorten templates, and shift lower-priority communication to in-app or digest delivery.

### Goal D — Tighten persistence contracts
Make row-level ownership, queue state transitions, and retry semantics explicit.

### Goal E — Improve development velocity
Unify docs, uncompress critical source files where needed, and create module-level tests around the highest-value contracts.

---

## 3. File-by-File Improvement Recommendations

## 3.1 `lib/matching.ts`

### Current issue
The scoring model is currently dominated by industry, level, location, and gray-area exclusion filters. That is not enough for a product that later performs queueing and automation.

### Problems
- No work authorization filtering.
- No sponsorship filtering.
- No graduation-year eligibility filtering.
- No skill overlap.
- No portal support weighting.
- No confidence score or missing-data output.
- No reason bucketing between hard reject, soft mismatch, and unknown.

### Code changes
Refactor:
- `matchJobToProfile(job, profile)`

Into:
- `computeEligibility(job, profile)`
- `computePreferenceScore(job, profile)`
- `computeEvidenceScore(job, profile)`
- `buildMatchExplanation(...)`

### Proposed return shape
```ts
export interface MatchResult {
  matched: boolean;
  score: number;
  confidence: "low" | "medium" | "high";
  reasons: string[];
  rejections: string[];
  missingData: string[];
  riskFlags: string[];
}
```

### Suggested implementation details
1. Add normalized eligibility fields to jobs:
   - `requires_sponsorship`
   - `work_authorization_region`
   - `graduation_year_min`
   - `graduation_year_max`
   - `skills`
   - `portal_support_tier`

2. Add normalized profile fields if missing:
   - `requires_sponsorship`
   - `preferred_comp_min`
   - `preferred_comp_max`
   - `graduation_year`
   - `skills`

3. Split score weights:
   - 20 industry/domain
   - 15 level
   - 15 location/remote
   - 15 skill overlap
   - 10 auth/sponsorship
   - 10 graduation eligibility
   - 5 salary fit
   - 5 portal support tier
   - 5 freshness

4. Add hard rejects for:
   - excluded company
   - excluded industry
   - sponsorship mismatch
   - graduation ineligibility
   - location mismatch with remote false

### Performance note
This function must stay pure and serializable so it can be moved into a worker or batch matching job later.

---

## 3.2 `app/api/jobs/ingest/route.ts`

### Current issue
After a job upsert, the route loads all completed profiles and loops over them in application code to score the job and create alerts.

### Why this is a problem
- N-wide full profile scan on every ingest.
- Matching work happens synchronously in the request lifecycle.
- Alert generation and SMS send pressure grows with profile count.
- This will become the bottleneck before the automation engine does.

### Code changes
Current pattern to replace:
- upsert job
- `select * from profiles where onboarding_completed = true`
- loop through every profile
- call matching
- possibly create alert and send SMS

### Replace with
#### Option A — async matching queue (recommended)
1. Upsert the job.
2. Insert a `job_match_tasks` record.
3. Return immediately.
4. A worker processes profile subsets in batches.

#### Option B — filtered profile pre-query
At minimum, do not fetch all profiles. Add coarse database filters before TS matching:
- `sms_opt_in = true` if alerting immediately
- `onboarding_completed = true`
- `levels` overlaps job level
- `industries` overlaps job industries OR industries empty
- `remote_ok = true` OR `locations` overlaps job location

### Database suggestion
Add a dedicated SQL function:
```sql
public.select_candidate_profiles_for_job(
  p_level text,
  p_industries text[],
  p_location text,
  p_remote boolean
)
```
That function should do a cheap coarse filter and return candidate IDs only.

### Additional fix
Move SMS send out of the ingest request entirely. Ingest should create an alert record and a `pending_sms_notifications` task, not call SMS in-band.

---

## 3.3 `lib/alerts.ts`

### Current issues
- Alert creation returns existing records without checking expiry or resend policy.
- `sendAlertSms()` reads alert, then job, then profile in three separate round trips.
- SMS body is verbose and likely consumes multiple segments.

### Code changes
#### A. Make alert dedupe time-aware
Enhance `createAlert()` to:
- allow re-alert after expiry or after meaningful job refresh,
- store `last_notified_at`,
- store `notification_attempts`,
- skip if user already acted.

#### B. Collapse the 3-query SMS read into one RPC or joined query
Instead of:
- fetch alert
- fetch job
- fetch profile

Create a SQL RPC like:
```sql
public.get_sms_alert_context(p_alert_id uuid)
```
Return:
- alert id
- alert status
- profile phone
- profile sms_opt_in
- job title/company/location/level

#### C. Shorten the message template
Current message is chatty. Replace with a single-segment template where possible.

Suggested new format:
```txt
Twin: {company} {title} ({location}). Reply Y apply, N skip, STOP pause.
```

Optional second message only if user replies `Y`.

### Messaging-cost optimization
- Keep under 160 GSM-7 chars when possible.
- Avoid repeated brand copy and blank lines.
- Do not send SMS for low-confidence matches.
- Prefer in-app alerts for low-priority roles.
- Batch lower-priority items into one digest.

### Data model additions
Add to `alerts`:
- `priority`
- `confidence`
- `notification_attempts`
- `last_notified_at`
- `delivery_provider`
- `delivery_cost_estimate`
- `delivery_segment_count`

---

## 3.4 `lib/messaging/send.ts`

### Current issue
The send layer only focuses on provider dispatch success/failure and does not appear to normalize cost-aware metadata or provider routing strategy.

### Code changes
Add a normalized result shape:
```ts
export interface SmsSendResult {
  success: boolean;
  provider: "twilio" | "plivo";
  messageId?: string;
  segmentCount?: number;
  estimatedCostMicros?: number;
  error?: string;
}
```

### Provider strategy
Create a `selectNotificationChannel()` helper:
- if message is high priority and user sms-opted-in -> SMS
- if low priority -> in-app + email
- if digest eligible -> digest queue

### Twilio-rate reduction changes
- Add message dedupe key: `{userId}:{jobId}:{purpose}`.
- Refuse send if same dedupe key exists in recent interval.
- Precompute GSM-7 vs UCS-2 to estimate segments.
- Truncate/normalize curly punctuation and em dash where possible.
- Route cheap bulk reminders to email or in-app instead of SMS.

---

## 3.5 `lib/messaging/reply.ts`

### Current issue
Reply parsing is token-based, which is good for MVP, but the parser is too narrow for stateful workflows.

### Code changes
Keep `normalizeReplyText()` but add:
- `extractStructuredReply(text)`
- conversation-context-based interpretation
- support numeric replies
- support digest control words

### Suggested actions
```ts
type ReplyAction =
  | "confirm"
  | "skip"
  | "stop"
  | "digest"
  | "help"
  | "unknown";
```

### Why this matters for cost
A cleaner reply protocol lets you send fewer clarifying follow-up texts.

### Suggested low-cost reply grammar
- `Y` = confirm
- `N` = skip
- `D` = daily digest
- `STOP` = unsubscribe

Then update alert SMS copy to match the parser exactly.

---

## 3.6 `app/onboarding/page.tsx`

### Current issue
Education-step validation requires `visa_type` and `earliest_start_date` even though `authorized_to_work` defaults true.

### Why this matters
This is likely suppressing onboarding completion for users who do not need sponsorship information captured immediately.

### Code changes
Replace current validation logic:
```ts
case "education":
  return (
    form.school.trim().length > 0 &&
    form.major.trim().length > 0 &&
    form.degree.trim().length > 0 &&
    form.graduation.trim().length > 0 &&
    form.visa_type.length > 0 &&
    form.earliest_start_date.trim().length > 0
  );
```

With conditional validation:
```ts
case "education": {
  const hasCore =
    form.school.trim().length > 0 &&
    form.major.trim().length > 0 &&
    form.degree.trim().length > 0 &&
    form.graduation.trim().length > 0;

  const visaOk = form.authorized_to_work
    ? true
    : form.visa_type.trim().length > 0;

  const availabilityOk =
    form.earliest_start_date.trim().length > 0 || form.levels.includes("full_time") === false;

  return hasCore && visaOk && availabilityOk;
}
```

### Additional UX fix
Split the step into:
- `education`
- `work authorization`
- `availability`

This reduces the chance that users abandon onboarding because one optional field is blocking a whole step.

### Auth flow fix
Current code signs in anonymously on mount. Add:
- guest session TTL,
- explicit upgrade prompt before enabling long-running alerting or live apply,
- a `profile_draft` table or local draft cache so incomplete onboarding does not require auth immediately.

---

## 3.7 `supabase/migrations/20260329120000_initial_platform.sql`

### Current issue
Jobs are readable to all authenticated users via `using (true)`.

### Why this matters
With anonymous auth in play, this is broader than it looks.

### Code changes
Pick one policy model explicitly.

#### Model A — Shared catalog
Keep shared read, but document it and remove ambiguity.

#### Model B — User-scoped visibility (recommended for current product)
Restrict direct jobs table reads and expose jobs through:
- `alerts`
- `job_matches`
- curated public feeds

### Suggested change
Replace broad `jobs_select_authenticated` with either:
1. a public catalog view with stripped fields, or
2. a join policy through `alerts` / `job_matches`.

### Also add indexes
If not present, add indexes on:
- `alerts(user_id, status, alerted_at desc)`
- `applications(user_id, status, updated_at desc)`
- `jobs(status, posted_at desc)`
- `jobs(portal, posted_at desc)`

---

## 3.8 `supabase/migrations/20260329180000_application_queue.sql`

### Current issue
The queue claim function is a good start, but the queue model still lives inside `applications` state rather than a dedicated queue table.

### Why this matters
- Retry metadata is mixed with business status.
- Harder to observe queue latency separately from application lifecycle.
- Harder to support multiple workers or future priority classes.

### Code changes
Create a dedicated table:
```sql
public.application_queue (
  id uuid primary key,
  application_id uuid not null,
  user_id uuid not null,
  priority integer not null default 100,
  status text not null,
  available_at timestamptz not null,
  attempt_count integer not null default 0,
  claimed_by text,
  claimed_at timestamptz,
  heartbeat_at timestamptz,
  last_error_class text,
  last_error_message text,
  payload jsonb not null default '{}'::jsonb
)
```

### Worker changes
Refactor `processNextQueuedApplication()` to:
- claim queue row,
- write heartbeat periodically,
- mark queue row terminal status,
- update `applications` separately with business outcome.

### Additional speed/reliability changes
- add `priority` support,
- add `available_at` for backoff,
- add `heartbeat_at` reclaim logic,
- add retry caps by error class.

---

## 3.9 `lib/application-queue.ts`

### Current issues
- Queue state and application state are tightly coupled.
- Existing application rows are overwritten into queued state.
- No explicit guard for unresolved planner questions before queueing.
- Error handling collapses many conditions into generic failure.

### Code changes
#### A. Enforce planner gating before queueing
Before queueing, require:
- `unresolved_questions.length === 0`
- `planner_confidence >= threshold`
- portal support tier not unsupported

#### B. Preserve planning state
Do not overwrite prior application context blindly. Keep:
- `latest_plan_payload`
- `latest_submit_payload`
- `planner_confidence`
- `unresolved_questions_snapshot`

#### C. Add error classification
Map failures into:
- `requires_auth`
- `missing_answer`
- `unsupported_field`
- `navigation_timeout`
- `anti_bot`
- `portal_changed`
- `unknown`

Then use that classification for retry policy.

#### D. Add idempotency key
Queue rows should include an idempotency key like:
```ts
const queueKey = `${userId}:${jobId}:${planHash}`;
```
This prevents duplicate queueing of the same exact intent.

---

## 3.10 `lib/apply-engine.ts`

### Current issue
The file already validates request/response shape and uses portal-aware timeout logic, which is good. The main improvement opportunity is contract richness.

### Code changes
Expand `ApplyEngineResponse` with:
- `confidence`
- `error_class`
- `portal_support_tier`
- `blocking_questions`
- `field_fill_stats`
- `step_durations_ms`

### Timeout improvement
Current portal-aware timeout is a start. Extend to:
- plan timeout by portal,
- submit timeout by portal,
- retryable vs non-retryable timeout classification,
- record actual elapsed time in result payload.

### Speed improvement
Avoid calling the engine for jobs whose portal is unsupported or whose planner confidence is below threshold.

---

## 3.11 `lib/job-ingest.ts`

### Current issue
Upsert currently uses `onConflict: "url"` after canonicalization, which is good but still fragile if application URLs change while job identity is otherwise the same.

### Code changes
#### A. Add canonical job fingerprint
Create a deterministic `job_fingerprint` from:
- normalized company
- normalized title
- portal
- location
- canonical application URL or board token + external id

Then upsert on fingerprint first, URL second.

#### B. Separate volatile metadata from identity
Move these into JSON metadata if needed:
- tags
- salary string
- notes
- scrape diagnostics

Keep identity columns small and indexed.

#### C. Add `last_seen_at`
When an existing job is re-ingested, update:
- `last_seen_at`
- `posted_at` only if source gives stronger evidence
- `status` to `active`

Then a cleanup job can expire old jobs not seen recently.

---

## 3.12 `data/job-sources/internship-sources.json`

### Current issue
The file is useful and already structured, but it can do more operational work.

### Code changes
Add fields per source:
```json
{
  "id": "twilio-greenhouse",
  "portal": "greenhouse",
  "company": "Twilio",
  "board_token": "twilio",
  "board_url": "https://boards-api.greenhouse.io/v1/boards/twilio/jobs",
  "enabled": true,
  "priority": 90,
  "poll_interval_minutes": 20,
  "portal_support_tier": "stable",
  "default_industries": ["SWE"],
  "dedupe_company_aliases": ["Twilio Inc."],
  "default_location_bias": ["Remote", "San Francisco", "New York"],
  "notes": "Communications API platform, posts SWE interns"
}
```

### Benefits
- lets scheduler prioritize stable and high-yield boards,
- improves ingest speed by not polling every source equally,
- lets matching incorporate portal support tier earlier.

---

## 3.13 `lib/followups.ts` and `app/api/internal/followups/send-daily/route.ts`

### Current issue
The follow-up system is strategically good because it can replace expensive one-off nudges. It should now be made cost-aware.

### Code changes
Create a send policy layer:
```ts
function chooseFollowupChannel(input: {
  urgency: "low" | "medium" | "high";
  hasSmsOptIn: boolean;
  recentSmsCount: number;
  hasEmail: boolean;
}) {
  // prefer in-app or email unless urgency/high-value threshold reached
}
```

### Add daily caps
Per-user limits:
- max 1 SMS alert + 1 SMS follow-up per rolling 24h by default
- unlimited in-app
- email digest for overflow

### Add aggregation
Instead of multiple texts:
- one daily digest SMS or email for low-priority items
- one immediate SMS only for top matches or blocked runs needing user input

### Suggested table additions
`profiles.notification_preferences` should include:
- `sms_daily_cap`
- `digest_enabled`
- `high_priority_sms_only`
- `quiet_hours`

---

## 3.14 `scripts/send-daily-followups.mjs` and `scripts/generate-daily-followup-report.mjs`

### Current issue
These scripts are useful, but they still reflect a low-cost/manual operating model.

### Code changes
- add environment-based dry run mode,
- add output JSON summary for worker observability,
- persist run summaries to DB instead of only console/report markdown,
- schedule digests by priority and channel, not just one global send operation.

### Speed improvement
Move selection logic into SQL or RPC rather than fetching broad datasets into Node for report generation.

---

## 3.15 `app/apply-lab/page.tsx` and `components/apply/apply-lab.tsx`

### Current issue
The apply lab is useful for internal testing, but it currently imports a static seed set (`vetted-live-mvp.json`) directly in the page, which keeps testing somewhat detached from production queue reality.

### Code changes
- allow selecting between:
  - static seed fixtures,
  - live recent jobs,
  - failed queue replays,
  - portal-specific validation sets.
- store run presets in JSON so repeated portal regression tests are easier.
- expose planner confidence and unresolved questions in the UI before submit.

---

## 3.16 `docs/*` planning files

### Current issue
The repo has valuable documentation, but there are too many parallel planning documents.

### Code changes
Create a canonical implementation spec in `docs/spec.md` with explicit sections:
- current MVP stable
- beta features
- experimental features
- unsupported features
- schema truth
- portal support matrix

Then make README point to it and trim duplicative planning copy.

---

## 3.17 `README.md`

### Current issue
README still reflects a prototyping posture and includes setup/deployment guidance that can drift from the actual repo owner and operating model.

### Code changes
- fix clone path to current repo owner
- distinguish local dev from recommended production topology
- mark anonymous auth as temporary onboarding choice, not silent default architecture
- add support-tier table for portals
- add cost model section for SMS/email/in-app alerts

---

## 3.18 `scraper/*` and `apply_engine/*`

### Current issue
These subsystems are directionally strong and already tested, but they need a clearer shared contract around supported portals and normalized job/application shapes.

### Code changes
Define one shared schema for:
- ingested job payload,
- planner request,
- planner response,
- submit response,
- blocker question,
- confirmation state.

This can live in:
- `docs/contracts.md`
- mirrored in `lib/apply-engine.ts` Zod
- mirrored in `apply_engine/schemas.py`

### Performance improvement
For scraper polling:
- poll stable API-backed sources more frequently,
- poll AI-assisted or brittle sources less often,
- cache board fetch results and only process deltas.

---

## 4. Database Efficiency Recommendations

## 4.1 Add coarse filtering before TypeScript matching
Do not load every onboarded profile per job ingest.

## 4.2 Separate queue table from applications table
Business lifecycle and execution lifecycle should not be the same record.

## 4.3 Add materialized or incremental match support
Introduce `job_matches` or `user_match_candidates` for asynchronous matching.

## 4.4 Add better indexes
Recommended indexes:
```sql
create index if not exists idx_profiles_onboarding_sms
  on public.profiles (onboarding_completed, sms_opt_in);

create index if not exists idx_jobs_status_posted_portal
  on public.jobs (status, posted_at desc, portal);

create index if not exists idx_alerts_user_status_alerted
  on public.alerts (user_id, status, alerted_at desc);

create index if not exists idx_applications_user_status_updated
  on public.applications (user_id, status, updated_at desc);
```

## 4.5 Add `last_seen_at` and cleanup jobs
This keeps the jobs table smaller and improves recent-job queries.

---

## 5. Speed Optimization Recommendations

1. **Move matching off the ingest request path.**
2. **Do coarse profile filtering in SQL before TS scoring.**
3. **Use one joined/RPC fetch for SMS context.**
4. **Avoid sending SMS in-band during job ingest.**
5. **Add job fingerprints so duplicate re-ingests do less work.**
6. **Add planner gating so unsupported or low-confidence jobs never hit the apply engine.**
7. **Persist worker heartbeat so stuck jobs can be reclaimed quickly.**
8. **Use priority-based polling intervals in `internship-sources.json`.**

---

## 6. Twilio / SMS Spend Reduction Plan

### Immediate savings
1. Shorten alert copy to one segment.
2. Do not SMS low-confidence matches.
3. Add per-user daily SMS cap.
4. Add digest mode.
5. Deduplicate sends with a recent-send key.
6. Prefer email or in-app for reminders.
7. Normalize punctuation to stay in GSM-7.

### Code additions
- `estimateSmsSegments(body: string)` helper
- `chooseNotificationChannel(...)`
- `canSendSmsToday(userId)` query/RPC
- `notification_logs` table
- `profiles.notification_preferences.digest_enabled`

### Suggested channel matrix
- **Top match, urgent, fresh posting:** SMS + in-app
- **Medium match:** in-app + email
- **Low match or reminder:** digest only
- **Blocked run needing answer:** SMS if high urgency, else email + in-app

---

## 7. Testing Improvements

### Add tests for
- conditional onboarding validation
- matching hard rejects
- match explanation snapshots
- SMS segment estimator
- alert dedupe policy
- queue idempotency
- worker retry classification
- ingest dedupe by fingerprint + URL fallback

### Contract tests
Mirror `lib/apply-engine.ts` schemas against Python `apply_engine/schemas.py` so request/response drift is caught automatically.

---

## 8. Recommended Implementation Order

### Phase 1 — Cheap wins
- shorten SMS template
- conditional onboarding validation
- add SMS caps / digest preferences
- fix README and canonical docs

### Phase 2 — Database and performance
- coarse profile filtering in SQL
- async job-match worker
- joined SMS alert context fetch
- add indexes and `last_seen_at`

### Phase 3 — Queue hardening
- dedicated queue table
- heartbeat/reclaim
- error-class-based retry
- planner gating before queueing

### Phase 4 — Matching quality
- deeper scoring
- confidence + missingData
- support-tier weighting
- job fingerprint improvements

### Phase 5 — Product maturity
- account upgrade flow
- explicit privacy model
- support-tier UI
- operator replay tooling

---

## 9. Cursor-Oriented Action List

A code-generation agent should start with these exact edits:

1. **Edit `app/onboarding/page.tsx`** to make `visa_type` and `earliest_start_date` conditionally required.
2. **Edit `lib/alerts.ts`** to replace the SMS template with a one-segment version and add recent-send dedupe.
3. **Edit `app/api/jobs/ingest/route.ts`** to stop loading every profile; instead call a SQL coarse-filter RPC or enqueue a background matching task.
4. **Edit `lib/matching.ts`** to add `confidence`, `missingData`, and sponsorship / graduation checks.
5. **Add a new migration** for `notification_logs`, `last_seen_at`, and queue metadata.
6. **Add `estimateSmsSegments()` and `chooseNotificationChannel()`** under `lib/messaging/`.
7. **Refactor `lib/application-queue.ts`** so unresolved planner questions block queueing.
8. **Create `docs/spec.md`** as canonical source of truth and point README at it.

---

## 10. Final Recommendation

Twin should be optimized around one strong loop:
1. ingest job,
2. cheaply identify likely-fit users,
3. notify only the right users in the cheapest appropriate channel,
4. collect missing answers before queueing,
5. execute on supported portals with visible confidence and retries.

The platform already has the right pieces. The next engineering step is to reduce unnecessary work between those pieces.
