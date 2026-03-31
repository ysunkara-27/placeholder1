# AutoApply — Master TODO (March 30, 2026)
## Full MVP Build Plan for Codex

This document is a complete, ordered build plan. Each task includes exact file paths, implementation details, and verification steps. Codex should execute tasks in order — earlier tasks are dependencies for later ones.

---

## CURRENT STATE SUMMARY

**What works:**
- Database schema fully migrated (7 migrations applied)
- Job scraper runs: 1540 sources → 315 jobs in Supabase
- Supabase direct ingest working (bypassing Next.js route)
- Resume: PDF parse → Claude structure → annotator UI
- Onboarding: 5-step flow with all fields
- Apply engine: Python + Playwright with Greenhouse/Lever/Workday agents
- Matching: Score-based job→profile algorithm
- SMS flow: Inbound webhook, confirm/skip/stop normalization
- Alert creation on job ingest
- Application queue + claim_next RPC

**What's broken / missing:**
1. `/api/jobs/ingest` route returns 500 (Next.js-level crash, needs debugging)
2. Auth flow: Anonymous auth works but no persistent accounts (Google OAuth not wired to profiles)
3. Dashboard: Shows placeholders, not real data
4. Apply engine: Not deployed, no connection to Next.js in production
5. Playwright form filling: Agents exist but are incomplete for many portals/form variants
6. EEO autofill: Fields exist in DB but not sent to apply engine
7. Resume upload: Not sent to apply engine (no PDF path, just JSON)
8. Multi-step forms: `next` button navigation incomplete
9. Cron jobs: Not scheduled anywhere
10. Ashby portal: 18 sources, no adapter
11. SmartRecruiters: 3 sources, no adapter
12. No rate-limit / retry on Gemini scrape failures
13. No admin dashboard to monitor runs
14. Missing: full-page form analysis for all 6+ portal types
15. Missing: `required` field detection on all portal form types

---

## PHASE 0 — FIX CRITICAL BLOCKERS (Do First)

### 0.1 — Fix `/api/jobs/ingest` 500 Error

**File:** `app/api/jobs/ingest/route.ts`

**Problem:** Route returns 500 "Internal Server Error" (no JSON body). The middleware runs `supabase.auth.getSession()` on ALL routes which may be timing out or crashing before the route handler.

**Fix Steps:**
1. Add `export const dynamic = "force-dynamic"` to the route file
2. Exclude `/api/*` paths from the middleware matcher:

```typescript
// middleware.ts — update matcher config
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|api/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
```

3. Verify fix: `curl -X POST http://localhost:3000/api/jobs/ingest -H "Authorization: Bearer ..." -H "Content-Type: application/json" -d '{...valid payload...}'` → should return 200 or 422 (not 500)

**Also add `APPLY_QUEUE_WORKER_SECRET` to `.env.local`:**
```
APPLY_QUEUE_WORKER_SECRET=ioeruvhiowuehoweiruhvoiuervhorui4vh378reofwvhwiervuh3
```

---

### 0.2 — Fix Supabase Direct Ingest for Production Scraper Runs

**File:** `scraper/ingest_jobs.py`

**Problem:** `SUPABASE_URL` env var name — the app uses `NEXT_PUBLIC_SUPABASE_URL`. The scraper needs its own env vars.

**Fix:** Add to `scraper/README.md` and update `ingest_jobs.py` to try both:
```python
url = (
    supabase_url
    or os.environ.get("SUPABASE_URL")
    or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
)
```

---

### 0.3 — Wire APPLY_QUEUE_WORKER_SECRET Consistently

**Files to check:**
- `.env.local` → add `APPLY_QUEUE_WORKER_SECRET=<same secret>`
- Vercel env vars → add same value
- `scraper/ingest_jobs.py` → currently pushes direct to Supabase (no worker secret needed ✓)
- `app/api/internal/cron/process-queue/route.ts` → already reads from env ✓

---

## PHASE 1 — COMPLETE THE ONBOARDING FLOW

### 1.1 — Phone Number + SMS Opt-In Step

**Current state:** `components/onboarding/step-phone.tsx` exists but SMS opt-in not fully wired to `profiles` table.

**File:** `components/onboarding/step-phone.tsx`

**Requirements:**
- Phone input with E.164 formatting validation (`+1XXXXXXXXXX`)
- Toggle: "Text me when a match drops" → sets `sms_opt_in = true`
- Toggle: Provider choice (auto-detect based on PLIVO_AUTH_ID presence — default Plivo)
- "Skip for now" ghost button → sets phone = "", sms_opt_in = false
- Validation: skip OR (phone.length >= 10 AND looks like valid number)

**File:** `lib/platform/profile.ts` → `mapProfileToUpsertInput()`

Add to upsert payload:
```typescript
phone: formData.phone || null,
sms_opt_in: formData.sms_opt_in ?? false,
sms_provider: "plivo",  // hardcode for now
```

---

### 1.2 — Onboarding → Profile Save with All New Fields

**File:** `app/onboarding/page.tsx`

The final submit must include ALL fields from all 5 steps. Current gaps:

```typescript
// Ensure these fields are included in mapProfileToUpsertInput:
city: formData.city,
state_region: formData.state_region,
country: formData.country || "United States",
linkedin_url: formData.linkedin_url || null,
website_url: formData.website_url || null,
github_url: formData.github_url || null,
major: formData.major,
authorized_to_work: formData.authorized_to_work ?? true,
visa_type: formData.visa_type || "citizen",
earliest_start_date: formData.earliest_start_date || null,
eeo: formData.eeo || null,
resume_json: formData.annotatedResume,
gray_areas: formData.gray_areas,
onboarding_completed: true,
```

---

### 1.3 — Auth: Link Anonymous → Real Account (Google OAuth)

**File:** `app/auth/page.tsx` + `app/auth/callback/route.ts`

**Current state:** Supabase anonymous auth fires on onboarding start. User may later want to sign in with Google.

**Requirements:**
1. After onboarding: Show "Save your account with Google" CTA on dashboard
2. `supabase.auth.linkIdentity({ provider: "google" })` to upgrade anon → real user
3. Auth callback preserves profile data (no re-onboarding)
4. Guard `/dashboard` and `/apply-lab` (middleware already does this ✓)

**File:** `app/dashboard/page.tsx`

Add at top of dashboard if `user.is_anonymous`:
```tsx
<div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center justify-between">
  <div>
    <p className="font-semibold text-amber-900">Your session is temporary</p>
    <p className="text-sm text-amber-700">Sign in with Google to keep your Twin forever.</p>
  </div>
  <Button onClick={() => supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: "/auth/callback" } })}>
    Save with Google
  </Button>
</div>
```

---

## PHASE 2 — DASHBOARD (REAL DATA)

### 2.1 — Dashboard with Live Supabase Data

**File:** `app/dashboard/page.tsx`

**Current state:** Shows placeholder/hardcoded values.

**Requirements — full rewrite:**

```typescript
// On mount:
// 1. Get user session
// 2. Fetch profile (onboarding_completed check → redirect if false)
// 3. Fetch recent alerts (with job data joined)
// 4. Fetch recent applications (with job data joined)
// 5. Compute stats: total alerts, confirmed, applied, pending

// Layout:
// - Header: "AutoApply" + user name + Sign out
// - Banner if anonymous: "Save with Google" CTA
// - H1: "Your Twin is live, {name}."
// - Animated shimmer bar (indigo, shows active monitoring)
// - TwinStats row: Applied (count), Pending (count), Matched (count)
// - Alerts section: List of recent alerts with job details + status badges
// - Applications section: List with status (queued, running, applied, failed)
// - Settings summary at bottom: industries, levels, locked/flexible counts
```

**API calls to implement:**
- `GET /api/alerts/recent` → already exists ✓, verify join includes job data
- `GET /api/applications/recent` → already exists ✓

**`components/dashboard/twin-stats.tsx`** (rewrite):
```typescript
interface TwinStatsProps {
  applied: number
  pending: number
  matched: number
}
// Three cards, pulsing indigo dot in "Pending" card
```

