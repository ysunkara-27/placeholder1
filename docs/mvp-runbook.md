# Twin MVP Runbook

**Last updated:** 2026-03-31  
**Who this is for:** Anyone working on this project — apply engine, SMS, or both.

---

## How the whole system works

Every application goes through five stages. Both tracks of this project plug into different stages.

```
┌─────────────────────────────────────────────────────────────┐
│  1. INGEST    Jobs scraped → stored in Supabase             │
│       ↓                                                     │
│  2. MATCH     Profile matched to jobs → alert row created   │
│       ↓                                                     │
│  3. SMS OUT   "Twin found a match: Scale AI Intern.         │  ← SMS track
│               Reply YES to apply."                          │
│       ↓                                                     │
│  4. SMS IN    User replies YES → application queued         │  ← SMS track
│       ↓                                                     │
│  5. APPLY     Browser automation fills + submits the form   │  ← Apply track
└─────────────────────────────────────────────────────────────┘
```

**Apply track** (you): runs the browser automation engine. Handles stage 5.  
**SMS track** (your collaborator): handles stages 3–4. Configures Twilio, tests the webhook, makes sure YES turns into a queued application.

Both tracks read and write to the **same Supabase project**. You do not need to run both locally at once.

---

## Shared setup (everyone does this once)

### 1. Clone and install

```bash
git clone <repo>
cd <repo>
npm install
```

### 2. Get the `.env.local` file

Ask the other person for a copy of `.env.local`. It lives in the repo root and is git-ignored.

The **minimum required keys** for any contributor:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
APPLY_QUEUE_WORKER_SECRET=...
```

**Apply track also needs:**
```
ANTHROPIC_API_KEY=...
APPLY_ENGINE_BASE_URL=http://127.0.0.1:8000
```

**SMS track also needs (pick one provider):**
```
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
```
or
```
SMS_PROVIDER=plivo
PLIVO_AUTH_ID=...
PLIVO_AUTH_TOKEN=...
PLIVO_PHONE_NUMBER=+1...
```

### 3. Run the database migrations (once, either person)

Three migrations need to be applied in order:

```bash
npx supabase db push
```

If that fails, open the Supabase SQL editor and paste + run each of these in order:

1. `supabase/migrations/20260331000000_resume_storage.sql` — adds `resume_url` column + resumes Storage bucket
2. `supabase/migrations/20260331140000_prospective_lists.sql` — adds `prospective_lists` and `prospective_list_items` tables for the daily digest SMS flow
3. `supabase/migrations/20260401090000_digest_fixed_times.sql` — adds per-user digest timing columns to `profiles`

**Verify:**
- `profiles` table has `resume_url`, `daily_digest_shortlist_time_local`, `daily_digest_cutoff_time_local`, `daily_digest_goal_submit_time_local` columns
- `prospective_lists` and `prospective_list_items` tables exist
- Storage → `resumes` bucket listed

---

## Apply track setup

*Skip this section if you're only working on SMS.*

### Install Python and browser automation

```bash
python3 -m venv .venv
./.venv/bin/pip install -r apply_engine/requirements.txt
./.venv/bin/playwright install chromium
```

### Verify everything works

```bash
npm run build              # should complete with 0 errors
npm run test:apply-engine  # should show 97+ passing
```

### Start the apply engine

Keep this running in a dedicated terminal whenever you're doing apply runs.

```bash
./.venv/bin/uvicorn apply_engine.main:app --host 127.0.0.1 --port 8000
```

You should see: `Application startup complete.`

### Quick sanity check (5 seconds, no browser opens)

```bash
npm run smoke
```

Expected:
```
  [1/2] health check ... ok
  [2/2] dry-run plan ... ok (5ms, 13 planned actions, portal=lever)
  Smoke test passed.
