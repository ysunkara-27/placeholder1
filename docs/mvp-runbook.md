# Twin MVP Runbook

**Last updated:** 2026-03-31
**Purpose:** Exact steps from zero to a live, deployed MVP — including local validation, database migration, and production deploy.

---

## Part 1 — Local Validation (do this first, before deploying anything)

### Step 1.1 — Verify prerequisites

```bash
node -v          # need 18+
python3 --version  # need 3.11+
```

Make sure `.env.local` exists in the repo root with all of these set:

```
ANTHROPIC_API_KEY=...
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
APPLY_QUEUE_WORKER_SECRET=...
APPLY_ENGINE_BASE_URL=http://127.0.0.1:8000
SMS_PROVIDER=plivo
PLIVO_AUTH_ID=...
PLIVO_AUTH_TOKEN=...
PLIVO_PHONE_NUMBER=+1...
```

### Step 1.2 — Install Node dependencies

```bash
npm install
```

### Step 1.3 — Set up the Python virtual environment

```bash
python3 -m venv .venv
./.venv/bin/pip install -r apply_engine/requirements.txt
./.venv/bin/playwright install chromium
```

### Step 1.4 — Verify everything builds and tests pass

```bash
npm run build                    # should exit 0, 26 routes compiled
npx tsc --noEmit                 # should produce no output
npm run test:apply-engine        # should show 97+ passing tests
python3 -m py_compile $(find apply_engine -name '*.py' | grep -v __pycache__)
# should produce no output
```

If any of the above fail, stop and fix before continuing.

---

## Part 2 — Run the Database Migration

### Step 2.1 — Apply the resume storage migration

This adds the `resume_url` column to `profiles` and creates the `resumes` Storage bucket.

**Option A — Supabase CLI (recommended):**
```bash
npx supabase db push
```

**Option B — Supabase dashboard SQL editor:**

Open your Supabase project → SQL editor → paste and run the entire contents of:
```
supabase/migrations/20260331000000_resume_storage.sql
```

### Step 2.2 — Verify migration

In the Supabase dashboard:
- Table editor → `profiles` → confirm `resume_url` column exists
- Storage → confirm `resumes` bucket exists (private, 10MB limit)

---

## Part 3 — Ingest Seed Jobs

### Step 3.1 — Put your Vercel URL (or local dev URL) in the command

You need the Twin app to be reachable. For local testing:

```bash
# Terminal 1 — start the Next.js app in production mode
npx next start -p 3001
```

### Step 3.2 — Run the seed ingest

```bash
./.venv/bin/python apply_engine/scripts/ingest_seed_jobs.py \
  --base-url http://localhost:3001 \
  --worker-secret YOUR_APPLY_QUEUE_WORKER_SECRET
```

This loads jobs from `data/job-seeds/live-openings-2026.json` into Supabase.

For the vetted MVP test set (4 jobs, fully validated portals):

```bash
node scripts/queue-vetted-mvp.mjs
```

This queues one application per vetted job for the operator account.
The vetted jobs are:
- **Greenhouse:** Scale AI, Rendezvous Robotics
- **Lever:** SoloPulse, WeRide

---

## Part 4 — Local Live Run Validation

### Step 4.1 — Start the apply engine

```bash
# Terminal 2 — keep this running
./.venv/bin/uvicorn apply_engine.main:app --host 127.0.0.1 --port 8000
```

Confirm it is healthy:
```bash
curl http://127.0.0.1:8000/health
# → {"status":"ok"}
```

### Step 4.2 — Start the Next.js app (if not already running)

```bash
# Terminal 1 (or alongside Terminal 2)
npx next start -p 3001
```

> **Note:** Use `next start`, not `npm run dev`, for queue processing. The dev server hot-reloads and can interrupt running worker sessions.

### Step 4.3 — Queue jobs for live testing

```bash
npm run queue:vetted:mvp
```

This queues all 4 vetted jobs. You can also queue individual jobs from `/apply-lab` in the browser.

### Step 4.4 — Process the queue

```bash
npm run process:queue:direct
```

This:
1. Checks that the apply engine is healthy at `http://127.0.0.1:8000`
2. Auto-starts uvicorn locally if it isn't running
3. Claims applications from Supabase directly (bypasses the Next.js HTTP layer)
4. Calls the apply engine, stores results in `apply_runs`

Watch the terminal output. For each application you'll see:
```
[Twin direct queue] <id>: portal=greenhouse timeout_ms=420000 attempt=1
```

Then one of:
- `status=applied` → success
- `status=requires_auth` → human verification needed (expected for SoloPulse/captcha)
- `status=failed` → inspect the error in the dashboard

### Step 4.5 — Inspect results

Open `http://localhost:3001/dashboard` and check:
- **Apply Runs** section shows the results
- **Blockers Summary** shows any unresolved required questions
- **Recovery Summary** shows if the engine had to retry