**`components/dashboard/applications-list.tsx`** (rewrite):
```typescript
// Show: company, title, level badge, status badge, applied_at
// Status colors: queued=gray, running=blue pulsing, applied=green, failed=red, requires_auth=orange
// Empty state: pulsing ring + "Your Twin is scanning..."
```

---

### 2.2 — Real-Time Alert Feed

**File:** `app/dashboard/page.tsx`

Use Supabase Realtime to subscribe to new alerts:
```typescript
const channel = supabase
  .channel("alerts")
  .on("postgres_changes", {
    event: "INSERT",
    schema: "public",
    table: "alerts",
    filter: `user_id=eq.${user.id}`,
  }, (payload) => {
    setAlerts(prev => [payload.new, ...prev])
  })
  .subscribe()
```

---

## PHASE 3 — PLAYWRIGHT FORM AUTOFILLING (CORE MVP FEATURE)

This is the most important section. Every portal requires its own selector map and field handling logic.

### 3.1 — Greenhouse Form Analysis & Complete Agent

**Portal:** `greenhouse`
**URLs:** `https://boards.greenhouse.io/{token}/jobs/{id}` and `https://job-boards.greenhouse.io/{token}/jobs/{id}`

**Form Fields (comprehensive):**

```python
# apply_engine/portal_specs.py — GREENHOUSE_SELECTORS (complete map)
GREENHOUSE_SELECTORS = {
    # Contact
    "first_name": "input#first_name",
    "last_name": "input#last_name",
    "email": "input#email",
    "phone": "input#phone",
    "location": "input#job_application_location",

    # Social / Web
    "linkedin": "input[name*='linkedin']",
    "website": "input[name*='website'], input[name*='personal_website']",
    "github": "input[name*='github']",

    # Resume
    "resume_upload": "input#resume",
    "resume_paste": "textarea#resume_text",

    # Work authorization
    "authorized_yes": "input#job_application_answers_attributes_0_boolean_value_true",
    "authorized_no": "input#job_application_answers_attributes_0_boolean_value_false",
    "sponsorship_yes": "input[id*='sponsorship'][value='true']",
    "sponsorship_no": "input[id*='sponsorship'][value='false']",

    # EEO (dynamically rendered — detect by text/aria label)
    "gender_select": "select#job_application_answers_attributes_gender_answer_text",
    "race_select": "select#job_application_answers_attributes_race_answer_text",
    "veteran_select": "select#job_application_answers_attributes_veteran_answer_text",
    "disability_select": "select#job_application_answers_attributes_disability_answer_text",

    # Custom questions (label-based detection — see 3.5)
    "start_date": "input[name*='start_date'], input[name*='availability']",
    "salary": "input[name*='salary'], input[name*='compensation']",

    # Navigation
    "submit": "input[type='submit'], button[type='submit']",
    "next": "button:has-text('Next'), button:has-text('Continue')",
}
```

**`apply_engine/agents/greenhouse.py` — Complete Implementation:**

```python
class GreenhouseAgent(PortalAgent):
    async def apply(self, request: ApplyRequest) -> ApplyResult:
        actions = self._build_actions(request.profile)

        if request.dry_run:
            return ApplyResult(
                portal="greenhouse",
                status="planned",
                actions=actions,
                confirmation_snippet=None,
                error=None,
                screenshots=[],
            )

        screenshots = []
        try:
            async def worker(page):
                # 1. Wait for form to load
                await page.wait_for_selector("form#application_form, form.application-form", timeout=10000)

                # 2. Fill resume (upload preferred, paste fallback)
                if request.profile.resume_pdf_path:
                    upload_el = await page.query_selector(GREENHOUSE_SELECTORS["resume_upload"])
                    if upload_el:
                        await page.set_input_files(GREENHOUSE_SELECTORS["resume_upload"], request.profile.resume_pdf_path)
                    else:
                        # Paste resume text fallback
                        resume_text = request.profile.resume_text or ""
                        await page.fill(GREENHOUSE_SELECTORS["resume_paste"], resume_text[:5000])

                # 3. Execute standard field actions
                await execute_actions(page, actions)

                # 4. Handle custom questions (label-based detection)
                await self._fill_custom_questions(page, request.profile)

                # 5. Screenshot before submit
                screenshots.append(await capture_page_screenshot(page, "pre_submit"))

                # 6. Submit
                confirmation = await complete_submission_flow(
                    page,
                    submit_selector=GREENHOUSE_SELECTORS["submit"],
                    next_selector=GREENHOUSE_SELECTORS["next"],
                    max_steps=6,
                )

                screenshots.append(await capture_page_screenshot(page, "post_submit"))
                return confirmation

            confirmation = await run_with_chromium(request.url, worker)
            return ApplyResult(
                portal="greenhouse",
                status="applied",
                confirmation_snippet=confirmation[:500] if confirmation else None,
                actions=actions,
                error=None,
                screenshots=screenshots,
            )

        except AuthRequiredError as e:
            return ApplyResult(portal="greenhouse", status="requires_auth", error=str(e), screenshots=screenshots, actions=actions, confirmation_snippet=None)
        except SubmissionBlockedError as e:
            return ApplyResult(portal="greenhouse", status="failed", error=str(e), screenshots=screenshots, actions=actions, confirmation_snippet=None)
        except Exception as e:
            return ApplyResult(portal="greenhouse", status="failed", error=str(e), screenshots=screenshots, actions=actions, confirmation_snippet=None)

    async def _fill_custom_questions(self, page, profile):
        """
        Greenhouse custom questions use label text to identify fields.
        Strategy: Find all labels, match to known question patterns, fill.
        """
        # Find all question containers
        containers = await page.query_selector_all(".field")
        for container in containers:
            label_el = await container.query_selector("label")
            if not label_el:
                continue
            label_text = (await label_el.inner_text()).lower().strip()

            # Start date
            if any(kw in label_text for kw in ["start date", "available", "when can you"]):
                inp = await container.query_selector("input[type='text'], input[type='date']")
                if inp and profile.start_date:
                    await inp.fill(profile.start_date)

            # Salary / compensation
            elif any(kw in label_text for kw in ["salary", "compensation", "pay"]):
                inp = await container.query_selector("input[type='text'], input[type='number']")
                if inp and profile.salary_expectation:
                    await inp.fill(str(profile.salary_expectation))

            # Sponsorship
            elif any(kw in label_text for kw in ["sponsorship", "visa", "authorize"]):
                yes_radio = await container.query_selector("input[value='true'], input[value='yes']")
                no_radio = await container.query_selector("input[value='false'], input[value='no']")
                if profile.sponsorship_required and yes_radio:
                    await yes_radio.click()
                elif not profile.sponsorship_required and no_radio:
                    await no_radio.click()

            # Gender (EEO)
            elif "gender" in label_text:
                sel = await container.query_selector("select")
                if sel and profile.eeo and profile.eeo.get("gender"):
                    await sel.select_option(label=profile.eeo["gender"])

            # Race (EEO)
            elif any(kw in label_text for kw in ["race", "ethnicity"]):
                sel = await container.query_selector("select")
                if sel and profile.eeo and profile.eeo.get("race_ethnicity"):
                    await sel.select_option(label=profile.eeo["race_ethnicity"])

            # Veteran
            elif "veteran" in label_text:
                sel = await container.query_selector("select")
                if sel and profile.eeo and profile.eeo.get("veteran_status"):
                    await sel.select_option(label=profile.eeo["veteran_status"])

            # Disability
            elif "disability" in label_text or "disabled" in label_text:
                sel = await container.query_selector("select")
                if sel and profile.eeo and profile.eeo.get("disability_status"):
                    await sel.select_option(label=profile.eeo["disability_status"])

    def _build_actions(self, profile) -> list[PlannedAction]:
        s = GREENHOUSE_SELECTORS
        actions = []
        def add(action, selector, value, required=False):
            actions.append(PlannedAction(action=action, selector=selector, value=value, required=required))

        add("fill", s["first_name"], profile.first_name, required=True)
        add("fill", s["last_name"], profile.last_name, required=True)
        add("fill", s["email"], profile.email, required=True)
        if profile.phone:
            add("fill", s["phone"], profile.phone)
        if profile.linkedin:
            add("fill", s["linkedin"], profile.linkedin)
        if profile.website:
            add("fill", s["website"], profile.website)
        if profile.github:
            add("fill", s["github"], profile.github)

        # Work authorization
        if profile.work_authorization:
            add("click", s["authorized_yes"], "", required=False)
        else:
            add("click", s["authorized_no"], "", required=False)

        # Sponsorship
        if profile.sponsorship_required:
            add("click", s["sponsorship_yes"], "", required=False)
        else:
            add("click", s["sponsorship_no"], "", required=False)

        return actions
```