```

If health check fails → the engine in the terminal above isn't running.  
If dry-run plan fails → read the error. Usually a schema mismatch.

---

## SMS track setup

*Skip this section if you're only working on the apply engine.*

### What you're building

You own the inbound/outbound SMS loop:
- **Outbound:** When a job matches a user, an SMS goes out: *"Twin found a match: Scale AI Intern. Reply YES to apply."*
- **Inbound:** When the user replies YES, the app queues the application. NO skips it. STOP opts them out.

The code is already written. Your job is to wire Twilio to it and validate the loop end-to-end.

### How the code works

| File | What it does |
|------|-------------|
| `lib/alerts.ts` | Creates alert rows, formats the SMS message, sends outbound SMS |
| `lib/messaging/send.ts` | Low-level send: calls Twilio or Plivo API |
| `app/api/messaging/reply/route.ts` | Inbound webhook — receives YES/NO/STOP replies |
| `app/api/messaging/send-alert/route.ts` | Internal endpoint that triggers sending a specific alert |
| `lib/followups.ts` | Handles numbered follow-up answers (e.g. "1. Computer Science") |

The reply route auto-detects the provider: if the request has `X-Twilio-Signature` header, it treats it as Twilio. Otherwise Plivo. No config needed — switching `SMS_PROVIDER` in `.env.local` changes which API sends outbound.

### Start the app

```bash
npx next start -p 3001
```

> Use `next start` not `npm run dev` for webhook testing — hot reloading can interrupt a request mid-flight.

### Expose your local server for webhook testing (ngrok)

Twilio needs a public URL to POST inbound messages to. ngrok creates a tunnel from the internet to your local machine.

Install ngrok: https://ngrok.com/download

```bash
ngrok http 3001
```

Copy the HTTPS URL it gives you, e.g. `https://abc123.ngrok-free.app`

### Configure Twilio webhook