For detailed error payloads:
```bash
npm run report:daily:followups
cat reports/daily-followups-$(date +%Y-%m-%d).md
```

### Step 4.6 — Expected outcomes per portal

| Portal | Company | Expected result |
|--------|---------|-----------------|
| Greenhouse | Scale AI | `applied` or narrow field blocker |
| Greenhouse | Rendezvous Robotics | `applied` (ITAR now answered proactively) |
| Lever | SoloPulse | `requires_auth` (hCaptcha — expected) |
| Lever | WeRide | `applied` or `start_date`/`graduation` custom field blocker |

If you see a new blocker, record the exact error from the dashboard and fix the selector/hint before moving on.

### Step 4.7 — Requeue stale runs and retest

```bash
npm run queue:vetted:mvp   # requeues stale "running" rows too
npm run process:queue:direct
```

Repeat until at least one Greenhouse job and one Lever job reach `applied`.

---

## Part 5 — SMS Loop Validation (optional but recommended before deploy)

### Step 5.1 — Verify Plivo is configured

Check that these are set in `.env.local`:
```
SMS_PROVIDER=plivo
PLIVO_AUTH_ID=...
PLIVO_AUTH_TOKEN=...
PLIVO_PHONE_NUMBER=+1...  ← your Plivo sender number
```

### Step 5.2 — Onboard a real user with your phone number

1. Go to `http://localhost:3001/onboarding`
2. Complete all 5 steps including resume upload
3. Use your real phone number in Step 1

### Step 5.3 — Trigger an alert manually

```bash
curl -X POST http://localhost:3001/api/messaging/send-alert \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_APPLY_QUEUE_WORKER_SECRET" \
  -d '{"userId": "YOUR_USER_ID", "jobId": "YOUR_JOB_ID"}'
```

Or let the matching run naturally once jobs are in the DB (matching fires inside the job ingest flow).

### Step 5.4 — Reply YES to the SMS

Text `YES` back to your Plivo number.

### Step 5.5 — Process the queue

```bash
npm run process:queue:direct
```

The application for the job you said YES to should now process.

---

## Part 6 — Deploy the Apply Engine

> **Do this only after Part 4 is passing (at least one `applied` result per supported portal).**

### Step 6.1 — Choose a host

Recommended: **Railway** (simplest Dockerfile deploy with auto-SSL and health checks).

Alternative: Fly.io, Google Cloud Run, Render.

### Step 6.2 — Deploy to Railway

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
2. Select this repository
3. Railway will detect `apply_engine/railway.json` automatically
4. Set the **Root Directory** to `apply_engine/` in the Railway service settings
5. Add environment variables in the Railway dashboard:
   ```
   ANTHROPIC_API_KEY=...
   PORT=8000
   ```
6. Deploy. Wait for the health check at `/health` to pass (typically 3–5 minutes — Playwright install takes time).
7. Copy the public Railway URL (e.g. `https://twin-apply-engine.up.railway.app`)

### Step 6.3 — Update APPLY_ENGINE_BASE_URL

In Vercel (or your `.env.local` for local testing against the remote engine):
```
APPLY_ENGINE_BASE_URL=https://twin-apply-engine.up.railway.app
```

Redeploy Vercel (it will pick up the new env var automatically if set in Vercel dashboard).

### Step 6.4 — Verify the remote engine is reachable

```bash
curl https://twin-apply-engine.up.railway.app/health
# → {"status":"ok"}
```

---

## Part 7 — Deploy the Next.js App to Vercel

### Step 7.1 — Set all environment variables in Vercel

In the Vercel dashboard → Project → Settings → Environment Variables, add:

```
ANTHROPIC_API_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
APPLY_QUEUE_WORKER_SECRET
APPLY_ENGINE_BASE_URL        ← your Railway URL from Step 6.2
APPLY_ENGINE_TIMEOUT_MS=240000
APPLY_ENGINE_GREENHOUSE_TIMEOUT_MS=420000
SMS_PROVIDER=plivo
PLIVO_AUTH_ID
PLIVO_AUTH_TOKEN
PLIVO_PHONE_NUMBER
```

### Step 7.2 — Deploy

```bash
git push origin main
```

Vercel auto-deploys on push. Watch the build log — it should match `npm run build` output (26 routes, 0 errors).

### Step 7.3 — Smoke test production

1. Go to `https://your-app.vercel.app`
2. Click the CTA → complete onboarding → upload your real resume PDF
3. Check Supabase → `profiles` table → your row should have `resume_url` set
4. Check Supabase → Storage → `resumes/{your-user-id}/resume.pdf` should exist

---

## Part 8 — Set Up Automated Crons

### Step 8.1 — Add GitHub Actions secrets

In GitHub → repo → Settings → Secrets → Actions, add:

| Secret | Value |
|--------|-------|
| `TWIN_APP_BASE_URL` | `https://your-app.vercel.app` |
| `APPLY_QUEUE_WORKER_SECRET` | same as in `.env.local` |
| `NEXT_PUBLIC_SUPABASE_URL` | your Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | your service role key |
| `GEMINI_API_KEY` | optional — only needed for non-Greenhouse/Lever scraping |