---

### 3.2 — Lever Form Analysis & Complete Agent

**Portal:** `lever`
**URLs:** `https://jobs.lever.co/{company}/{job-id}/apply`

**Form Structure:**
Lever apply forms are hosted at `/apply` suffix on job postings. They're mostly single-page forms with standard fields.

```python
# apply_engine/portal_specs.py — LEVER_SELECTORS
LEVER_SELECTORS = {
    "first_name": "input[name='name']",  # Lever uses full name in one field OR split
    "full_name": "input[name='name']",
    "first_name_split": "input[name='org-firstName'], input[name='firstname']",
    "last_name_split": "input[name='org-lastName'], input[name='lastname']",
    "email": "input[name='email']",
    "phone": "input[name='phone']",
    "org": "input[name='org']",  # "How did you hear about us" or company name

    # Social
    "linkedin": "input[name='urls[LinkedIn]'], input[name='urls[Linkedin]']",
    "twitter": "input[name='urls[Twitter]']",
    "github": "input[name='urls[GitHub]'], input[name='urls[Github]']",
    "portfolio": "input[name='urls[Portfolio]'], input[name='urls[Other]']",

    # Resume
    "resume_upload": "input[type='file'][name='resume']",
    "resume_upload_alt": "input[type='file']",

    # Location
    "location": "input[name='location']",

    # Custom
    "additional_info": "textarea[name='comments']",

    # Navigation
    "submit": "button[type='submit']:has-text('Submit application'), button:has-text('Submit')",
}
```

**`apply_engine/agents/lever.py` — Complete Implementation:**

```python
class LeverAgent(PortalAgent):
    async def apply(self, request: ApplyRequest) -> ApplyResult:
        # Lever apply URL = job URL + "/apply"
        apply_url = request.url
        if not apply_url.endswith("/apply"):
            apply_url = apply_url.rstrip("/") + "/apply"

        actions = self._build_actions(request.profile)

        if request.dry_run:
            return ApplyResult(portal="lever", status="planned", actions=actions, ...)

        screenshots = []
        try:
            async def worker(page):
                await page.wait_for_selector("form.application-form, form[data-qa='lever-apply']", timeout=10000)

                # Detect name field style (full vs split)
                full_name_el = await page.query_selector(LEVER_SELECTORS["full_name"])
                if full_name_el:
                    await full_name_el.fill(f"{request.profile.first_name} {request.profile.last_name}")
                else:
                    first_el = await page.query_selector(LEVER_SELECTORS["first_name_split"])
                    last_el = await page.query_selector(LEVER_SELECTORS["last_name_split"])
                    if first_el:
                        await first_el.fill(request.profile.first_name)
                    if last_el:
                        await last_el.fill(request.profile.last_name)

                # Fill standard fields
                await page.fill(LEVER_SELECTORS["email"], request.profile.email)
                if request.profile.phone:
                    phone_el = await page.query_selector(LEVER_SELECTORS["phone"])
                    if phone_el:
                        await phone_el.fill(request.profile.phone)

                # Resume upload
                if request.profile.resume_pdf_path:
                    resume_el = await page.query_selector(LEVER_SELECTORS["resume_upload"])
                    if resume_el:
                        await page.set_input_files(LEVER_SELECTORS["resume_upload"], request.profile.resume_pdf_path)

                # Social links
                for field, value in [
                    ("linkedin", request.profile.linkedin),
                    ("github", request.profile.github),
                    ("portfolio", request.profile.website),
                ]:
                    if value:
                        el = await page.query_selector(LEVER_SELECTORS[field])
                        if el:
                            await el.fill(value)

                # Custom questions (Lever uses free-text textareas for custom)
                await self._fill_custom_questions(page, request.profile)

                screenshots.append(await capture_page_screenshot(page, "pre_submit"))
                confirmation = await complete_submission_flow(
                    page,
                    submit_selector=LEVER_SELECTORS["submit"],
                    next_selector=None,  # Lever is single-page
                    max_steps=1,
                )
                screenshots.append(await capture_page_screenshot(page, "post_submit"))
                return confirmation

            confirmation = await run_with_chromium(apply_url, worker)
            return ApplyResult(portal="lever", status="applied", confirmation_snippet=confirmation[:500], ...)

        except AuthRequiredError as e:
            return ApplyResult(portal="lever", status="requires_auth", error=str(e), ...)
        except Exception as e:
            return ApplyResult(portal="lever", status="failed", error=str(e), ...)

    async def _fill_custom_questions(self, page, profile):
        # Lever custom questions: all textareas not already filled
        textareas = await page.query_selector_all("textarea")
        for ta in textareas:
            name = await ta.get_attribute("name")
            if name and "card[" in name:  # Lever custom question pattern
                placeholder = (await ta.get_attribute("placeholder") or "").lower()
                # Fill generic "tell us about yourself" questions
                if any(kw in placeholder for kw in ["tell us", "describe", "why", "about yourself"]):
                    await ta.fill(f"I am a {profile.graduation_window or 'recent'} graduate excited about this opportunity.")
```

---

### 3.3 — Workday Form Analysis & Complete Agent

**Portal:** `workday`
**URLs:** `https://{company}.wd5.myworkdayjobs.com/...` or `https://wd3.myworkdayjobs.com/...`

Workday is a SPA with heavy JavaScript. Requires special handling.

```python
# apply_engine/portal_specs.py — WORKDAY_SELECTORS
WORKDAY_SELECTORS = {
    # Workday uses data-automation-id attributes (more stable than CSS class names)
    "apply_button": "[data-automation-id='applyNowButton']",
    "sign_in_later": "[data-automation-id='signInLaterLink'], text='Continue Without Signing In'",

    # Contact Info page
    "first_name": "[data-automation-id='firstName']",
    "last_name": "[data-automation-id='lastName']",
    "email": "[data-automation-id='email']",
    "phone_device_type": "[data-automation-id='phone-device-type']",
    "phone": "[data-automation-id='phone']",
    "phone_country": "[data-automation-id='countryPhoneCode']",
    "address_line1": "[data-automation-id='addressSection'] input[data-automation-id='addressLine1']",
    "city": "[data-automation-id='city']",
    "state": "[data-automation-id='state']",
    "zip": "[data-automation-id='postalCode']",
    "country": "[data-automation-id='country']",

    # Source
    "source_prompt": "[data-automation-id='sourcePrompt']",

    # Resume
    "resume_upload": "[data-automation-id='file-upload-input-ref']",
    "resume_section": "[data-automation-id='resumeAttachmentSection']",

    # Work experience / education (Workday can auto-parse from resume)
    "autofill_from_resume": "[data-automation-id='parseResumeButton']",

    # Work authorization
    "work_auth_section": "[data-automation-id='workAuthorizationSection']",
    "legally_authorized_yes": "[data-automation-id='legallyAuthorized'] [data-automation-id='True']",
    "legally_authorized_no": "[data-automation-id='legallyAuthorized'] [data-automation-id='False']",
    "sponsorship_yes": "[data-automation-id='requireSponsorship'] [data-automation-id='True']",
    "sponsorship_no": "[data-automation-id='requireSponsorship'] [data-automation-id='False']",

    # Voluntary Disclosures (EEO)
    "gender_select": "[data-automation-id='gender'] select, [data-automation-id='gender'] [role='combobox']",
    "hispanic_select": "[data-automation-id='hispanicOrLatino'] select",
    "race_select": "[data-automation-id='race'] select",
    "veteran_select": "[data-automation-id='veteranStatus'] select",
    "disability_select": "[data-automation-id='disability'] select",

    # Navigation
    "next": "[data-automation-id='bottom-navigation-next-button']",
    "save_continue": "[data-automation-id='saveAndContinueButton']",
    "submit": "[data-automation-id='submit-button'], button:has-text('Submit')",
    "review": "[data-automation-id='reviewButton']",
}
```

