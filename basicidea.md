# AutoApply — Full Product Spec
> Build your profile once. Get alerted when jobs drop. Apply with one reply.
---
## Overview
AutoApply is a web app for college students that monitors job boards continuously, alerts users the moment a matching job drops, and automatically submits applications via a web agent — all triggered by a single SMS reply or in-app tap.
**Core insight:** One global Scout watches all job boards. Per-user Browsing agents spin up only when a specific user confirms they want to apply to a specific job. This keeps costs low and the system scalable.
---
## Architecture
```
[Yutori Scouting API] — 1 global Scout, runs every 15 min (or a couple and also our own scrapers to add to our internships directory for all users)
         |
         v
[Your Backend] — matches new jobs against all user profiles
         |
         v
[Alert System] — Twilio SMS or Resend email per matched user
         |
    User replies YES
         |
         v
[Yutori Browsing API] — 1 task per user per application
         |
         v
[Status Update] — confirmation # back to user
```
### Why this structure
- **1 Scout, not N Scouts.** Running one Scout for all users vs. one per user cuts Scouting API costs by ~99%. The Scout surfaces jobs; your backend does the user-matching logic.
- **Browsing tasks are on-demand.** They only fire when a user confirms. No wasted agent runs.
- **Claude API handles all intelligence** — resume generation, cover letters, gray-area confirmations, JD parsing.
---
## User Flow
### 1. Onboarding
Collected on signup, takes ~5 minutes.
| Field | Type | Notes |
|---|---|---|
| Industries | Multi-select | SWE, Finance, Consulting, PM, Research, Data, Design, etc. |
| Job level | Multi-select | Internship, New Grad, Part-time, Co-op |
| Locations | Text + toggles | Cities + remote toggle |
| Notification preference | Radio | SMS (requires phone #) or email |
| Phone number | Text | Required for SMS tier |
| Email | Text | Always collected |
**Gray areas** — Claude suggests, user confirms:
- Expected salary range (Claude pulls market data via Research API for their industry/level/location)
- Visa sponsorship requirement
- Minimum company size
- Exclude certain companies or industries
These gray areas are shown as pre-filled suggestions with an "Edit" affordance — low friction, high accuracy.
---
### 2. Resume Builder
Chat-driven. User dumps raw experience; Claude structures it.
**Input modes:**
- Free-form dump: "I interned at Capital One, built an internal dashboard, reduced load time by 40%"
- Paste existing resume text
- Upload existing PDF (parsed and imported)
**What Claude does:**
- Maps raw experience to clean STAR-format bullets
- Quantifies where possible, flags gaps: "Can you add a metric here?"
- Constrains to role: "Only show SWE bullets for this tech internship"
- Generates cover letter templates per industry
**Data model — resume profile (stored as JSON in Supabase):**
```json
{
  "name": "Yash Patel",
  "email": "yash@email.com",
  "phone": "+1-XXX-XXX-XXXX",
  "education": [
    {
      "school": "University of Virginia",
      "degree": "B.S. Computer Science",
      "graduation": "May 2026",
      "gpa": "3.7"
    }
  ],
  "experience": [
    {
      "company": "Capital One",
      "title": "Software Engineering Intern",
      "dates": "Jun–Aug 2024",
      "bullets": [
        "Built internal React dashboard reducing analyst load time by 40%",
        "Designed REST API endpoints serving 500+ daily internal users"
      ],
      "tags": ["SWE", "frontend", "internship"]
    }
  ],
  "skills": ["Python", "React", "SQL", "Java"],
  "excess_pool": [
    "Led 3-person team building hackathon project, placed top 5 of 60 teams"
  ],
  "preferences": {
    "industries": ["SWE", "PM"],
    "levels": ["internship", "new_grad"],
    "locations": ["New York", "San Francisco", "remote"],
    "salary_min": 35,
    "sponsorship_required": false,
    "notification": "sms",
    "phone": "+1-XXX-XXX-XXXX"
  }
}
```
**Excess pool:** Bullets that don't fit on the main 1-page resume but are available for ATS keyword injection, cover letters, or longer-form applications.
---
### 3. Job Scouting (Global)
One Scouting API task monitors all major job boards on a rolling cadence.
**Scout query (example):**
```
Monitor the following job boards for new software engineering internship and new graduate postings:
LinkedIn Jobs, Handshake, Greenhouse-hosted job pages, Lever-hosted job pages, Workday portals,
and company career pages for: Google, Meta, Apple, Microsoft, Amazon, Stripe, Airbnb, Coinbase,
Jane Street, Two Sigma, Citadel, McKinsey, Bain, BCG.
Return structured data for each new posting: company, title, location, level (intern/new grad/full-time),
job description URL, posted date, application URL.
```
**Cadence:** Every 15 minutes for active job season (Aug–Nov, Jan–Mar), hourly otherwise.
**Output per job (stored in `jobs` table):**
```json
{
  "id": "uuid",
  "company": "Stripe",
  "title": "Software Engineering Intern – Summer 2026",
  "level": "internship",
  "location": "New York, NY",
  "remote": false,
  "industries": ["SWE", "fintech"],
  "url": "https://stripe.com/jobs/...",
  "application_url": "https://stripe.com/jobs/.../apply",
  "posted_at": "2026-03-28T14:22:00Z",
  "jd_summary": "...",
  "scraped_at": "2026-03-28T14:35:00Z"
}
```
---
### 4. Matching Logic (Backend)
When the Scout webhook fires with new jobs, the backend matches each job against all active user profiles.
**Match criteria:**
```python
def is_match(job, user_prefs):
    level_match = job["level"] in user_prefs["levels"]
    industry_match = any(i in job["industries"] for i in user_prefs["industries"])
    location_match = (
        job["remote"] and user_prefs.get("remote_ok")
        or any(loc.lower() in job["location"].lower() for loc in user_prefs["locations"])
    )
    sponsorship_ok = not user_prefs["sponsorship_required"] or job.get("sponsors_visa")
    return level_match and industry_match and location_match and sponsorship_ok
```
Matched (job, user) pairs are written to an `alerts` table with status `pending`.
---
### 5. Alert
**SMS format (Twilio):**
```
📌 SWE Intern @ Stripe | New York | Posted 4 min ago
stripe.com/jobs/...
Reply YES to auto-apply, NO to skip, or STOP to pause alerts.
```
**Email format (Resend):**
Subject: `New match: SWE Intern @ Stripe`
Body includes job title, company, location, posted time, link, and a single CTA button: "Apply with AutoApply."
**Reply handling:**
| Reply | Action |
|---|---|
| YES / yes / y | Triggers Browsing API apply task |
| NO / no / n | Marks alert skipped, logs for feedback |
| STOP | Pauses alerts for user |
| Anything else | Re-prompts: "Reply YES to apply or NO to skip." |
**Confirmation timeout:** If no reply within 6 hours, alert expires. Configurable per user (Turbo tier can set to 0 = fully automatic, no confirmation needed).
---
### 6. Auto-Apply (Browsing API)
When a user confirms, the backend fires a Yutori Browsing API task.
**Task prompt (dynamically generated):**
```
Apply to the job at this URL: {application_url}
Applicant information:
- Name: {name}
- Email: {email}
- Phone: {phone}
- University: {school}, {degree}, graduating {graduation}
- GPA: {gpa} (include if asked)
- Resume: [attached PDF]
For open-ended questions about experience, use these bullet points:
{relevant_bullets}
For "Why do you want to work here?" use this cover letter excerpt:
{cover_letter_snippet}
For salary expectations, enter: {salary_min}–{salary_max}
If you encounter a CAPTCHA or login wall, stop and return status "requires_auth".
If the application is successfully submitted, return the confirmation number or page text.
```
**Task config:**
```json
{
  "task": "...",
  "require_auth": true,
  "attachments": [{ "name": "resume.pdf", "data": "<base64>" }]
}
```
**On completion:**
- Success: Send user confirmation — "✅ Applied to Stripe — confirmation #ABC123"
- Requires auth: Send manual fallback link — "⚠️ Stripe requires login. Apply here: {url}"
- Failed: Flag for manual review, notify user with direct link
**Cover letter generation:**
Before firing the Browsing task, Claude generates a tailored cover letter snippet using:
- Job description (fetched via Research API or Browsing API)
- User's resume bullets
- Company name + role
---
## Data Model (Supabase)
### Tables
**users**
- id, email, phone, notification_pref, created_at, tier
**profiles**
- user_id, resume_json (full JSON blob), updated_at
**jobs**
- id, company, title, level, location, remote, industries[], url, application_url, jd_summary, posted_at, scraped_at
**alerts**
- id, user_id, job_id, status (pending / confirmed / skipped / expired / applied / failed), alerted_at, replied_at
**applications**
- id, user_id, job_id, alert_id, status, confirmation_text, applied_at, browsing_task_id
---
## Tech Stack
| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js + Tailwind | Fast to ship, easy to deploy on Vercel |
| Backend | Next.js API routes or FastAPI | API routes for MVP, FastAPI if you need async job queues |
| Database | Supabase | Auth + Postgres + realtime, free tier covers MVP |
| Job scouting | Yutori Scouting API | 1 global Scout, webhook on updates |
| Auto-apply | Yutori Browsing API | require_auth=true, dynamic prompt per application |
| JD enrichment | Yutori Research API | Pull full JD text, company info for cover letters |
| Resume chatbot | Claude API (claude-sonnet-4-6) | Bullet generation, cover letters, gray-area suggestions |
| SMS | Twilio | Inbound + outbound, YES/NO reply parsing |
| Email | Resend | Transactional, clean templates |
| Resume PDF | react-pdf or Puppeteer | Generate PDF from JSON profile for upload |
| Job queue | Inngest or BullMQ | Handle Browsing API tasks async |
| Payments | Stripe | Subscriptions, free tier enforcement |
---
## Pricing
| Tier | Price | Features |
|---|---|---|
| Free | $0 | 3 auto-applies/month, email alerts only, 24hr alert window |
| Pro | $12/mo | Unlimited applies, SMS alerts, cover letter generation, 6hr alert window |
| Turbo | $25/mo | Fully automatic (no confirmation needed), priority scouting, 15-min cadence |
**Unit economics (rough):**
- Yutori Browsing API: ~$0.10–0.50 per application (estimate)
- Claude API: ~$0.02 per cover letter
- Twilio SMS: ~$0.01 per message
- Pro user applying to 20 jobs/month ≈ ~$3–5 in COGS → healthy margin at $12/mo
---
## MVP Sprint Plan
- [ ] Supabase setup: users, profiles tables, auth
- [ ] Onboarding form: industry, level, location, notification prefs
- [ ] Gray-area confirmation flow (Claude suggests salary range, etc.)
- [ ] Resume chatbot: free-form dump → STAR bullets via Claude API
- [ ] Excess pool: separate bucket for overflow bullets
- [ ] Resume preview + edit UI
- [ ] PDF export from profile JSON
- [ ] Scouting API integration: create 1 global Scout, store jobs in DB
- [ ] Matching logic: backend query against all user profiles on webhook
- [ ] Alert system: Twilio SMS + Resend email
- [ ] Reply parsing: YES/NO/STOP inbound SMS handler
- [ ] Browsing API integration: dynamic prompt builder + task fire
- [ ] Status webhook: update applications table on task completion
- [ ] Confirmation message back to user
### Week 3 — Polish + Payments
- [ ] Stripe subscriptions: Free / Pro / Turbo enforcement
- [ ] Dashboard: application history, status, confirmation #s
- [ ] Cover letter generation (Research API → Claude)
- [ ] Failed application fallback flow
- [ ] Waitlist → invite flow for controlled launch
---
## Key Risks + Mitigations
| Risk | Mitigation |
|---|---|
| Browsing API fails on auth-gated portals | Use require_auth=true; fallback to manual link |
| Job boards block scraping | Yutori handles anti-bot; diversify sources |
| User applies to wrong job | Show job title/company in alert, require explicit YES |
| COGS spike if Browsing API is expensive | Cap free tier at 3 applies; Turbo pricing absorbs higher usage |
| SMS reply parsing edge cases | Conservative parser: only YES/NO/STOP trigger actions; anything else re-prompts |
| Resume doesn't map well to application form | Log failed fields; flag for manual review with pre-filled fallback link |
---