### Step 8.2 — Understand the cron schedule

The workflow at `.github/workflows/twin-operations.yml` runs three jobs:

| Job | Schedule | What it does |
|-----|----------|--------------|
| `ingest-seed-jobs` | 1am + 1pm UTC daily | Loads `data/job-seeds/live-openings-2026.json` into Supabase |
| `expire-alerts` | Every 6 hours (offset 15min) | Marks old pending alerts as expired |
| `scrape-live-sources` | Every 4 hours | Scrapes Greenhouse + Lever boards from `scraper/career-page-links.json` |

### Step 8.3 — Trigger a manual run to verify

In GitHub → Actions → Twin Operations → Run workflow → check all three inputs → Run.

Watch the logs. `ingest-seed-jobs` should show `X jobs ingested`. `scrape-live-sources` should show sources attempted/succeeded counts.

### Step 8.4 — Set up Vercel cron for queue processing

The queue needs to be drained continuously. The cron endpoint is `/api/internal/cron/process-queue`.

In Vercel → Project → Settings → Crons, add:

```
Path: /api/internal/cron/process-queue
Schedule: */5 * * * *   (every 5 minutes)
```

Or manually trigger it:
```bash
curl -X POST https://your-app.vercel.app/api/internal/cron/process-queue \
  -H "Authorization: Bearer YOUR_APPLY_QUEUE_WORKER_SECRET"
```

> **Note:** The Vercel cron calls the Next.js route which calls the remote apply engine. Max execution time is 60s on Vercel hobby / 300s on pro. Set your plan accordingly. Greenhouse runs can take up to 420s — use the direct worker for those locally until you upgrade.

---

## Part 9 — Daily Operations

### Check the daily follow-up report

```bash
npm run report:daily:followups
cat reports/daily-followups-$(date +%Y-%m-%d).md
```

This shows any applications that were blocked by unresolved required questions, along with the exact prompt text. Answer them by texting the user's Twin number or updating `profiles.gray_areas.follow_up_answers`.

### Send the daily SMS follow-up batch

```bash
npm run send:daily:followups
```

Sends one SMS per user with open unresolved questions from yesterday's runs.

### Manually requeue a specific application

In the Supabase SQL editor:
```sql
update applications
set status = 'queued',
    queued_at = now(),
    started_at = null,
    worker_id = null,
    last_error = 'Manual requeue'
where id = 'YOUR_APPLICATION_ID';
```

Then run `npm run process:queue:direct` locally or wait for the next Vercel cron tick.

---

## Troubleshooting

### Apply engine returns 500 / connection refused

```bash
# Check it's running
curl http://127.0.0.1:8000/health

# Start it if not
./.venv/bin/uvicorn apply_engine.main:app --host 127.0.0.1 --port 8000
```

### "No module named 'playwright'" or Chromium not found

```bash
./.venv/bin/pip install -r apply_engine/requirements.txt
./.venv/bin/playwright install chromium
```

### Resume upload fails (storage bucket not found)

Run the migration:
```bash
npx supabase db push
# or paste supabase/migrations/20260331000000_resume_storage.sql into Supabase SQL editor
```

### ITAR question still blocking Greenhouse run

The fix adds `"itar"` and `"u.s. person"` to proactive hint matching. If still failing:
1. Check the run's `result_payload.error` in Supabase `apply_runs` for `question_debug:` output
2. The debug shows `exists`, `selected`, `hidden` values for the combobox
3. If `hidden` is empty after fill, the combobox commit is not sticking — re-run with the latest code

### Supabase `ENOTFOUND` errors in local queue runs

This is a DNS issue in sandboxed environments (e.g. Codex). Use `npm run process:queue:direct` which reads Supabase directly. Avoid running queue workers inside terminal-constrained shells.

### GitHub Actions scrape job failing

Check that the secrets are set (Step 8.1). The `GEMINI_API_KEY` is optional — the workflow uses `--skip-gemini` so only Greenhouse and Lever boards are scraped by default.

---

## Checklist — MVP is live when:

- [ ] `npm run build` passes (0 TS errors)
- [ ] `npm run test:apply-engine` passes (97+ tests)
- [ ] DB migration applied (`resume_url` column + `resumes` bucket exist)
- [ ] At least one Greenhouse job reaches `status=applied` in a local direct run
- [ ] At least one Lever job reaches `status=applied` or correctly `requires_auth`
- [ ] A real user can complete onboarding and has `resume_url` set in their profile
- [ ] Apply engine deployed and `/health` returns `{"status":"ok"}`
- [ ] `APPLY_ENGINE_BASE_URL` set in Vercel to the deployed engine URL
- [ ] GitHub Actions secrets set and `Twin Operations` workflow passes manually
- [ ] Vercel cron `/api/internal/cron/process-queue` configured