**`apply_engine/agents/workday.py` — Complete Implementation:**

```python
class WorkdayAgent(PortalAgent):
    """
    Workday is a multi-step SPA. Steps:
    1. Landing page → click Apply
    2. Sign In / Continue without signing in
    3. Upload resume (triggers auto-parse)
    4. Review auto-parsed experience/education (skip if looks right)
    5. Fill contact info
    6. Work authorization
    7. Voluntary disclosures (EEO)
    8. Self-identify (disability)
    9. Review & submit

    Strategy: max_steps=10 next clicks, detect each page by section heading.
    """

    async def apply(self, request: ApplyRequest) -> ApplyResult:
        if request.dry_run:
            return ApplyResult(portal="workday", status="planned", actions=self._build_planned_actions(request.profile), ...)

        screenshots = []
        try:
            async def worker(page):
                # Step 0: Wait for initial page load
                await page.wait_for_load_state("networkidle", timeout=20000)

                # Step 1: Click Apply button if present (some links go direct to form)
                apply_btn = await page.query_selector(WORKDAY_SELECTORS["apply_button"])
                if apply_btn:
                    await apply_btn.click()
                    await page.wait_for_load_state("networkidle", timeout=15000)

                # Step 2: Continue without signing in
                await self._try_click(page, WORKDAY_SELECTORS["sign_in_later"])

                # Multi-step form loop
                for step in range(12):
                    page_heading = await self._get_page_heading(page)
                    screenshots.append(await capture_page_screenshot(page, f"step_{step}_{page_heading}"))

                    if await self._is_confirmation(page):
                        break

                    if "resume" in page_heading.lower():
                        await self._handle_resume_page(page, request.profile)

                    elif "contact" in page_heading.lower() or "application" in page_heading.lower():
                        await self._handle_contact_page(page, request.profile)

                    elif "work authorization" in page_heading.lower() or "authorization" in page_heading.lower():
                        await self._handle_work_auth_page(page, request.profile)

                    elif "voluntary" in page_heading.lower() or "disclosures" in page_heading.lower() or "self-identify" in page_heading.lower():
                        await self._handle_eeo_page(page, request.profile)

                    elif "review" in page_heading.lower():
                        # Final review page — click submit
                        submit_el = await page.query_selector(WORKDAY_SELECTORS["submit"])
                        if submit_el:
                            await submit_el.click()
                            await page.wait_for_load_state("networkidle", timeout=15000)
                            break

                    # Click Next / Save & Continue
                    next_el = await page.query_selector(WORKDAY_SELECTORS["next"])
                    if not next_el:
                        next_el = await page.query_selector(WORKDAY_SELECTORS["save_continue"])
                    if next_el:
                        await next_el.click()
                        await page.wait_for_load_state("networkidle", timeout=10000)
                    else:
                        break  # No next button, done

                body = await page.locator("body").inner_text()
                return body[:1000]

            confirmation = await run_with_chromium(request.url, worker)
            return ApplyResult(portal="workday", status="applied", confirmation_snippet=confirmation[:500], ...)

        except AuthRequiredError as e:
            return ApplyResult(portal="workday", status="requires_auth", error=str(e), ...)
        except Exception as e:
            return ApplyResult(portal="workday", status="failed", error=str(e), ...)

    async def _handle_resume_page(self, page, profile):
        if profile.resume_pdf_path:
            upload_el = await page.query_selector(WORKDAY_SELECTORS["resume_upload"])
            if upload_el:
                await page.set_input_files(WORKDAY_SELECTORS["resume_upload"], profile.resume_pdf_path)
                await page.wait_for_timeout(3000)  # Wait for parse
                # Click "Parse resume" if available
                parse_btn = await page.query_selector(WORKDAY_SELECTORS["autofill_from_resume"])
                if parse_btn:
                    await parse_btn.click()
                    await page.wait_for_timeout(5000)  # Wait for parsing

    async def _handle_contact_page(self, page, profile):
        await self._try_fill(page, WORKDAY_SELECTORS["first_name"], profile.first_name)
        await self._try_fill(page, WORKDAY_SELECTORS["last_name"], profile.last_name)
        await self._try_fill(page, WORKDAY_SELECTORS["email"], profile.email)
        await self._try_fill(page, WORKDAY_SELECTORS["phone"], profile.phone or "")
        await self._try_fill(page, WORKDAY_SELECTORS["city"], profile.city or "")

    async def _handle_work_auth_page(self, page, profile):
        if profile.work_authorization:
            await self._try_click(page, WORKDAY_SELECTORS["legally_authorized_yes"])
        else:
            await self._try_click(page, WORKDAY_SELECTORS["legally_authorized_no"])
        if profile.sponsorship_required:
            await self._try_click(page, WORKDAY_SELECTORS["sponsorship_yes"])
        else:
            await self._try_click(page, WORKDAY_SELECTORS["sponsorship_no"])

    async def _handle_eeo_page(self, page, profile):
        if not profile.eeo:
            return
        for selector, key in [
            (WORKDAY_SELECTORS["gender_select"], "gender"),
            (WORKDAY_SELECTORS["race_select"], "race_ethnicity"),
            (WORKDAY_SELECTORS["veteran_select"], "veteran_status"),
            (WORKDAY_SELECTORS["disability_select"], "disability_status"),
        ]:
            value = profile.eeo.get(key)
            if value:
                await self._try_select(page, selector, value)

    async def _get_page_heading(self, page):
        try:
            h2 = await page.query_selector("h2, [data-automation-id='headingText']")
            return (await h2.inner_text()).lower() if h2 else "unknown"
        except:
            return "unknown"

    async def _is_confirmation(self, page):
        body = await page.locator("body").inner_text()
        return looks_like_confirmation(body) or looks_like_confirmation_url(page.url)

    async def _try_fill(self, page, selector, value):
        if not value:
            return
        try:
            el = await page.query_selector(selector)
            if el:
                await el.fill(value)
        except:
            pass

    async def _try_click(self, page, selector):
        try:
            el = await page.query_selector(selector)
            if el:
                await el.click()
                await page.wait_for_timeout(500)
        except:
            pass

    async def _try_select(self, page, selector, value):
        try:
            el = await page.query_selector(selector)
            if el:
                await el.select_option(label=value)
        except:
            pass
```

---

### 3.4 — Ashby Form Analysis & Agent (NEW)

**Portal:** `ashby`
**URLs:** `https://jobs.ashbyhq.com/{company}/{job-uuid}`

Ashby is used by: OpenAI, Harvey, Suno, Replit, and ~14 more in our source list.

**Form Analysis:**
Ashby uses React with data-* attributes. Apply button is typically `[data-testid="apply-button"]`. The form is a modal or new page.

```python
# apply_engine/portal_specs.py — ASHBY_SELECTORS
ASHBY_SELECTORS = {
    "apply_button": "[data-testid='apply-button'], button:has-text('Apply')",
    "first_name": "input[name='_systemfield_name'], input[placeholder*='First']",
    "last_name": "input[placeholder*='Last']",
    "full_name": "input[name='_systemfield_name'], input[placeholder*='Name']",
    "email": "input[name='_systemfield_email'], input[type='email']",
    "phone": "input[name='_systemfield_phone'], input[type='tel']",
    "location": "input[name='_systemfield_location']",
    "linkedin": "input[name*='linkedin'], input[placeholder*='LinkedIn']",
    "website": "input[name*='website'], input[placeholder*='website']",
    "github": "input[name*='github'], input[placeholder*='GitHub']",
    "resume_upload": "input[type='file'][name*='resume'], input[type='file'][data-testid*='resume']",
    "submit": "button[type='submit'], button:has-text('Submit Application')",
    "next": "button:has-text('Next'), button:has-text('Continue')",
}
```

**`apply_engine/agents/ashby.py` — New file:**

