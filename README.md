# Twin

> Build your profile once. Get alerted when jobs drop. Apply with one reply.

## Setup

**1. Clone and install**
```bash
git clone https://github.com/surajvaddi/placeholder1.git
cd placeholder1
npm install
```

**2. Add your environment variables**
```bash
cp .env.local.example .env.local
```
Open `.env.local` and add:
```
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
APPLY_ENGINE_BASE_URL=http://127.0.0.1:8000
APPLY_QUEUE_WORKER_SECRET=replace-with-a-long-random-secret
SMS_PROVIDER=plivo
```
Get your Anthropic key at [console.anthropic.com](https://console.anthropic.com).

**3. Set up Supabase**

Create a Supabase project, then run the SQL migrations in order:
```
supabase/migrations/20260329120000_initial_platform.sql
supabase/migrations/20260329143000_apply_runs.sql
supabase/migrations/20260329180000_application_queue.sql
supabase/migrations/20260329200000_status_applied.sql
supabase/migrations/20260329220000_profile_portal_fields.sql
supabase/migrations/20260329230000_jobs_portal_field.sql
supabase/migrations/20260329233000_jobs_url_uniqueness.sql
```

This creates the platform tables: `profiles`, `jobs`, `alerts`, `applications`, `apply_runs`.

**Enable Anonymous Auth** — in your Supabase dashboard go to:
`Authentication → Providers → Anonymous` and toggle it on.

Twin signs users in anonymously on onboarding load so their profile can be saved before they set a password. Without this, onboarding will fail with a 400 error.

**4. Run the apply engine**

In a separate terminal:
```bash
python3 -m venv .venv
./.venv/bin/python -m pip install -r apply_engine/requirements.txt
./.venv/bin/playwright install chromium
./.venv/bin/uvicorn apply_engine.main:app --reload
```

**5. Run**
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

**6. Queue processing**

For manual queue testing in the app:
- queue an application in `/apply-lab`
- click `Process next queued`

For background worker processing later:
- call `POST /api/internal/apply-queue/process`
- send `Authorization: Bearer $APPLY_QUEUE_WORKER_SECRET`
- run that from Railway cron or another worker trigger

**7. Batch job ingest**

Use the Python batcher to send scraped jobs into the Supabase-backed ingest API:
```bash
./.venv/bin/python apply_engine/scripts/ingest_jobs.py \
  --file path/to/jobs.json \
  --base-url http://localhost:3000 \
  --worker-secret "$APPLY_QUEUE_WORKER_SECRET"
```

The input file must be a JSON array of job objects. Minimum shape:
```json
[
  {
    "company": "Twin",
    "title": "Software Engineering Intern",
    "level": "internship",
    "location": "New York, NY",
    "url": "https://company.example/jobs/123",
    "application_url": "https://company.example/jobs/123/apply"
  }
]
```

**8. Low-cost deployment shape**

Use this stack:
- `Supabase` for auth + database
- `Vercel Hobby` for the Next app
- `GitHub Actions` for scheduled job ingestion and alert maintenance
- your local machine for Playwright-heavy queue processing until you decide to pay for a worker host

**9. Deploy to Vercel**

1. Push the repo to GitHub.
2. Import the repo into Vercel.
3. Add these Vercel environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
   - `APPLY_ENGINE_BASE_URL`
   - `APPLY_QUEUE_WORKER_SECRET`
   - `SMS_PROVIDER`
   - any provider-specific SMS secrets you use
4. Deploy.
5. Copy the deployed app URL, for example `https://your-app.vercel.app`.

**10. Configure GitHub Actions secrets**

In GitHub, go to `Settings -> Secrets and variables -> Actions` and add:
- `TWIN_APP_BASE_URL`
  - set this to your deployed app URL, for example `https://your-app.vercel.app`
- `APPLY_QUEUE_WORKER_SECRET`
  - set this to the same value used in Vercel

The scheduled workflow lives at:
`/.github/workflows/twin-operations.yml`

It does two things:
- ingests the repo seed jobs twice daily
- expires stale pending alerts every 6 hours

You can also run it manually from the GitHub Actions tab with `workflow_dispatch`.

---

## Flow

```
/ (landing)
  → /onboarding  (4 steps: profile → preferences → resume → phone)
  → /dashboard   (Twin status + application history)
```

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Styling | Tailwind CSS |
| Language | TypeScript |
| AI | Claude API (`claude-sonnet-4-6`) |
| PDF parsing | `pdf-parse` |
| Animations | Framer Motion |
| Persistence/Auth | Supabase |
| SMS | Plivo or Twilio |

---

## What's next

- [ ] Supabase auth + database (users, profiles, jobs, alerts, applications tables)
- [ ] Yutori Scouting API — 1 global scout, webhook on new jobs
- [ ] Matching logic — backend query against all user profiles on webhook
- [ ] Twilio SMS — outbound alerts + inbound YES/NO/STOP handler
- [ ] Resend email — alert delivery + apply CTA
- [ ] Yutori Browsing API — auto-apply agent per confirmed alert
- [ ] Stripe — Free / Pro / Turbo tiers