1. Go to [Twilio Console](https://console.twilio.com) → Phone Numbers → your number
2. Under **Messaging** → **A message comes in**:
   - Set to **Webhook**
   - URL: `https://abc123.ngrok-free.app/api/messaging/reply`
   - Method: **POST**
3. Save

### Test the outbound SMS

First, onboard a test user with your real phone number:
1. Go to `http://localhost:3001/onboarding`
2. Complete all 5 steps — use your actual phone number in step 1
3. Upload any PDF as the resume for now

Then trigger an alert manually:

```bash
# Get your user ID from Supabase: Table editor → profiles → copy your id
# Get a job ID: Table editor → jobs → copy any id

curl -X POST http://localhost:3001/api/messaging/send-alert \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_APPLY_QUEUE_WORKER_SECRET" \
  -d '{"alert_id": "ALERT_ID"}'
```

To get an alert_id: after the ingest step creates jobs, matching happens automatically — check the `alerts` table in Supabase for a new row.

Or create one directly in Supabase SQL editor:
```sql
INSERT INTO alerts (user_id, job_id, status, alerted_at, expires_at)
VALUES (
  'YOUR_USER_ID',
  'ANY_JOB_ID',
  'pending',
  now(),
  now() + interval '24 hours'
)
RETURNING id;
```

Then send it:
```bash
curl -X POST http://localhost:3001/api/messaging/send-alert \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_APPLY_QUEUE_WORKER_SECRET" \
  -d '{"alert_id": "THE_ID_FROM_ABOVE"}'
```

You should receive an SMS on your phone.

### Test the inbound reply (reply YES)

Text `YES` back to your Twilio number.

Check Supabase → `applications` table → a new row should appear with `status=queued`.

Check Supabase → `alerts` table → your alert row should now have `status=accepted`.

That's the SMS loop working end-to-end.

### Test NO and STOP

- Reply `NO` → `alerts` row gets `status=skipped`
- Reply `STOP` → `profiles` row gets `sms_opt_in=false`, all pending alerts expired

### Test follow-up answers

If a previous apply run had unresolved required questions, the daily report will show them. The user gets an SMS listing them. They reply with numbered answers like:

```
1. Computer Science
2. May 2026
3. Yes
```

Text that to your Twilio number. Check Supabase → `profiles` → your row → `gray_areas.follow_up_answers` should now have those answers stored.

### Common SMS errors

| Error | Cause | Fix |
|-------|-------|-----|
| SMS never arrives | `sms_opt_in=false` on the profile, or no phone number stored | Complete onboarding with a phone number, check `profiles` row |
| Twilio 400 on send | Wrong `TWILIO_PHONE_NUMBER` format | Must be E.164 format: `+15551234567` |
| Reply does nothing | Webhook URL not set in Twilio console, or ngrok is expired | Restart ngrok, update webhook URL in Twilio console |
| Reply does nothing | Request went to wrong URL (HTTP not HTTPS) | Twilio requires HTTPS — use the `https://` ngrok URL |
| `alert_id required` on send-alert | Sending wrong body format | Body must be `{"alert_id": "..."}` not `{"userId": ...}` |
| User gets SMS but YES doesn't queue | Profile not found by phone | Phone in profile must match exact E.164 format that Twilio sends as `From` |

---

## The daily apply run loop

*This is the apply track's core loop. SMS person can skip to the next section.*

Open three terminals and leave them running.

**Terminal 1 — apply engine:**
```bash
./.venv/bin/uvicorn apply_engine.main:app --host 127.0.0.1 --port 8000
```

**Terminal 2 — Next.js app:**
```bash
npx next start -p 3001
```

**Terminal 3 — commands:**

```bash
# 1. Sanity check (5 seconds)
npm run smoke

# 2. Queue the 4 vetted test jobs
npm run queue:vetted:mvp

# 3. Run one application at a time
TWIN_MAX_RUNS=1 npm run process:queue:direct
```

You will see:
```
[Twin direct queue] <id>: portal=greenhouse timeout_ms=420000 attempt=1
```

Then silence for 2–7 minutes. The browser is running. Do not kill it.

When done:
```
[Twin direct queue] run persisted: <run-id>  status=applied       ← success
[Twin direct queue] run persisted: <run-id>  status=requires_auth ← captcha wall (expected for SoloPulse)
[Twin direct queue] run persisted: <run-id>  status=failed        ← something broke
```

```bash
# 4. Check what happened
open http://localhost:3001/dashboard

# 5. See blocked/unresolved questions in detail
npm run report:daily:followups
cat reports/daily-followups-$(date +%Y-%m-%d).md

# 6. Repeat
npm run queue:vetted:mvp
npm run process:queue:direct
```

### What each status means

| Status | Meaning | Do this |
|--------|---------|---------|
| `applied` | Form submitted, confirmation captured | Nothing. Done. |
| `requires_auth` | Captcha or login wall hit | Expected for SoloPulse. Manual apply needed. |
| `failed` | Engine error | Check dashboard error detail, see blocker table below |
| `queued` | Waiting in queue | Run `process:queue:direct` |
| `running` | Browser is open right now | Wait. Don't requeue. |

### What each blocker means

| Blocked on | Plain English | Fix |
|------------|--------------|-----|
| `education` | School/major/graduation didn't match ATS dropdown | Fill all 4 fields fully in onboarding: school name, major, degree, graduation date |
| `authorization` | ITAR or work eligibility question unanswered | Now answered proactively. If still failing, check `question_debug:` in the error for the exact wording |
| `resume` | No resume file delivered to the engine | Complete onboarding resume step — PDF now uploads to Supabase Storage automatically |
| `custom` | Required question the engine couldn't guess | Check the follow-up report for the exact question text, then add the answer to `gray_areas.follow_up_answers` in Supabase |
| `contact` | Missing phone/LinkedIn | Fill in onboarding step 1 |

### Dashboard panels at a glance

| Panel | Green means | Not green means |
|-------|------------|-----------------|
| **Queue** | Nothing waiting | Applications are processing now |
| **Approval** | No unread alerts | User has SMS matches waiting on a YES |
| **Portal access** | No blockers | `orange` = captcha, `red` = engine error |
| **Blockers Summary** | — | Which field keeps getting stuck across runs |
| **Follow-ups** | — | Questions needing a human answer before next attempt |
| **Recovery Summary** | — | When the engine had to retry a blocked field |

---

## All commands in one place

```bash
# Verify the engine is up (5 seconds, no browser)
npm run smoke
npm run smoke -- --portal greenhouse

# Queue the vetted test jobs
npm run queue:vetted:mvp

# Process the queue (real browser, 2–7 min per job)
npm run process:queue:direct
TWIN_MAX_RUNS=1 npm run process:queue:direct   # one at a time

# Check blocked runs
npm run report:daily:followups
cat reports/daily-followups-$(date +%Y-%m-%d).md

# Send daily SMS follow-up batch to users with open questions
npm run send:daily:followups

# Ingest seed jobs into Supabase (run against local or deployed app)
./.venv/bin/python apply_engine/scripts/ingest_seed_jobs.py \
  --base-url http://localhost:3001 \
  --worker-secret YOUR_WORKER_SECRET

# Requeue a stuck application (paste into Supabase SQL editor)
UPDATE applications
SET status='queued', queued_at=now(), started_at=null, worker_id=null
WHERE id='YOUR_APPLICATION_ID';

# Manually trigger an outbound alert SMS
curl -X POST http://localhost:3001/api/messaging/send-alert \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_WORKER_SECRET" \
  -d '{"alert_id":"YOUR_ALERT_ID"}'

# Expire old alerts
curl -X POST http://localhost:3001/api/internal/cron/expire-alerts \
  -H "Authorization: Bearer YOUR_WORKER_SECRET"
```

---

## Deploy (do this only after local runs are working)

### Apply engine → Railway

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Set Root Directory: `apply_engine/`
3. Add env var: `ANTHROPIC_API_KEY=...`
4. Wait 3–5 minutes (Playwright installs during build)
5. Verify: `curl https://your-engine.up.railway.app/health` → `{"status":"ok"}`
6. Smoke test against remote: `APPLY_ENGINE_BASE_URL=https://your-engine.up.railway.app npm run smoke`

### Next.js → Vercel

Set all these in Vercel dashboard → Environment Variables:

```
ANTHROPIC_API_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
APPLY_QUEUE_WORKER_SECRET
APPLY_ENGINE_BASE_URL          ← Railway URL
APPLY_ENGINE_TIMEOUT_MS=240000
APPLY_ENGINE_GREENHOUSE_TIMEOUT_MS=420000
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
```

```bash
git push origin main   # Vercel auto-deploys
```

### Update Twilio webhook to production URL

Twilio Console → your number → Messaging webhook:  
`https://your-app.vercel.app/api/messaging/reply`

### GitHub Actions → add secrets

GitHub → repo → Settings → Secrets → Actions:

| Secret | Value |
|--------|-------|
| `TWIN_APP_BASE_URL` | `https://your-app.vercel.app` |
| `APPLY_QUEUE_WORKER_SECRET` | same as `.env.local` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key |
| `GEMINI_API_KEY` | optional |

Then: GitHub → Actions → Twin Operations → Run workflow → verify all jobs pass.

### Vercel cron for auto queue processing and SMS digests

Vercel → Project → Settings → Crons (add all of these):
```
Path: /api/internal/cron/process-queue           Schedule: */5 * * * *
Path: /api/internal/cron/send-prospective-lists  Schedule: */5 * * * *
Path: /api/internal/cron/finalize-prospective-lists  Schedule: */5 * * * *
Path: /api/internal/cron/send-prospective-results    Schedule: */5 * * * *
```

The prospective-lists crons power the daily digest flow: Twin builds a shortlist, texts it to the user, waits for replies (YES/SKIP n), then queues confirmed jobs and sends a results summary.

---

## MVP is live when

**Apply track:**
- [ ] `npm run smoke` passes in under 10 seconds
- [ ] `npm run build` and `npm run test:apply-engine` both pass
- [ ] All 3 DB migrations applied (resume_storage, prospective_lists, digest_fixed_times)
- [ ] At least one Greenhouse job → `applied` in a local direct queue run
- [ ] SoloPulse Lever → `requires_auth` (captcha detected — this is correct)
- [ ] Apply engine deployed to Railway, `/health` returns ok
- [ ] `APPLY_ENGINE_BASE_URL` in Vercel points to Railway URL

**SMS track:**
- [ ] Outbound SMS arrives on your phone when you trigger `send-alert`
- [ ] Replying YES creates a row in `applications` with `status=queued`
- [ ] Replying NO marks the alert `skipped`
- [ ] Replying STOP sets `sms_opt_in=false`
- [ ] Follow-up answers get stored in `gray_areas.follow_up_answers`
- [ ] Daily digest: `send-prospective-lists` cron fires and user receives a numbered shortlist SMS
- [ ] Replying `SKIP 2` removes item from list; `APPLY ALL` / YES queues everything
- [ ] Twilio webhook updated to production Vercel URL after deploy

**Both:**
- [ ] A real user completes onboarding, gets an SMS, replies YES, application runs, result visible in dashboard