```python
from apply_engine.agents.base import PortalAgent
from apply_engine.browser import (
    complete_submission_flow, capture_page_screenshot,
    run_with_chromium, AuthRequiredError, SubmissionBlockedError
)
from apply_engine.models import ApplyRequest, ApplyResult, PlannedAction
from apply_engine.portal_specs import ASHBY_SELECTORS

class AshbyAgent(PortalAgent):
    async def apply(self, request: ApplyRequest) -> ApplyResult:
        screenshots = []
        try:
            async def worker(page):
                await page.wait_for_load_state("networkidle", timeout=20000)

                # Click apply if needed (some go direct to form)
                apply_btn = await page.query_selector(ASHBY_SELECTORS["apply_button"])
                if apply_btn:
                    await apply_btn.click()
                    await page.wait_for_load_state("networkidle", timeout=10000)

                # Detect name field (full vs split)
                full_name_el = await page.query_selector(ASHBY_SELECTORS["full_name"])
                if full_name_el:
                    placeholder = (await full_name_el.get_attribute("placeholder") or "").lower()
                    if "first" in placeholder:
                        await full_name_el.fill(request.profile.first_name)
                        last_el = await page.query_selector(ASHBY_SELECTORS["last_name"])
                        if last_el:
                            await last_el.fill(request.profile.last_name)
                    else:
                        await full_name_el.fill(f"{request.profile.first_name} {request.profile.last_name}")

                await self._try_fill(page, ASHBY_SELECTORS["email"], request.profile.email)
                await self._try_fill(page, ASHBY_SELECTORS["phone"], request.profile.phone or "")
                await self._try_fill(page, ASHBY_SELECTORS["linkedin"], request.profile.linkedin or "")
                await self._try_fill(page, ASHBY_SELECTORS["website"], request.profile.website or "")
                await self._try_fill(page, ASHBY_SELECTORS["github"], request.profile.github or "")

                if request.profile.resume_pdf_path:
                    await self._try_upload(page, ASHBY_SELECTORS["resume_upload"], request.profile.resume_pdf_path)

                # Ashby custom questions — label-based fill
                await self._fill_custom_questions(page, request.profile)

                screenshots.append(await capture_page_screenshot(page, "pre_submit"))
                confirmation = await complete_submission_flow(
                    page,
                    submit_selector=ASHBY_SELECTORS["submit"],
                    next_selector=ASHBY_SELECTORS["next"],
                    max_steps=5,
                )
                screenshots.append(await capture_page_screenshot(page, "post_submit"))
                return confirmation

            confirmation = await run_with_chromium(request.url, worker)
            return ApplyResult(portal="ashby", status="applied", confirmation_snippet=confirmation[:500], actions=[], error=None, screenshots=screenshots)
        except Exception as e:
            return ApplyResult(portal="ashby", status="failed", error=str(e), actions=[], screenshots=screenshots, confirmation_snippet=None)

    async def _fill_custom_questions(self, page, profile):
        # Find all visible text inputs not yet filled
        inputs = await page.query_selector_all("input[type='text'], textarea")
        for inp in inputs:
            placeholder = (await inp.get_attribute("placeholder") or "").lower()
            val = await inp.input_value()
            if val:  # Already filled
                continue
            if any(kw in placeholder for kw in ["linkedin", "github", "website", "portfolio"]):
                continue  # Already handled above
            if "school" in placeholder or "university" in placeholder:
                await inp.fill(profile.school or "")
            elif "major" in placeholder or "degree" in placeholder:
                await inp.fill(profile.major or "")
            elif "gpa" in placeholder:
                await inp.fill(str(profile.gpa or ""))
            elif "grad" in placeholder or "graduation" in placeholder:
                await inp.fill(profile.graduation or "")

    async def _try_fill(self, page, selector, value):
        if not value:
            return
        try:
            el = await page.query_selector(selector)
            if el:
                await el.fill(value)
        except:
            pass

    async def _try_upload(self, page, selector, path):
        try:
            el = await page.query_selector(selector)
            if el:
                await page.set_input_files(selector, path)
        except:
            pass
```

---

### 3.5 — Custom Question Detection (Cross-Portal)

Many portals append company-specific questions after standard fields. Build a universal custom-question-filler:

**File:** `apply_engine/agents/common.py` — add `fill_custom_questions_universal(page, profile)`:

```python
# Strategy: scan ALL visible form fields not yet filled
# Match by placeholder/label text → intelligent fill

QUESTION_MATCHERS = [
    # (keywords_in_label, field_key_on_profile, default_value)
    (["start date", "when can you start", "earliest you can start"], "start_date", None),
    (["salary", "compensation", "pay expectation"], "salary_expectation", None),
    (["years of experience", "how many years"], None, "0-1"),
    (["how did you hear", "referral", "source"], None, "Company Website"),
    (["cover letter", "tell us about yourself", "why do you want"], None, None),  # skip — don't make up
    (["school", "university", "college"], "school", None),
    (["major", "field of study", "degree"], "major", None),
    (["graduation", "grad date", "class of"], "graduation", None),
    (["gpa", "grade point"], "gpa", None),
    (["city", "location"], "city", None),
    (["linkedin"], "linkedin", None),
    (["github"], "github", None),
    (["website", "portfolio"], "website", None),
    (["phone", "mobile"], "phone", None),
]

async def fill_custom_questions_universal(page, profile):
    """
    Scan all labels/placeholders for unrecognized form fields and fill intelligently.
    Only fills fields that are empty. Skips open-ended essay questions.
    """
    # Get all input/textarea/select elements
    fields = await page.query_selector_all("input:visible, textarea:visible, select:visible")
    for field in fields:
        tag = await field.evaluate("el => el.tagName.toLowerCase()")
        current_val = await field.input_value() if tag != "select" else ""
        if current_val:
            continue  # Already filled

        # Get label text from: aria-label, placeholder, associated label[for], parent label
        label_text = await _get_field_label(page, field)
        if not label_text:
            continue

        label_lower = label_text.lower()

        for keywords, profile_key, default in QUESTION_MATCHERS:
            if any(kw in label_lower for kw in keywords):
                value = None
                if profile_key:
                    value = getattr(profile, profile_key, None)
                if value is None:
                    value = default
                if value and tag == "select":
                    try:
                        await field.select_option(label=str(value))
                    except:
                        pass
                elif value:
                    try:
                        await field.fill(str(value))
                    except:
                        pass
                break

async def _get_field_label(page, field_el):
    """Extract label text associated with a form field."""
    # Try aria-label
    aria = await field_el.get_attribute("aria-label")
    if aria:
        return aria

    # Try placeholder
    placeholder = await field_el.get_attribute("placeholder")
    if placeholder:
        return placeholder

    # Try associated label[for=id]
    field_id = await field_el.get_attribute("id")
    if field_id:
        label_el = await page.query_selector(f"label[for='{field_id}']")
        if label_el:
            return await label_el.inner_text()

    # Try parent label
    try:
        parent_label = await field_el.evaluate_handle("el => el.closest('label')")
        if parent_label:
            return await parent_label.inner_text()
    except:
        pass

    return None
```

---

### 3.6 — Update Registry for New Portals

**File:** `apply_engine/registry.py`

```python
from apply_engine.agents.greenhouse import GreenhouseAgent
from apply_engine.agents.lever import LeverAgent
from apply_engine.agents.workday import WorkdayAgent
from apply_engine.agents.ashby import AshbyAgent
from apply_engine.agents.vision import VisionAgent

PORTAL_AGENTS = {
    "greenhouse": GreenhouseAgent(),
    "lever": LeverAgent(),
    "workday": WorkdayAgent(),
    "ashby": AshbyAgent(),
}

def route_application(request: ApplyRequest) -> PortalAgent:
    # First try detected portal
    from apply_engine.agents.detector import detectPortal
    portal = detectPortal(request.url)

    agent = PORTAL_AGENTS.get(portal)
    if agent:
        return agent

    # Fallback: Vision agent (returns unsupported in plan mode)
    return VisionAgent()
```

**File:** `apply_engine/agents/detector.py` — update `detectPortal`:
```python
def detectPortal(url: str) -> str:
    url_lower = url.lower()
    if "greenhouse.io" in url_lower or "grnh.se" in url_lower:
        return "greenhouse"
    if "lever.co" in url_lower:
        return "lever"
    if "myworkdayjobs.com" in url_lower or "workday.com" in url_lower:
        return "workday"
    if "ashbyhq.com" in url_lower:
        return "ashby"
    if "smartrecruiters.com" in url_lower:
        return "smartrecruiters"
    if "icims.com" in url_lower:
        return "icims"
    if "handshake" in url_lower:
        return "handshake"
    return "vision"
```

---

### 3.7 — ApplicantProfile: Add All Fields

**File:** `apply_engine/models.py` — update `ApplicantProfile`:

```python
@dataclass
class ApplicantProfile:
    # Identity
    first_name: str
    last_name: str
    email: str
    phone: str | None = None

    # Location
    city: str | None = None
    state_region: str | None = None
    country: str = "United States"

    # Education
    school: str | None = None
    major: str | None = None
    degree: str | None = None
    gpa: str | None = None
    graduation: str | None = None  # "May 2026", "2026-05"

    # Career
    earliest_start_date: str | None = None  # "June 2026"
    salary_expectation: int | None = None   # Annual, USD
    location_preference: list[str] = field(default_factory=list)

    # Work authorization
    work_authorization: bool = True
    visa_type: str | None = None            # citizen, h1b, opt, cpt, etc.
    sponsorship_required: bool = False

    # Links
    linkedin: str | None = None
    website: str | None = None
    github: str | None = None

    # Resume
    resume_pdf_path: str | None = None      # Path to local PDF file
    resume_text: str | None = None          # Fallback plain text

    # EEO (all optional, never required)
    eeo: dict | None = None                 # { gender, race_ethnicity, veteran_status, disability_status }

    # Misc
    custom_answers: dict = field(default_factory=dict)
    graduation_window: str | None = None    # "Spring 2026"
    onsite_preference: str | None = None    # "hybrid", "remote", "onsite"
    weekly_availability_hours: int | None = None
```

---

### 3.8 — Profile → ApplicantProfile Mapping

**File:** `lib/platform/applicant.ts` — complete the mapping:

```typescript
export function mapPersistedProfileToApplicantDraft(profile: ProfileRow): ApplicantProfile {
  const resume = profile.resume_json as AnnotatedResume | null;
  const eeo = profile.eeo as EEOData | null;

  return {
    first_name: profile.full_name?.split(" ")[0] ?? "",
    last_name: profile.full_name?.split(" ").slice(1).join(" ") ?? "",
    email: profile.email ?? "",
    phone: profile.phone ?? null,

    city: profile.city ?? null,
    state_region: profile.state_region ?? null,
    country: profile.country ?? "United States",

    school: profile.school ?? null,
    major: profile.major ?? null,
    degree: profile.degree ?? null,
    gpa: profile.gpa ?? null,
    graduation: profile.graduation ?? null,

    earliest_start_date: profile.earliest_start_date ?? null,
    location_preference: (profile.locations ?? []) as string[],

    work_authorization: profile.authorized_to_work ?? true,
    visa_type: profile.visa_type ?? null,
    sponsorship_required:
      profile.visa_type
        ? ["opt", "cpt", "h1b", "tn", "other"].includes(profile.visa_type)
        : false,

    linkedin: profile.linkedin_url ?? null,
    website: profile.website_url ?? null,
    github: profile.github_url ?? null,

    resume_pdf_path: null,  // Set by apply engine from uploaded file
    resume_text: resume
      ? buildResumeText(resume)  // helper below
      : null,

    eeo: eeo ? {
      gender: eeo.gender ?? null,
      race_ethnicity: eeo.race_ethnicity ?? null,
      veteran_status: eeo.veteran_status ?? null,
      disability_status: eeo.disability_status ?? null,
    } : null,

    custom_answers: {},
    graduation_window: profile.graduation ?? null,
  };
}

function buildResumeText(resume: AnnotatedResume): string {
  const lines: string[] = [];
  lines.push(`${resume.name} | ${resume.email}`);
  if (resume.phone) lines.push(resume.phone);
  lines.push("");
  for (const exp of resume.experience) {
    lines.push(`${exp.title} at ${exp.company} (${exp.dates})`);
    for (const b of exp.bullets) {
      lines.push(`  - ${b.text}`);
    }
  }
  lines.push("");
  lines.push("Skills: " + resume.skills.map(s => s.name).join(", "));
  return lines.join("\n");
}
```

---

## PHASE 4 — APPLY ENGINE DEPLOYMENT

### 4.1 — FastAPI Server Setup

**File:** `apply_engine/main.py` — verify endpoints:

```python
from fastapi import FastAPI
from apply_engine.models import ApplyRequest, ApplyResult
from apply_engine.registry import route_application

app = FastAPI()

@app.post("/plan", response_model=ApplyResult)
async def plan(request: ApplyRequest):
    request.dry_run = True
    agent = route_application(request)
    return await agent.apply(request)

@app.post("/apply", response_model=ApplyResult)
async def apply(request: ApplyRequest):
    request.dry_run = False
    agent = route_application(request)
    return await agent.apply(request)

@app.get("/health")
async def health():
    return {"status": "ok"}
```

### 4.2 — Apply Engine Environment

**File:** `apply_engine/Dockerfile` (create):

```dockerfile
FROM mcr.microsoft.com/playwright/python:v1.41.0-jammy

WORKDIR /app
COPY apply_engine/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN playwright install chromium

COPY apply_engine/ ./apply_engine/
EXPOSE 8000
CMD ["uvicorn", "apply_engine.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**File:** `apply_engine/requirements.txt` (update):
```
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
playwright>=1.41.0
httpx>=0.27.0
pydantic>=2.8.0
```

### 4.3 — Connect Next.js → Apply Engine

**File:** `lib/apply-engine.ts`

```typescript
const APPLY_ENGINE_BASE_URL = process.env.APPLY_ENGINE_BASE_URL || "http://localhost:8000";

export async function fetchApplyPlan(payload: ApplyPlanRequest) {
  const res = await fetch(`${APPLY_ENGINE_BASE_URL}/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`Apply engine error: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<ApplyEngineResponse>;
}

export async function fetchApplySubmit(payload: ApplyPlanRequest) {
  const res = await fetch(`${APPLY_ENGINE_BASE_URL}/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120_000),  // 2 min for actual form filling
  });
  if (!res.ok) {
    throw new Error(`Apply engine error: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<ApplyEngineResponse>;
}
```

---

## PHASE 5 — RESUME PDF DELIVERY TO APPLY ENGINE

### 5.1 — Resume Upload Storage (Supabase Storage)

**Migration to add:** `supabase/migrations/20260330_resume_storage.sql`

```sql
-- Create storage bucket for resumes
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false);

-- RLS: Users can only access their own resume
CREATE POLICY "User resume access" ON storage.objects
  FOR ALL USING (
    bucket_id = 'resumes' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

### 5.2 — Resume Upload API Route

**File:** `app/api/resume/upload/route.ts` (new):

```typescript
export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  const formData = await request.formData();
  const file = formData.get("file") as File;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const bytes = await file.arrayBuffer();
  const path = `${user?.id ?? "anon"}/resume.pdf`;

  const { error } = await supabase.storage
    .from("resumes")
    .upload(path, bytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get signed URL (valid 1 hour) for apply engine to download
  const { data: { signedUrl } } = await supabase.storage
    .from("resumes")
    .createSignedUrl(path, 3600);

  return NextResponse.json({ path, signedUrl });
}
```

### 5.3 — Wire Resume URL to Apply Engine

**File:** `lib/apply-engine.ts` — include `resume_url` in ApplyPlanRequest:

```typescript
export interface ApplyPlanRequest {
  url: string
  profile: ApplicantProfile
  resume_url?: string   // Signed URL for apply engine to download PDF
}
```

**File:** `apply_engine/models.py` — update ApplyRequest:

```python
@dataclass
class ApplyRequest:
    url: str
    profile: ApplicantProfile
    dry_run: bool = False
    resume_url: str | None = None  # Apply engine downloads PDF to temp file
```

**File:** `apply_engine/main.py` — download resume before applying:

```python
import tempfile
import httpx

@app.post("/apply")
async def apply(request: ApplyRequest):
    # Download resume PDF if URL provided
    if request.resume_url and not request.profile.resume_pdf_path:
        async with httpx.AsyncClient() as client:
            response = await client.get(request.resume_url, timeout=30)
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
                f.write(response.content)
                request.profile.resume_pdf_path = f.name

    request.dry_run = False
    agent = route_application(request)
    result = await agent.apply(request)

    # Clean up temp file
    if request.profile.resume_pdf_path and "tmp" in request.profile.resume_pdf_path:
        Path(request.profile.resume_pdf_path).unlink(missing_ok=True)

    return result
```

---

## PHASE 6 — CRON JOBS & SCHEDULING

### 6.1 — GitHub Actions Cron (No Vercel Cron needed)

**File:** `.github/workflows/twin-operations.yml` — update/add cron steps:

```yaml
name: Twin Operations

on:
  schedule:
    - cron: '*/5 * * * *'   # Process queue every 5 min
    - cron: '0 */6 * * *'   # Scrape & ingest every 6 hours
    - cron: '0 3 * * *'     # Expire alerts daily at 3am
  workflow_dispatch:

jobs:
  process-queue:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger process-queue
        run: |
          curl -X POST "$TWIN_BASE_URL/api/internal/cron/process-queue" \
            -H "Authorization: Bearer $TWIN_WORKER_SECRET"
        env:
          TWIN_BASE_URL: ${{ secrets.TWIN_BASE_URL }}
          TWIN_WORKER_SECRET: ${{ secrets.TWIN_WORKER_SECRET }}

  expire-alerts:
    runs-on: ubuntu-latest
    if: github.event.schedule == '0 3 * * *'
    steps:
      - name: Trigger expire-alerts
        run: |
          curl -X POST "$TWIN_BASE_URL/api/internal/cron/expire-alerts" \
            -H "Authorization: Bearer $TWIN_WORKER_SECRET"
        env:
          TWIN_BASE_URL: ${{ secrets.TWIN_BASE_URL }}
          TWIN_WORKER_SECRET: ${{ secrets.TWIN_WORKER_SECRET }}

  scrape-and-ingest:
    runs-on: ubuntu-latest
    if: github.event.schedule == '0 */6 * * *'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install -r scraper/requirements.txt
      - name: Run scraper
        run: |
          python -m scraper.run_scrape \
            --sources-file scraper/career-page-links.json \
            --skip-gemini
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
```

---

## PHASE 7 — TESTS

### 7.1 — Apply Engine Unit Tests

**File:** `apply_engine/tests/test_agents.py` — update:

```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from apply_engine.models import ApplicantProfile, ApplyRequest

SAMPLE_PROFILE = ApplicantProfile(
    first_name="Jane",
    last_name="Doe",
    email="jane@example.com",
    phone="+14155552671",
    school="MIT",
    major="Computer Science",
    degree="B.S.",
    gpa="3.9",
    graduation="May 2026",
    work_authorization=True,
    sponsorship_required=False,
    linkedin="https://linkedin.com/in/janedoe",
    github="https://github.com/janedoe",
)

class TestGreenhouseAgent:
    def test_build_actions_includes_all_required_fields(self):
        from apply_engine.agents.greenhouse import GreenhouseAgent
        agent = GreenhouseAgent()
        request = ApplyRequest(url="https://boards.greenhouse.io/test/jobs/123", profile=SAMPLE_PROFILE, dry_run=True)
        actions = agent._build_actions(SAMPLE_PROFILE)
        action_selectors = [a.selector for a in actions]
        assert "input#first_name" in action_selectors
        assert "input#last_name" in action_selectors
        assert "input#email" in action_selectors

    @pytest.mark.asyncio
    async def test_dry_run_returns_planned_status(self):
        from apply_engine.agents.greenhouse import GreenhouseAgent
        agent = GreenhouseAgent()
        request = ApplyRequest(url="https://boards.greenhouse.io/test/jobs/123", profile=SAMPLE_PROFILE, dry_run=True)
        result = await agent.apply(request)
        assert result.status == "planned"
        assert result.portal == "greenhouse"
        assert len(result.actions) > 0

class TestLeverAgent:
    @pytest.mark.asyncio
    async def test_dry_run(self):
        from apply_engine.agents.lever import LeverAgent
        agent = LeverAgent()
        request = ApplyRequest(url="https://jobs.lever.co/stripe/abc123", profile=SAMPLE_PROFILE, dry_run=True)
        result = await agent.apply(request)
        assert result.status == "planned"
        assert result.portal == "lever"

class TestDetector:
    def test_detects_greenhouse(self):
        from apply_engine.agents.detector import detectPortal
        assert detectPortal("https://boards.greenhouse.io/stripe/jobs/123") == "greenhouse"
        assert detectPortal("https://job-boards.greenhouse.io/anthropic/jobs/456") == "greenhouse"

    def test_detects_lever(self):
        from apply_engine.agents.detector import detectPortal
        assert detectPortal("https://jobs.lever.co/palantir/abc") == "lever"

    def test_detects_workday(self):
        from apply_engine.agents.detector import detectPortal
        assert detectPortal("https://amazon.wd5.myworkdayjobs.com/...") == "workday"

    def test_detects_ashby(self):
        from apply_engine.agents.detector import detectPortal
        assert detectPortal("https://jobs.ashbyhq.com/openai/...") == "ashby"
```

### 7.2 — Scraper Source Tests

**File:** `scraper/tests/test_sources_greenhouse.py` — verify against fixture:

```python
# Uses scraper/tests/fixtures/source_greenhouse_listings.json
# Tests: fetch → filter → dedupe → correct field mapping
# Ensure: title, url, level, location, company, portal all present
# Ensure: is_early_career filters work (senior = excluded, intern = included)
```

### 7.3 — Matching Logic Tests

**File:** `lib/matching.test.ts` (new — create):

```typescript
import { matchJobToProfile } from "@/lib/matching";

const baseJob = {
  id: "job-1",
  company: "Stripe",
  title: "Software Engineering Intern",
  level: "internship",
  location: "San Francisco, CA",
  remote: false,
  industries: ["SWE"],
  url: "https://stripe.com/jobs/1",
  application_url: "https://stripe.com/jobs/1",
  portal: "greenhouse",
  status: "active",
  posted_at: new Date().toISOString(),
  scraped_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  jd_summary: null,
  metadata: {},
};

const baseProfile = {
  id: "user-1",
  full_name: "Jane Doe",
  email: "jane@test.com",
  industries: ["SWE"],
  levels: ["internship"],
  locations: ["San Francisco"],
  remote_ok: false,
  gray_areas: null,
  // ... other required fields
};

describe("matchJobToProfile", () => {
  test("perfect match returns score >= 50", () => {
    const result = matchJobToProfile(baseJob as any, baseProfile as any);
    expect(result.matched).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(50);
  });

  test("wrong level returns rejection", () => {
    const profile = { ...baseProfile, levels: ["new_grad"] };
    const result = matchJobToProfile(baseJob as any, profile as any);
    expect(result.matched).toBe(false);
    expect(result.rejections.some(r => r.includes("level"))).toBe(true);
  });

  test("excluded company returns rejection", () => {
    const profile = {
      ...baseProfile,
      gray_areas: { excluded_companies: ["Stripe"], excluded_industries: [] }
    };
    const result = matchJobToProfile(baseJob as any, profile as any);
    expect(result.matched).toBe(false);
  });

  test("remote job matches remote-ok profile", () => {
    const job = { ...baseJob, remote: true };
    const profile = { ...baseProfile, locations: [], remote_ok: true };
    const result = matchJobToProfile(job as any, profile as any);
    expect(result.matched).toBe(true);
  });
});
```

---

## PHASE 8 — APPLY LAB (TESTING UI)

### 8.1 — Apply Lab Page

**File:** `app/apply-lab/page.tsx` — complete implementation:

```tsx
// This is the developer/testing interface for apply flows
// Layout:
// - URL input field
// - "Plan" button → calls /api/apply/plan → shows action list
// - "Apply" button → calls /api/apply/submit → shows confirmation
// - Screenshots gallery (if returned)
// - Full JSON response collapsible

// State:
// - url: string
// - loading: boolean
// - planResult: ApplyEngineResponse | null
// - submitResult: ApplyEngineResponse | null
// - screenshots: CapturedScreenshot[]
```

---

## PHASE 9 — SCRAPER IMPROVEMENTS

### 9.1 — Add `ashby` to Scraper Sources

**File:** `scraper/sources/ashby.py` (new):

```python
"""Ashby source adapter.
Fetches from Ashby Jobs API: GET https://api.ashbyhq.com/posting-api/job-board/{company_name}
"""
import httpx
from scraper.sources.base import BaseSource, ScrapeResult, SourceConfig
from scraper.sources.common import canonicalize_url, is_early_career, infer_level, infer_industries, now_iso

class AshbySource(BaseSource):
    portal = "ashby"

    def scrape(self, config: SourceConfig, http_client: httpx.Client) -> ScrapeResult:
        # Ashby has a public API: /posting-api/job-board/{slug}
        slug = config.board_url.rstrip("/").split("/")[-1]
        api_url = f"https://api.ashbyhq.com/posting-api/job-board/{slug}"

        try:
            resp = http_client.get(api_url, timeout=15)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            return ScrapeResult(source_id=config.id, company=config.company, portal=self.portal,
                fetched=0, emitted=0, filtered_out=0, jobs=[], warnings=[], errors=[str(e)])

        postings = data.get("jobPostings", [])
        fetched = len(postings)
        jobs = []

        for posting in postings:
            title = posting.get("title", "")
            if not is_early_career(title):
                continue
            job_url = posting.get("jobUrl") or posting.get("applyUrl", "")
            if not job_url.startswith("http"):
                job_url = f"https://jobs.ashbyhq.com/{slug}/{posting.get('id', '')}"

            location = posting.get("locationName") or config.default_location or "Unknown"

            jobs.append({
                "company": config.company,
                "title": title,
                "level": infer_level(title),
                "location": location,
                "url": canonicalize_url(job_url),
                "application_url": canonicalize_url(job_url),
                "remote": posting.get("isRemote", False),
                "industries": infer_industries(title, "", config.notes, config.default_industries),
                "portal": "ashby",
                "posted_at": posting.get("publishedDate") or now_iso(),
                "tags": ["source:ashby", "sync:scheduled"],
                "source": "ashby_source_sync",
            })

        return ScrapeResult(source_id=config.id, company=config.company, portal=self.portal,
            fetched=fetched, emitted=len(jobs), filtered_out=fetched-len(jobs),
            jobs=jobs, warnings=[], errors=[])
```

**File:** `scraper/sources/registry.py` — add Ashby:
```python
from scraper.sources.ashby import AshbySource

SOURCES = {
    "greenhouse": GreenhouseSource(),
    "lever": LeverSource(),
    "workday": WorkdaySource(),
    "handshake": HandshakeSource(),
    "ashby": AshbySource(),   # NEW
}
```

**File:** `scraper/run_scrape.py`:
```python
DETERMINISTIC_PORTALS = {"greenhouse", "lever", "ashby"}  # Add ashby
```

### 9.2 — Retry Logic for Gemini Scraper

**File:** `scraper/sources/gemini_scraper.py` — add retry with backoff:

```python
import time

def _call_gemini_with_retry(prompt: str, api_key: str, model: str, max_retries: int = 3) -> str:
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=api_key)

    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(temperature=0, max_output_tokens=4096),
            )
            return response.text
        except Exception as e:
            if "429" in str(e) or "quota" in str(e).lower():
                wait = 2 ** attempt  # 1, 2, 4 sec
                time.sleep(wait)
                continue
            raise
    raise RuntimeError(f"Gemini failed after {max_retries} attempts")
```

---

## PHASE 10 — PRODUCTION CHECKLIST

### 10.1 — Vercel Environment Variables (Set All)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APPLY_QUEUE_WORKER_SECRET=ioeruvhiowuehoweiruhvoiuervhorui4vh378reofwvhwiervuh3
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
APPLY_ENGINE_BASE_URL=     # URL of deployed apply_engine service
SMS_PROVIDER=plivo
PLIVO_AUTH_ID=
PLIVO_AUTH_TOKEN=
PLIVO_PHONE_NUMBER=
```

### 10.2 — GitHub Actions Secrets (Set All)
```
TWIN_BASE_URL=
TWIN_WORKER_SECRET=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
```

### 10.3 — Plivo Webhook
- Set inbound SMS URL to: `https://your-app.vercel.app/api/messaging/reply`
- Method: POST
- In Plivo console: Applications → messaging → inbound message URL

### 10.4 — Supabase Auth
- Enable Google OAuth provider
- Redirect URL: `https://your-app.vercel.app/auth/callback`
- Enable email confirmations: OFF (for anonymous → google upgrade flow)

---

## BUILD ORDER SUMMARY (For Codex)

Execute in this exact order to avoid blocking dependencies:

```
Phase 0: Fix blockers
  0.1 Fix middleware matcher (exclude /api/)
  0.2 Add APPLY_QUEUE_WORKER_SECRET to .env.local
  0.3 Fix SUPABASE_URL fallback in scraper/ingest_jobs.py

Phase 1: Onboarding
  1.1 Fix step-phone.tsx SMS opt-in wiring
  1.2 Wire all fields in mapProfileToUpsertInput
  1.3 Add Google OAuth upgrade CTA to dashboard

Phase 2: Dashboard
  2.1 Full dashboard rewrite with live Supabase data
  2.2 Add Realtime alert subscription

Phase 3: Playwright autofill
  3.1 Complete Greenhouse agent + selectors
  3.2 Complete Lever agent + selectors
  3.3 Complete Workday agent + selectors
  3.4 New Ashby agent + selectors (apply_engine/agents/ashby.py)
  3.5 Universal custom question filler (apply_engine/agents/common.py)
  3.6 Update registry for new portals
  3.7 Update ApplicantProfile model with all fields
  3.8 Complete profile→applicant mapping in lib/platform/applicant.ts

Phase 4: Apply engine deployment
  4.1 Verify FastAPI endpoints in main.py
  4.2 Create Dockerfile for apply_engine
  4.3 Verify lib/apply-engine.ts connection

Phase 5: Resume PDF delivery
  5.1 Create Supabase storage migration
  5.2 Create /api/resume/upload route
  5.3 Wire resume_url through apply engine pipeline

Phase 6: Cron scheduling
  6.1 Update .github/workflows/twin-operations.yml with all cron jobs

Phase 7: Tests
  7.1 apply_engine/tests/test_agents.py (comprehensive)
  7.2 scraper/tests/ (sources, ingestion)
  7.3 lib/matching.test.ts

Phase 8: Apply Lab UI
  8.1 Complete app/apply-lab/page.tsx

Phase 9: Scraper improvements
  9.1 scraper/sources/ashby.py (new Ashby adapter)
  9.2 Retry logic in gemini_scraper.py
  9.3 Update DETERMINISTIC_PORTALS in run_scrape.py

Phase 10: Production
  10.1-10.4 Production checklist (env vars, webhooks, auth config)
```

---

## VERIFICATION STEPS (End-to-End Test)

After all phases complete, verify this full flow:

1. **Onboarding**: Navigate to `/onboarding` → complete all 5 steps → verify profile row in Supabase `profiles` table has all fields populated
2. **Job ingest**: `curl -X POST http://localhost:3000/api/jobs/ingest -H "Authorization: Bearer ..." -d '{test job}'` → returns 200 with job id
3. **Matching + alert**: Ingest a job matching your test profile → verify `alerts` row created in Supabase
4. **SMS alert**: If phone set + sms_opt_in = true → verify SMS received
5. **SMS reply**: Text "YES" to the number → verify alert status → "confirmed", application queued
6. **Dry run**: POST to `/api/apply/plan` with a Greenhouse job URL → returns planned actions list
7. **Apply**: POST to `/api/apply/submit` → applies queued → process-queue runs apply engine → verify `applications.status = "applied"` in Supabase
8. **Dashboard**: Navigate to `/dashboard` → see applied job with confirmation text
9. **Scraper**: Run `python -m scraper.run_scrape --skip-gemini` → new jobs appear in Supabase
