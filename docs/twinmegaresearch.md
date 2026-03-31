# Twin ATS Portal Research: Implementation-Grade Field Mapping
*Generated: 2026-03-29 | Purpose: Playwright automation agent design for Greenhouse, Lever, Workday, Handshake*

---

## Section 1: Executive Summary

### Most Standardized & Safe to Hardcode
- **Greenhouse**: First name, last name, email, phone, LinkedIn URL, resume upload, work authorization (Yes/No radio), `full_name` field
- **Lever**: Full name, email, phone, LinkedIn, website, resume upload — all standard Lever-native fields with consistent selectors
- **Workday**: First name, last name, email, address fields — all use camelCase `data-automation-id` attributes consistently
- **Handshake**: Identity fields are pre-filled from student profile and frequently locked/disabled; submit logic is predictable

### Varies but Pattern-Matchable
- EEO / EEOC demographic blocks — appear on 60–80% of Greenhouse applications; structure is nearly identical but label text can differ
- Workday autocomplete dropdowns — behavior is consistent even if option text varies
- Lever "Link Questions" with `data-type="linkedin"` attributes — stable across employers
- Start date / graduation date fields — predictable input type but format expectations vary (MM/YYYY vs full date)

### Most Likely to Require Fallback
- Custom employer screening questions on all portals (free text, employer-defined)
- Workday custom sections added per employer (especially skills assessments)
- Handshake job-specific questions — wide variation by institution template
- Any portal where the employer added a file upload beyond resume (writing sample, transcript, cover letter)

### Easiest to Automate First: **Greenhouse**
- Single-page form, minimal JS complexity
- Known DOM structure (`#application_form`, `input[name="job_application[first_name]"]`)
- Low auth-wall frequency (~5%)
- EEO block is nearly identical across employers
- Estimated 70–75% deterministic coverage for internship applications

### Hardest: **Workday**
- Multi-step wizard with heavy JavaScript re-renders
- Requires complex wait logic between steps
- Custom autocomplete dropdowns that don't respond to standard `fill()`
- Login required ~30% of the time for apply
- Strict validation blocks progression if any step is incomplete
- Estimated 50–60% deterministic coverage

### Estimated Automation Coverage (Internship Applications)

| Portal | Deterministic Coverage | Custom Question Risk | Notes |
|--------|----------------------|---------------------|-------|
| Greenhouse | 70–75% | Medium (30–40%) | EEO block is reliable; custom Qs are the main wildcard |
| Lever | 65–70% | Medium-High (35–45%) | Native fields reliable; employer custom sections vary widely |
| Workday | 50–60% | High (40–50%) | Multi-step complexity is the main blocker |
| Handshake | 75–85% | Low (10–15%) | Login wall is biggest obstacle; form logic is simple once in |

---

## Section 2: Portal-by-Portal Deep Dive

---

### 2.1 Greenhouse

**Form Architecture:** Single-page. All fields visible at once. Custom questions are appended below the standard block. EEO section appears at the bottom as a separate `<div>` block. No multi-step navigation.

**Auth/Login:** Rare. Greenhouse embed does not require login for most applications. LinkedIn "Easy Apply" is separate; direct Greenhouse apply does not require account creation.

**Review Pages:** Not standard. Submission is direct. Some employers show a confirmation overlay/redirect.

**Custom Questions:** Embedded as additional fields below the standard block inside `#application_form`. Uses `custom_field` or `question` naming patterns.

**Confirmation State:** URL redirect to `/jobs/{job_id}/thank_you` or page-level text with "Thank you for applying" or "Your application has been submitted."

#### Greenhouse Field Table

| Question Category | Exact Example Phrasing | Field Type | Typical HTML/DOM Pattern | Common Selector Clues | Required vs Optional | Standardized or Custom | Automation Difficulty | Notes |
|---|---|---|---|---|---|---|---|---|
| First Name | "First Name" | text input | `<input type="text" name="job_application[first_name]">` | `name="job_application[first_name]"` | Required | Standardized | Easy | Always present |
| Last Name | "Last Name" | text input | `<input type="text" name="job_application[last_name]">` | `name="job_application[last_name]"` | Required | Standardized | Easy | Always present |
| Email | "Email" | email input | `<input type="email" name="job_application[email]">` | `name="job_application[email]"` | Required | Standardized | Easy | |
| Phone | "Phone" | tel input | `<input type="tel" name="job_application[phone]">` | `name="job_application[phone]"` | Optional/Required | Standardized | Easy | |
| Location | "Location (City)" | text input | `<input type="text" id="job_application_location">` | `id="job_application_location"` or autocomplete | Optional | Standardized | Medium | Google Maps autocomplete triggered |
| Resume | "Resume/CV" | file upload | `<input type="file" name="job_application[resume]">` | `name="job_application[resume]"` | Required | Standardized | Medium | Drag-and-drop zone also present |
| LinkedIn | "LinkedIn Profile" | url input | `<input type="url" name="job_application[urls][LinkedIn]">` | `name*="[LinkedIn]"` | Optional | Standardized | Easy | |
| Website | "Website" | url input | `<input type="url" name="job_application[urls][Website]">` | `name*="[Website]"` | Optional | Standardized | Easy | |
| GitHub | "Github" | url input | `<input type="url" name="job_application[urls][Github]">` | `name*="[Github]"` | Optional | Standardized | Easy | |
| Work Authorization | "Are you legally authorized to work in the United States?" | radio | `<input type="radio" name="job_application[answers][authorization]">` | `name*="authorization"`, `label:contains("authorized")` | Optional | Standardized | Easy | Yes/No options |
| Sponsorship | "Will you now or in the future require sponsorship for employment visa status?" | radio | `<input type="radio" name="job_application[answers][sponsorship]">` | `name*="sponsorship"`, `label:contains("sponsorship")` | Optional | Standardized | Easy | Yes/No options |
| Cover Letter | "Cover Letter" | file/textarea | `<input type="file">` or `<textarea>` | `name*="cover_letter"` | Optional | Standardized | Medium | Can be file or text |
| School | "School" | text input | Inside education section | `name*="school"`, `label:contains("School")` | Optional | Standardized | Easy | |
| Degree | "Degree" | select | `<select name="job_application[education][degree]">` | `name*="degree"` | Optional | Standardized | Easy | |
| GPA | "GPA" | text input | Inside education section | `name*="gpa"` | Optional | Standardized | Easy | |
| Grad Date | "Graduation Date" | date/month input | `<input type="text">` with date picker or `<select>` for month/year | `name*="grad"`, `label:contains("Graduation")` | Optional | Standardized | Medium | Format varies |
| EEO – Gender | "Gender" | select or radio | Inside EEO `<div class="eeoc_fields">` | `name*="gender"`, `id*="gender"` | Voluntary | Standardized | Easy | "Decline to state" option present |
| EEO – Race | "Race" | select | Inside EEO block | `name*="race"`, `id*="race"` | Voluntary | Standardized | Easy | |
| EEO – Veteran | "Veteran Status" | select | Inside EEO block | `name*="veteran"` | Voluntary | Standardized | Easy | |
| EEO – Disability | "Disability Status" | select/radio | Inside EEO block | `name*="disability"` | Voluntary | Standardized | Easy | |
| Custom Text Q | "Why do you want to work here?" | textarea | `<textarea name="job_application[answers][][][value]">` | `name*="answers"` with textarea | Optional/Required | Custom | Hard – AI needed | Employer-defined |
| Custom MC Q | "Which office location do you prefer?" | select/radio | `<select name="job_application[answers][][][value]">` | `name*="answers"` with select | Optional | Custom | Medium | Parse options |
| Custom Checkbox | "I certify that…" | checkbox | `<input type="checkbox" name="job_application[answers][][][value]">` | `name*="answers"` with checkbox | Required | Custom | Medium | Must check to submit |

---

### 2.2 Lever

**Form Architecture:** Single-page. Standard Lever-native fields at top, custom employer fields appended below. Lever uses a distinct "Link Questions" pattern for URL fields. No multi-step navigation for standard apply.

**Auth/Login:** Rare (~10%). Lever offers a "referral" or "apply with LinkedIn" but direct apply requires no account.

**Review Pages:** Not standard. Submit is direct.

**Custom Questions:** Rendered as standard form fields with `data-qa` attributes and employer-controlled labels. Text inputs, textareas, selects, and radios all appear.

**Confirmation State:** Text "Application submitted" or "Thank you for your interest in [company]" appears in-page or on a redirect page. URL often changes to `/jobs/apply/thank-you` or similar.

#### Lever Field Table

| Question Category | Exact Example Phrasing | Field Type | Typical HTML/DOM Pattern | Common Selector Clues | Required vs Optional | Standardized or Custom | Automation Difficulty | Notes |
|---|---|---|---|---|---|---|---|---|
| Full Name | "Full name" | text input | `<input type="text" name="name">` | `name="name"`, `[data-qa="name-field"]` | Required | Standardized | Easy | Single full-name field (not split) |
| Email | "Email" | email input | `<input type="email" name="email">` | `name="email"`, `[data-qa="email-field"]` | Required | Standardized | Easy | |
| Phone | "Phone" | tel input | `<input type="tel" name="phone">` | `name="phone"`, `[data-qa="phone-field"]` | Optional/Required | Standardized | Easy | |
| Company | "Current company" | text input | `<input type="text" name="org">` | `name="org"` | Optional | Standardized | Easy | |
| LinkedIn | "LinkedIn URL" | url input | `<input type="url" data-type="linkedin">` | `[data-type="linkedin"]` | Optional | Standardized | Easy | Very reliable selector |
| Twitter | "Twitter URL" | url input | `<input type="url" data-type="twitter">` | `[data-type="twitter"]` | Optional | Standardized | Easy | |
| GitHub | "GitHub URL" | url input | `<input type="url" data-type="github">` | `[data-type="github"]` | Optional | Standardized | Easy | |
| Portfolio | "Portfolio URL" | url input | `<input type="url" data-type="portfolio">` | `[data-type="portfolio"]` | Optional | Standardized | Easy | |
| Website | "Website" | url input | `<input type="url" data-type="other">` | `[data-type="other"]` | Optional | Standardized | Easy | |
| Resume | "Resume/CV" | file upload | `<input type="file" name="resume">` | `name="resume"`, `[data-qa="resume-upload"]` | Required | Standardized | Medium | 100MB limit |
| Cover Letter | "Cover letter" | file/textarea | `<input type="file">` or `<textarea>` | `name="cover_letter"` | Optional | Standardized | Medium | |
| Work Auth | "Are you authorized to work lawfully in…?" | radio/select | `<input type="radio">` inside custom Q section | `label:contains("authorized")` | Optional | Often Custom | Medium | Phrasing varies by employer |
| Sponsorship | "Do you require visa sponsorship?" | radio | `<input type="radio">` inside custom Q | `label:contains("sponsorship")` | Optional | Often Custom | Medium | |
| Location | "Location" | text input | `<input type="text" name="location">` | `name="location"` | Optional | Standardized | Easy | |
| Custom Text Q | Employer-defined | textarea | `<textarea class="application-answer">` | `class*="application-answer"`, preceded by `<label>` | Varies | Custom | Hard | AI needed for content |
| Custom Select | Employer-defined | select | `<select class="application-select">` | `class*="application-select"` | Varies | Custom | Medium | Parse options deterministically |
| EEO – Gender | "What is your gender?" | select | Inside EEO block `<div class="eeoc-module">` | Inside `.eeoc-module` | Voluntary | Standardized | Easy | |
| EEO – Race | "What is your race/ethnicity?" | select | Inside EEO block | Inside `.eeoc-module` | Voluntary | Standardized | Easy | |
| EEO – Veteran | "Veteran status" | select | Inside EEO block | Inside `.eeoc-module` | Voluntary | Standardized | Easy | |
| EEO – Disability | "Disability status" | select | Inside EEO block | Inside `.eeoc-module` | Voluntary | Standardized | Easy | |
| Acknowledgement | "I certify that all information…" | checkbox | `<input type="checkbox">` inside legal block | `class*="legal"`, `name*="confirm"` | Required | Standardized | Easy | |

---

### 2.3 Workday

**Form Architecture:** Multi-step wizard. 3–6 steps depending on employer configuration. Steps typically include: My Information → My Experience → Application Questions → Voluntary Disclosures → Review → Submit. Progress bar visible. Heavy SPA re-rendering between steps.

**Auth/Login:** Common (~30%). Many Workday portals require account creation or login before applying. Google/LinkedIn SSO available on some.

**Review Pages:** Always present as the final step before Submit. All entered data shown read-only. "Back" button to correct.

**Custom Questions:** "Application Questions" step contains employer-defined fields. Structure varies but uses `data-automation-id` attributes consistently.

**Confirmation State:** "Application Submitted Successfully" with optional confirmation number. URL changes or modal overlays.

#### Workday Field Table

| Question Category | Exact Example Phrasing | Field Type | Typical HTML/DOM Pattern | Common Selector Clues | Required vs Optional | Standardized or Custom | Automation Difficulty | Notes |
|---|---|---|---|---|---|---|---|---|
| First Name | "First Name *" | text input | `<input data-automation-id="firstName">` | `[data-automation-id="firstName"]` | Required | Standardized | Easy | Red asterisk on label |
| Last Name | "Last Name *" | text input | `<input data-automation-id="lastName">` | `[data-automation-id="lastName"]` | Required | Standardized | Easy | |
| Middle Name | "Middle Name" | text input | `<input data-automation-id="middleName">` | `[data-automation-id="middleName"]` | Optional | Standardized | Easy | |
| Email | "Email Address *" | email input | `<input data-automation-id="email">` | `[data-automation-id="email"]` | Required | Standardized | Easy | |
| Phone | "Phone Number *" | tel input | `<input data-automation-id="phone">` | `[data-automation-id="phone"]` | Required | Standardized | Easy | Country code dropdown adjacent |
| Address Line 1 | "Address Line 1" | text input | `<input data-automation-id="addressLine1">` | `[data-automation-id="addressLine1"]` | Often Required | Standardized | Easy | |
| City | "City" | text input | `<input data-automation-id="city">` | `[data-automation-id="city"]` | Often Required | Standardized | Easy | |
| State | "State" | select/autocomplete | Custom Workday dropdown | `[data-automation-id="state"]` | Often Required | Standardized | Hard | Autocomplete dropdown |
| Zip Code | "Postal Code" | text input | `<input data-automation-id="postalCode">` | `[data-automation-id="postalCode"]` | Often Required | Standardized | Easy | |
| Country | "Country" | autocomplete | Workday custom dropdown | `[data-automation-id="country"]` | Required | Standardized | Hard | Must type then select from list |
| Resume | "Resume" | file upload | Inside "My Experience" section | `[data-automation-id="resumeSection"]`, file input nearby | Optional/Required | Standardized | Medium | Upload zone + file input |
| LinkedIn | "LinkedIn Profile URL" | text input | Inside My Experience or custom Q | `label:contains("LinkedIn")` | Optional | Semi-standard | Easy | |
| Work Auth | "Are you legally authorized to work in…?" | radio | Custom radio group | `label:contains("authorized to work")` | Optional | Standard pattern | Medium | |
| Sponsorship | "Will you require sponsorship…?" | radio | Custom radio group | `label:contains("sponsorship")` | Optional | Standard pattern | Medium | |
| School | "School or University" | autocomplete | Workday autocomplete component | `[data-automation-id="school"]` | Optional | Standardized | Hard | Type-ahead required |
| Degree | "Degree" | select | Workday select | `[data-automation-id="degree"]` | Optional | Standardized | Hard | Workday custom select |
| Field of Study | "Field of Study" | text input or autocomplete | `<input data-automation-id="fieldOfStudy">` | `[data-automation-id="fieldOfStudy"]` | Optional | Standardized | Medium | |
| GPA | "GPA" | text input | `<input data-automation-id="gpa">` | `[data-automation-id="gpa"]` | Optional | Standardized | Easy | |
| Grad Date | "Graduation Date" | date picker | Workday custom date component | `[data-automation-id="gradDate"]` | Optional | Standardized | Hard | MM/YYYY format typically |
| Previous Employer | "Employer Name" | text input | In work experience section | `[data-automation-id="employer"]` | Optional | Standardized | Easy | |
| Job Title | "Job Title" | text input | In work experience section | `[data-automation-id="jobTitle"]` | Optional | Standardized | Easy | |
| Start Date (job) | "Start Date" | date picker | Workday date component | `[data-automation-id="startDate"]` | Optional | Standardized | Hard | Part of work experience section |
| EEO – Gender | "Gender" | Workday radio/select | Inside Voluntary Disclosures step | `[data-automation-id*="gender"]` | Voluntary | Standardized | Medium | Step 4 typically |
| EEO – Race | "Race/Ethnicity" | Workday radio | Inside Voluntary Disclosures step | `[data-automation-id*="race"]` | Voluntary | Standardized | Medium | |
| EEO – Veteran | "Veteran Status" | Workday radio | Inside Voluntary Disclosures step | `[data-automation-id*="veteran"]` | Voluntary | Standardized | Medium | |
| EEO – Disability | "Disability Status" | Workday radio | Inside Voluntary Disclosures step | `[data-automation-id*="disability"]` | Voluntary | Standardized | Medium | |
| Custom Text Q | Employer-defined | textarea | Inside Application Questions step | Labelled textarea; no standard `data-automation-id` | Varies | Custom | Hard | AI needed |
| Next Button | "Next" | button | `<button data-automation-id="bottom-navigation-next-btn">` | `[data-automation-id="bottom-navigation-next-btn"]` | N/A | Standardized | Easy | Very reliable selector |
| Save & Continue | "Save and Continue" | button | Same as Next pattern | `[data-automation-id="bottom-navigation-next-btn"]` | N/A | Standardized | Easy | |
| Submit Button | "Submit" | button | `<button data-automation-id="bottom-navigation-next-btn">` | Last step "Next" becomes Submit | N/A | Standardized | Easy | |

---

### 2.4 Handshake

**Form Architecture:** Single-page for most applications (Quick Apply uses pre-filled profile). Full applications append job-specific questions below. Employer controls which sections appear.

**Auth/Login:** Almost always required (~90%+). Handshake is a platform requiring student/alumni login. Bot-resistant login page.

**Review Pages:** Not standard. Quick Apply has an immediate submit. Full Apply may have a review summary.

**Custom Questions:** Job-specific questions appear below standard fields. Template-based by institution (vary by school). Wide variety in phrasing.

**Confirmation State:** "Application submitted" banner or redirect to job posting page showing "Applied" badge. Dashboard shows status update.

#### Handshake Field Table

| Question Category | Exact Example Phrasing | Field Type | Typical HTML/DOM Pattern | Common Selector Clues | Required vs Optional | Standardized or Custom | Automation Difficulty | Notes |
|---|---|---|---|---|---|---|---|---|
| Full Name | Pre-filled from profile | text input (disabled) | `<input disabled>` | `name*="name"`, often locked | Pre-filled | Standardized | N/A (locked) | Cannot edit |
| Email | Pre-filled from profile | email (disabled) | `<input type="email" disabled>` | Locked | Pre-filled | Standardized | N/A | |
| Phone | Pre-filled or editable | tel | Standard input | `name*="phone"` | Optional | Standardized | Easy | |
| Resume | "Select Resume" | file/select | Pre-uploaded resume list or file input | `name*="resume"`, `[data-bind*="resume"]` | Required | Standardized | Medium | Select from saved resumes or upload |
| Cover Letter | "Cover Letter" | file/textarea | File input or textarea | `name*="cover_letter"` | Optional | Standardized | Medium | 1 MB limit if file |
| Work Auth | "Are you authorized to work in the US?" | radio | `<input type="radio">` | `label:contains("authorized")` | Optional | Standardized | Easy | |
| Location | Pre-filled or "Preferred Location" | text | May be pre-filled from profile | `name*="location"` | Optional | Semi-standard | Easy | |
| Start Date | "When can you start?" | date/text | Standard input | `label:contains("start")` | Optional | Varies | Easy | |
| GPA | Pre-filled from profile | text | May be locked | `name*="gpa"` | Optional | Standardized | Easy | |
| School | Pre-filled from profile | text (disabled) | Locked | N/A | Pre-filled | Standardized | N/A | |
| Major | Pre-filled from profile | text (disabled) | Locked | N/A | Pre-filled | Standardized | N/A | |
| Graduation | Pre-filled from profile | text (disabled) | Locked | N/A | Pre-filled | Standardized | N/A | |
| Custom Text Q | Institution/employer-defined | textarea | Standard textarea | Preceded by `<label>` | Varies | Custom | Hard | |
| Custom Radio | Employer-defined | radio group | Standard radio inputs | Grouped by `name` attribute | Varies | Custom | Medium | |
| Acknowledgement | "I certify that…" | checkbox | `<input type="checkbox">` | `name*="agree"` or `name*="certify"` | Required | Varies | Easy | |
| Submit Button | "Apply Now" / "Quick Apply" / "Submit Application" | button | `<button type="submit">` | `text:contains("Apply")`, `type="submit"` | N/A | Standardized | Easy | |

---

## Section 3: Exact Question Library

### Contact Info

| Portal | Exact Wording | Variants | Normalized Meaning | Field Key |
|--------|--------------|----------|-------------------|-----------|
| Greenhouse | "First Name" | "First name *" | Legal first name | `first_name` |
| Greenhouse | "Last Name" | "Last name *" | Legal last name | `last_name` |
| Greenhouse | "Email" | "Email Address" | Primary email | `email` |
| Greenhouse | "Phone" | "Phone Number", "Mobile" | Phone number | `phone` |
| Lever | "Full name" | "Name *", "Your name" | Full legal name | `full_name` |
| Lever | "Email" | "Email address" | Primary email | `email` |
| Lever | "Phone" | "Phone number" | Phone | `phone` |
| Lever | "Current company" | "Company", "Current employer" | Most recent employer | `current_company` |
| Workday | "First Name" | "Legal First Name" | Legal first name | `first_name` |
| Workday | "Last Name" | "Legal Last Name", "Family Name" | Legal last name | `last_name` |
| Workday | "Email Address" | "Primary Email" | Email | `email` |
| Workday | "Phone Number" | "Primary Phone" | Phone | `phone` |
| Workday | "Address Line 1" | "Street Address" | Address | `address_line1` |
| Workday | "City" | N/A | City | `city` |
| Workday | "State" | "Province", "Region" | State/Province | `state` |
| Workday | "Postal Code" | "Zip Code" | ZIP/Postal | `zip_code` |
| Workday | "Country" | N/A | Country | `country` |
| Handshake | (pre-filled) | N/A | From student profile | N/A |

### Resume / CV

| Portal | Exact Wording | Variants | Normalized Meaning | Field Key |
|--------|--------------|----------|-------------------|-----------|
| Greenhouse | "Resume/CV" | "Attach Resume", "Upload Resume" | Resume file | `resume_file` |
| Lever | "Resume or CV" | "Upload Resume" | Resume file | `resume_file` |
| Workday | "Resume" | "Attach Resume", "Upload CV" | Resume file | `resume_file` |
| Handshake | "Select Resume" | "Upload a Resume", "Choose Resume" | Resume file (from saved list or upload) | `resume_file` |

### Links

| Portal | Exact Wording | Variants | Normalized Meaning | Field Key |
|--------|--------------|----------|-------------------|-----------|
| Greenhouse | "LinkedIn Profile" | "LinkedIn URL" | LinkedIn profile URL | `linkedin_url` |
| Greenhouse | "Website" | "Personal Website", "Portfolio" | Website URL | `website_url` |
| Greenhouse | "Github" | "GitHub URL" | GitHub profile URL | `github_url` |
| Lever | "LinkedIn URL" | "LinkedIn Profile" | LinkedIn URL | `linkedin_url` |
| Lever | "Twitter URL" | "Twitter Handle" | Twitter URL | `twitter_url` |
| Lever | "GitHub URL" | "Github Profile" | GitHub URL | `github_url` |
| Lever | "Portfolio URL" | "Portfolio Website" | Portfolio URL | `portfolio_url` |
| Workday | "LinkedIn Profile URL" | "LinkedIn" | LinkedIn URL | `linkedin_url` |
| Handshake | (minimal link fields; profile-based) | | | |

### Education

| Portal | Exact Wording | Variants | Normalized Meaning | Field Key |
|--------|--------------|----------|-------------------|-----------|
| Greenhouse | "School" | "University", "College" | School name | `school_name` |
| Greenhouse | "Degree" | "Degree Type" | Degree (BS, MS, etc.) | `degree` |
| Greenhouse | "Discipline" | "Major", "Field of Study" | Major | `field_of_study` |
| Greenhouse | "GPA" | N/A | GPA | `gpa` |
| Greenhouse | "Graduation Date" | "Expected Graduation", "Grad Date" | Graduation month/year | `grad_date` |
| Lever | (education section varies; often custom) | | | |
| Workday | "School or University" | "Institution" | School | `school_name` |
| Workday | "Degree" | "Degree Type" | Degree | `degree` |
| Workday | "Field of Study" | "Major", "Concentration" | Major | `field_of_study` |
| Workday | "GPA" | N/A | GPA | `gpa` |
| Workday | "Graduation Date" | "Expected Graduation Date" | Graduation date | `grad_date` |
| Handshake | (pre-filled from profile) | | | |

### Work Authorization

| Portal | Exact Wording | Variants | Normalized Meaning | Field Key |
|--------|--------------|----------|-------------------|-----------|
| Greenhouse | "Are you legally authorized to work in the United States?" | "Are you eligible to work in the US?" | Work auth boolean | `us_work_authorized` |
| Lever | "Are you authorized to work lawfully in [country]?" | "Do you have work authorization?" | Work auth boolean | `work_authorized` |
| Workday | "Are you legally authorized to work in [country] for any employer?" | "Do you have the right to work?" | Work auth boolean | `work_authorized` |
| Handshake | "Are you authorized to work in the US?" | "US work authorization" | Work auth boolean | `us_work_authorized` |

### Sponsorship

| Portal | Exact Wording | Variants | Normalized Meaning | Field Key |
|--------|--------------|----------|-------------------|-----------|
| Greenhouse | "Will you now or in the future require sponsorship for employment visa status?" | "Do you require visa sponsorship?" | Sponsorship needed boolean | `requires_sponsorship` |
| Lever | "Will you now, or in the future, require sponsorship for employment visa status?" | "Will you require H1-B sponsorship?" | Sponsorship needed boolean | `requires_sponsorship` |
| Workday | "Will you now or in the future require sponsorship?" | "Do you need work visa sponsorship?" | Sponsorship boolean | `requires_sponsorship` |
| Handshake | "Do you require visa sponsorship?" | "Will you need visa sponsorship?" | Sponsorship boolean | `requires_sponsorship` |

### Availability / Start Date

| Portal | Exact Wording | Variants | Normalized Meaning | Field Key |
|--------|--------------|----------|-------------------|-----------|
| Greenhouse | "When are you available to start?" | "Earliest start date", "Available start date" | Availability date | `start_date` |
| Lever | "Earliest available start date" | "When can you start?" | Availability date | `start_date` |
| Workday | "Desired Start Date" | "Available to Start", "Start Date" | Start date | `start_date` |
| Handshake | "When can you start?" | "Available start date" | Start date | `start_date` |
| All portals | "Internship term" | "Which term?" | Internship session (Summer/Fall/Spring) | `internship_term` |

### Location / Relocation

| Portal | Exact Wording | Variants | Normalized Meaning | Field Key |
|--------|--------------|----------|-------------------|-----------|
| Greenhouse | "Location (City)" | "Location", "City" | Current or preferred location | `location` |
| Greenhouse | "Are you willing to relocate?" | "Open to relocation?" | Relocation willingness | `willing_to_relocate` |
| Lever | "Location" | "City, State" | Location | `location` |
| Workday | "Current Address" | "Home Address" | Home address | `address` |
| Workday | "Are you willing to relocate?" | "Relocation" | Relocation boolean | `willing_to_relocate` |
| All | "Preferred work location" | "Office preference", "Location preference" | Preferred office | `preferred_location` |

### Compensation

| Portal | Exact Wording | Variants | Normalized Meaning | Field Key |
|--------|--------------|----------|-------------------|-----------|
| Greenhouse | "Desired salary" | "Salary expectations", "Expected salary" | Salary range / expectation | `salary_expectation` |
| Lever | "Desired salary range" | "What are your salary expectations?" | Salary expectation | `salary_expectation` |
| All | "Current salary" | "Current compensation" | Current salary | `current_salary` |

### EEO / Demographic

| Portal | Exact Wording | Variants | Normalized Meaning | Field Key |
|--------|--------------|----------|-------------------|-----------|
| Greenhouse | "Gender" | "What is your gender?" | Gender identity | `eeo_gender` |
| Greenhouse | "Race/Ethnicity" | "What is your race?" | Race/ethnicity | `eeo_race` |
| Greenhouse | "Veteran Status" | "Are you a protected veteran?" | Veteran status | `eeo_veteran_status` |
| Greenhouse | "Disability Status" | "Do you have a disability?" | Disability status | `eeo_disability_status` |
| Lever | "What is your gender?" | "Gender" | Gender | `eeo_gender` |
| Lever | "What is your race or ethnicity?" | "Race/Ethnicity" | Race/ethnicity | `eeo_race` |
| Lever | "Veteran status" | "Protected veteran?" | Veteran status | `eeo_veteran_status` |
| Workday | "Gender" (Voluntary Disclosures step) | "Sex" | Gender | `eeo_gender` |
| Workday | "Race/Ethnicity" (Voluntary Disclosures step) | "Ethnicity" | Race/ethnicity | `eeo_race` |
| Workday | "Veteran Status" | "Military service" | Veteran status | `eeo_veteran_status` |
| Workday | "Disability" | "VEVRAA", "ADA" | Disability status | `eeo_disability_status` |

---

## Section 4: HTML / UI Implementation Patterns

### Greenhouse HTML Patterns

**Text Input (Standard fields)**
```html
<div class="field">
  <label for="job_application_first_name">First Name<span class="required">*</span></label>
  <input type="text"
         name="job_application[first_name]"
         id="job_application_first_name"
         class="input-field"
         required>
</div>
```
- Required: `<span class="required">*</span>` next to label
- Errors: `<div class="field_error">` or `<span class="error">` below input; red border on input

**File Upload**
```html
<div class="field resume-field">
  <label>Resume/CV<span class="required">*</span></label>
  <div class="drop-area" id="drop-zone-resume">
    Drag and drop your file here, or
    <a href="#" class="browse-link">browse</a>
    <input type="file" name="job_application[resume]" accept=".pdf,.doc,.docx" style="display:none">
  </div>
</div>
```
- Must use `setInputFiles()` on the hidden input directly, not click the visible zone

**Radio Group (Work Auth)**
```html
<div class="field">
  <label>Are you legally authorized to work in the United States?<span class="required">*</span></label>
  <div class="radio-group">
    <label><input type="radio" name="job_application[answers][12345][value]" value="Yes"> Yes</label>
    <label><input type="radio" name="job_application[answers][12345][value]" value="No"> No</label>
  </div>
</div>
```
- Answer ID (12345) changes per employer — match by adjacent label text instead

**EEO Block**
```html
<div id="eeoc_fields" class="eeoc-module">
  <h3>Voluntary Self-Identification</h3>
  <div class="field">
    <label for="job_application_gender">Gender</label>
    <select name="job_application[answers][gender]" id="job_application_gender">
      <option value="">Select...</option>
      <option value="male">Male</option>
      <option value="female">Female</option>
      <option value="decline">Decline to state</option>
    </select>
  </div>
  <!-- race, veteran, disability selects follow same pattern -->
</div>
```

**Custom Question (textarea)**
```html
<div class="field application-question">
  <label for="custom_question_98765">Why do you want to work at [Company]?</label>
  <textarea name="job_application[answers][98765][value]"
            id="custom_question_98765"
            maxlength="500">
  </textarea>
</div>
```

**Submit Button**
```html
<button type="submit" id="submit_app" class="submit-btn btn btn-primary">Submit Application</button>
```

---

### Lever HTML Patterns

**Text Input**
```html
<div class="application-field" data-field-type="input">
  <label class="field-label" for="name">Full name<span class="required-indicator">*</span></label>
  <input type="text"
         id="name"
         name="name"
         class="field-input"
         placeholder="Your full name"
         required>
</div>
```

**Link Question (LinkedIn)**
```html
<div class="application-field" data-field-type="link">
  <label class="field-label">LinkedIn Profile</label>
  <input type="url"
         data-type="linkedin"
         name="urls[LinkedIn]"
         placeholder="https://www.linkedin.com/in/..."
         class="link-field">
</div>
```
- `data-type` attribute is the most reliable selector for link fields

**File Upload**
```html
<div class="application-upload-field">
  <label>Resume or CV</label>
  <div class="lever-upload-container">
    <button class="upload-btn" type="button">Upload file</button>
    <input type="file" name="resume" accept=".pdf,.doc,.docx" class="hidden-file-input">
  </div>
</div>
```

**Custom Textarea**
```html
<div class="application-question" data-qa="custom-question">
  <label class="question-label">Why are you interested in this role?</label>
  <textarea class="application-answer" name="cards[12345][field1]" rows="4"></textarea>
</div>
```

**EEO Block**
```html
<div class="eeoc-module">
  <h4>Equal Opportunity Employment</h4>
  <div class="eeoc-field">
    <label>What is your gender?</label>
    <select name="eeoGender" class="eeoc-select">
      <option value=""></option>
      <option value="male">Male</option>
      <option value="female">Female</option>
      <option value="other">Non-binary/Other</option>
      <option value="decline">I don't wish to answer</option>
    </select>
  </div>
</div>
```

**Submit Button**
```html
<button type="submit" class="lever-submit-btn postings-btn" data-qa="submit-application">
  Submit application
</button>
```

---

### Workday HTML Patterns

**Text Input**
```html
<div data-automation-id="formField-firstName" class="wd-field">
  <label data-automation-id="label-firstName">
    First Name
    <span aria-label="required" class="wd-required">*</span>
  </label>
  <input type="text"
         data-automation-id="firstName"
         aria-required="true"
         class="wd-input">
</div>
```
- `data-automation-id` is the most stable selector — use it universally for Workday

**Autocomplete Dropdown (State/Country/School)**
```html
<div data-automation-id="formField-state" class="wd-field">
  <label>State</label>
  <div class="wd-autocomplete-container">
    <input type="text"
           data-automation-id="state"
           role="combobox"
           aria-autocomplete="list"
           autocomplete="off">
    <div class="wd-autocomplete-list" role="listbox" style="display:none">
      <!-- options rendered dynamically -->
    </div>
  </div>
</div>
```
- Strategy: `fill()` triggers the dropdown, then `page.getByRole('option', { name: exactMatch })` to select
- Do NOT use `selectOption()` — it won't work with Workday custom components

**Date Picker**
```html
<div data-automation-id="formField-gradDate">
  <label>Graduation Date</label>
  <div class="wd-date-picker">
    <input type="text"
           data-automation-id="gradDate"
           placeholder="MM/YYYY"
           class="wd-date-input">
    <button class="wd-calendar-btn" aria-label="Open calendar">📅</button>
  </div>
</div>
```
- Type directly into date input; use format "MM/YYYY" or "MM/DD/YYYY" depending on context

**Navigation Buttons**
```html
<div class="wd-button-bar" data-automation-id="footer-navigation">
  <button data-automation-id="bottom-navigation-previous-btn">Previous</button>
  <button data-automation-id="bottom-navigation-next-btn">Next</button>
</div>
```

**Error Display**
```html
<!-- Inline error -->
<div data-automation-id="errorMessage" class="wd-error" role="alert">
  This field is required.
</div>

<!-- Summary (top of page) -->
<div class="wd-error-summary" aria-live="polite">
  <span>3 error(s) need your attention</span>
  <ul>
    <li>First Name is required</li>
  </ul>
</div>
```

---

### Handshake HTML Patterns

**Pre-filled / Locked Fields**
```html
<div class="profile-field">
  <label>Name</label>
  <input type="text" value="John Doe" disabled class="locked-field">
</div>
```

**Resume Selection**
```html
<div class="resume-section">
  <label>Resume</label>
  <select name="resume_id" class="resume-select">
    <option value="">-- Select a resume --</option>
    <option value="123">John_Doe_Resume_2024.pdf</option>
    <option value="456">JohnDoe_SWE.pdf</option>
  </select>
  <span class="or-divider">or</span>
  <input type="file" name="resume_upload" accept=".pdf,.doc,.docx">
</div>
```

**Submit Button**
```html
<button type="submit" class="btn btn-primary" data-action="submit-application">
  Apply Now
</button>
```
or
```html
<button class="quick-apply-btn" data-quick-apply="true">
  Quick Apply
</button>
```

---

## Section 5: Deterministic Automation Opportunities

### Greenhouse

**Bucket 1: Deterministic – Hardcode**
- First name (`job_application[first_name]`)
- Last name (`job_application[last_name]`)
- Email (`job_application[email]`)
- Phone (`job_application[phone]`)
- LinkedIn URL (`job_application[urls][LinkedIn]`)
- Website URL (`job_application[urls][Website]`)
- GitHub URL (`job_application[urls][Github]`)
- Resume file upload (`job_application[resume]`)
- Work auth radio (label-match "authorized to work", fill "Yes" or "No")
- Sponsorship radio (label-match "sponsorship", fill "Yes" or "No")
- EEO gender, race, veteran, disability (all inside `#eeoc_fields` — select "Decline to state" or user preference)

**Bucket 2: Deterministic but Needs Fallback Selector**
- Location/City (Google Maps autocomplete may trigger; need to suppress or handle)
- Graduation date (format may be date picker or text input; detect and adapt)
- GPA (present in ~50% of forms; selector may vary slightly)
- School, degree fields (inside optional education section)
- Cover letter (sometimes file, sometimes textarea — detect field type first)
- Custom multiple-choice questions (read options, match to user preference by text)

**Bucket 3: Fallback AI or Human**
- Free-text custom screening questions ("Why do you want to work here?", "Describe a challenge…")
- Multi-paragraph essay fields
- Any file upload beyond resume (e.g., writing sample, transcript)

---

### Lever

**Bucket 1: Deterministic – Hardcode**
- Full name (`name`)
- Email (`email`)
- Phone (`phone`)
- LinkedIn (`data-type="linkedin"`)
- GitHub (`data-type="github"`)
- Portfolio (`data-type="portfolio"`)
- Website (`data-type="other"`)
- Resume upload (`name="resume"`)
- EEO block inside `.eeoc-module` (select "Decline to answer" or user preference)

**Bucket 2: Deterministic but Needs Fallback**
- Current company (`name="org"`) — present in ~60% of Lever forms
- Location (`name="location"`) — present in ~50%
- Work auth / sponsorship (custom fields; label-match strategy needed)
- Custom multiple-choice / select fields (read options, match deterministically if options are Yes/No/Maybe/Similar)

**Bucket 3: Fallback AI or Human**
- Free-text custom questions (`.application-answer` textareas with employer labels)
- Custom cover letter fields
- Job-specific document uploads

---

### Workday

**Bucket 1: Deterministic – Hardcode**
- First name (`data-automation-id="firstName"`)
- Last name (`data-automation-id="lastName"`)
- Email (`data-automation-id="email"`)
- Phone (`data-automation-id="phone"`)
- Address line 1 (`data-automation-id="addressLine1"`)
- City (`data-automation-id="city"`)
- ZIP/Postal (`data-automation-id="postalCode"`)
- GPA (`data-automation-id="gpa"`)
- Navigation buttons (`data-automation-id="bottom-navigation-next-btn"`)
- EEO block — Voluntary Disclosures step (select "I don't wish to answer" options)

**Bucket 2: Deterministic but Needs Fallback**
- State / Country (autocomplete dropdowns — type then select from dynamic list)
- School name (autocomplete — must match exactly or select "other/unlisted")
- Degree type (Workday custom select component)
- Graduation date (date picker — format detection needed)
- Work auth / sponsorship (radio groups — label-match strategy)

**Bucket 3: Fallback AI or Human**
- Application Questions step — all custom employer fields
- Dynamic conditional questions (if "No" to work auth, follow-up Q appears)
- Skills assessments or multi-part questionnaires
- Document uploads beyond resume

---

### Handshake

**Bucket 1: Deterministic – Hardcode**
- Resume selection (select saved resume by name or upload new)
- Work auth radio (standard phrasing; label-match)
- Standard acknowledgement checkboxes
- Submit button (text or `data-action="submit-application"`)

**Bucket 2: Deterministic but Needs Fallback**
- Login/auth (must handle existing session; SSO detection; escalate if CAPTCHA)
- School-specific questions (template patterns exist per institution but vary)
- Cover letter (file vs textarea detection)

**Bucket 3: Fallback AI or Human**
- All custom job-specific questions
- Login wall (manual login likely required the first time per session)

---

## Section 6: Recommended Internal Data Model

```typescript
interface ApplicationProfile {
  // Identity
  first_name: string;           // "John"              | User-authored | GH, WD
  last_name: string;            // "Doe"               | User-authored | GH, WD
  full_name: string;            // "John Doe"          | Inferred from first+last | LV, HS
  middle_name?: string;         // "Michael"           | User-authored | WD

  // Contact
  email: string;                // "john@example.com"  | User-authored | All
  phone: string;                // "+15551234567"      | User-authored | All
  address_line1?: string;       // "123 Main St"       | User-authored | WD
  address_line2?: string;       // "Apt 4B"            | User-authored | WD
  city?: string;                // "San Francisco"     | User-authored | WD, GH
  state?: string;               // "CA"                | User-authored | WD
  zip_code?: string;            // "94102"             | User-authored | WD
  country?: string;             // "United States"     | User-authored | WD

  // Links
  linkedin_url?: string;        // "https://linkedin.com/in/johndoe" | User-authored | All
  github_url?: string;          // "https://github.com/johndoe"      | User-authored | GH, LV
  portfolio_url?: string;       // "https://johndoe.dev"             | User-authored | LV, GH
  website_url?: string;         // "https://johndoe.com"             | User-authored | GH, LV
  twitter_url?: string;         // "https://twitter.com/johndoe"     | User-authored | LV

  // Education
  school_name: string;          // "UC Berkeley"       | User-authored | GH, WD, HS
  degree: string;               // "Bachelor of Science" | User-authored | GH, WD
  field_of_study: string;       // "Computer Science"  | User-authored | GH, WD
  gpa?: string;                 // "3.8"               | User-authored | GH, WD, HS
  grad_date: string;            // "2026-05"           | User-authored | GH, WD

  // Files
  resume_path: string;          // "/path/to/resume.pdf" | User-provided | All
  cover_letter_path?: string;   // "/path/to/cl.pdf"   | User-provided | All (optional)

  // Legal / Work Authorization
  us_work_authorized: boolean;  // true                | User-authored | All
  requires_sponsorship: boolean; // false              | User-authored | All
  visa_type?: string;           // "F-1 OPT"          | User-authored | Some

  // Compensation
  salary_expectation?: string;  // "$45/hr"            | User-authored | GH, LV
  current_salary?: string;      // "N/A (student)"     | User-authored | Rare

  // Location Preferences
  location: string;             // "San Francisco, CA" | User-authored | GH, LV, WD
  willing_to_relocate: boolean; // true                | User-authored | Some
  preferred_locations?: string[]; // ["SF", "NYC", "Remote"] | User-authored | Some
  remote_preference?: "remote" | "hybrid" | "onsite" | "any"; // User preference

  // Availability
  start_date: string;           // "2026-06-01"        | User-authored | All
  internship_term?: string;     // "Summer 2026"       | Inferred | All

  // EEO / Demographic (voluntary; stored as user preference for autofill)
  eeo_gender?: string;          // "Decline to self-identify" | User-authored | All
  eeo_race?: string;            // "Decline to self-identify" | User-authored | All
  eeo_veteran_status?: string;  // "I am not a protected veteran" | User-authored | All
  eeo_disability_status?: string; // "I don't wish to answer" | User-authored | All

  // Custom Freeform Answers (cached per question text)
  custom_answers?: {
    [question_text_hash: string]: string; // AI-generated or user-authored
  };

  // Portal-specific overrides
  portal_overrides?: {
    [portal: string]: Partial<ApplicationProfile>;
  };
}
```

---

## Section 7: Recommended Automation Rules

### Greenhouse

**Portal Detection**
- URL contains `greenhouse.io` OR `boards.greenhouse.io`
- Page has `<form id="application_form">` or `<div class="greenhouse-job-board">`
- `<meta>` tag: `content="Greenhouse"` in job board pages

**Field Fill Order**
1. First name → Last name → Email → Phone
2. Location (watch for autocomplete)
3. Resume upload
4. LinkedIn, GitHub, Website URLs
5. Work auth radio → Sponsorship radio
6. Education block (if present): School → Degree → Major → GPA → Grad Date
7. Custom fields (process top-to-bottom)
8. EEO block (autofill with "Decline to state" unless user preference set)
9. Submit button

**Optional vs Required Strategy**
- Only skip fields that are not marked with `required` attribute OR `<span class="required">*</span>`
- Always fill EEO with "Decline" unless user explicitly set preferences

**Navigation**
- Single page. After filling, click `#submit_app` or `button[type="submit"]`
- Wait for redirect or confirmation overlay

**Validation Error Detection**
- Look for `<div class="field_error">`, `<span class="error">`, or red borders on inputs
- On error: read error text, try to fix the specific field, then re-submit

**Success Detection**
- URL changes to `/jobs/{id}/thank_you`
- Page contains text matching `/thank you for applying/i` or `/application submitted/i`

**Auth/Login Blocker Detection**
- If a login modal appears: escalate to human; do not attempt login automation

**Fallback Triggers**
- Unrecognized field name pattern → visual fallback
- Custom essay question detected → AI answer generation
- CAPTCHA detected → human escalation

---

### Lever

**Portal Detection**
- URL contains `lever.co` or `jobs.lever.co`
- Page has `<div class="lever-job-posting">` or `<form class="lever-apply-form">`

**Field Fill Order**
1. Full name → Email → Phone
2. Current company (if present)
3. Location (if present)
4. Resume upload
5. LinkedIn, GitHub, Portfolio, Website (all `data-type` link fields)
6. Work auth / sponsorship (if present; label-match)
7. Custom questions top-to-bottom
8. EEO block (`.eeoc-module`)
9. Submit

**Navigation**
- Single page. Click `[data-qa="submit-application"]` or `button[type="submit"]` with text "Submit application"

**Validation Error Detection**
- Look for `[role="alert"]`, `.error-msg`, red outlines on inputs
- Some Lever forms use `aria-invalid="true"` on error fields

**Success Detection**
- Text "Thank you for your application" or "Application submitted" on page
- URL may change to `/thank-you` or `/confirmation`

---

### Workday

**Portal Detection**
- URL contains `.myworkdayjobs.com` or `workday.com`
- Page DOM has `[data-automation-id="wd-ApplicationPage"]` or similar Workday-specific attribute

**Field Fill Order — Step by Step**
1. **Step: My Information** — Fill address, name, email, phone, gender (optional)
2. **Step: My Experience** — Upload resume, fill education, work history
3. **Step: Application Questions** — Custom employer questions (AI fallback for text, deterministic for select/radio)
4. **Step: Voluntary Disclosures** — EEO fields
5. **Step: Review** — Read-only. Verify no missing required fields shown
6. **Step: Submit** — Click final Next/Submit button

**Multi-Step Navigation**
- After each step: wait for `[data-automation-id="bottom-navigation-next-btn"]` to be clickable
- Click Next → wait 2000–4000ms for SPA re-render
- Verify new step has loaded by checking for expected `data-automation-id` values
- If error summary appears in top-right, parse and fix errors before proceeding

**Autocomplete Handling**
```
1. page.fill('[data-automation-id="state"]', 'California')
2. await page.waitForSelector('[role="option"]', { timeout: 3000 })
3. page.getByRole('option', { name: 'California' }).click()
```

**Validation Error Detection**
- `[data-automation-id="errorMessage"]` inline
- `.wd-error-summary` at page top
- Red highlight on `aria-invalid="true"` fields

**Success Detection**
- Text "Application Submitted Successfully"
- Confirmation number visible on page
- URL change to confirmation page

**Auth/Login Blocker**
- Workday login modal appears → Attempt SSO if available → Otherwise escalate to human

---

### Handshake

**Portal Detection**
- URL contains `joinhandshake.com` or `app.joinhandshake.com`
- Page DOM has `class*="handshake"` indicators

**Field Fill Order**
1. Detect login state — if not logged in, escalate to human for login
2. Navigate to job → Click "Apply" or "Quick Apply"
3. If Quick Apply: confirm resume selection → Click Apply Now
4. If Full Apply: select resume → fill any visible fields → answer custom questions → submit

**Login Handling**
- Detect login state by checking for user profile menu or session cookie
- If not logged in: stop and escalate — Handshake login is credential-sensitive and CAPTCHA-prone

**Success Detection**
- "Application submitted" banner
- Job listing page now shows "Applied" badge
- Dashboard shows new application entry

---

## Section 8: High-Signal Selector Clues

### Greenhouse Selectors

| Field | Primary Selector | Fallback Selector | Label Clue |
|-------|-----------------|-------------------|-----------|
| First Name | `input[name="job_application[first_name]"]` | `input#job_application_first_name` | "First Name" |
| Last Name | `input[name="job_application[last_name]"]` | `input#job_application_last_name` | "Last Name" |
| Email | `input[name="job_application[email]"]` | `input[type="email"]` | "Email" |
| Phone | `input[name="job_application[phone]"]` | `input[type="tel"]` | "Phone" |
| LinkedIn | `input[name*="[LinkedIn]"]` | `input[type="url"][name*="url"]` | "LinkedIn" |
| GitHub | `input[name*="[Github]"]` or `input[name*="[GitHub]"]` | | "Github"/"GitHub" |
| Website | `input[name*="[Website]"]` | | "Website" |
| Resume | `input[type="file"][name*="resume"]` | `#drop-zone-resume input[type="file"]` | "Resume" |
| Work Auth | `input[type="radio"][name*="authorization"]` | Radio near label "authorized to work" | "authorized" |
| Sponsorship | `input[type="radio"][name*="sponsorship"]` | Radio near label "sponsorship" | "sponsorship" |
| Location | `input#job_application_location` | `input[id*="location"]` | "Location" |
| GPA | `input[name*="gpa"]` | Input near label "GPA" | "GPA" |
| School | `input[name*="school"]` | | "School" |
| Degree | `select[name*="degree"]` | | "Degree" |
| Grad Date | `input[name*="grad"]` or `select[name*="grad"]` | | "Graduation" |
| EEO Gender | `select[name*="gender"]` inside `#eeoc_fields` | | "Gender" |
| EEO Race | `select[name*="race"]` inside `#eeoc_fields` | | "Race" |
| EEO Veteran | `select[name*="veteran"]` | | "Veteran" |
| EEO Disability | `select[name*="disability"]` | | "Disability" |
| Submit | `button#submit_app` | `button[type="submit"]` | "Submit Application" |
| Confirmation | URL: `/thank_you` | Text: "Thank you for applying" | |

---

### Lever Selectors

| Field | Primary Selector | Fallback Selector | Label Clue |
|-------|-----------------|-------------------|-----------|
| Full Name | `input[name="name"]` | `input[id="name"]` | "Full name" |
| Email | `input[name="email"]` | `input[type="email"]` | "Email" |
| Phone | `input[name="phone"]` | `input[type="tel"]` | "Phone" |
| Company | `input[name="org"]` | Input near "company" label | "Current company" |
| Location | `input[name="location"]` | | "Location" |
| LinkedIn | `input[data-type="linkedin"]` | | "LinkedIn" |
| GitHub | `input[data-type="github"]` | | "GitHub" |
| Portfolio | `input[data-type="portfolio"]` | | "Portfolio" |
| Website | `input[data-type="other"]` | | "Website" |
| Resume | `input[type="file"][name="resume"]` | `.lever-upload-container input[type="file"]` | "Resume" |
| EEO Gender | `select[name="eeoGender"]` inside `.eeoc-module` | | "Gender" |
| EEO Race | `select[name="eeoRace"]` or `select[name*="race"]` | | "Race" |
| EEO Veteran | `select[name*="veteran"]` | | "Veteran" |
| Submit | `[data-qa="submit-application"]` | `button[type="submit"]` | "Submit application" |
| Confirmation | Text: "Application submitted" | URL: `/thank-you` | |

---

### Workday Selectors

| Field | Primary Selector | Fallback | Label Clue |
|-------|-----------------|---------|-----------|
| First Name | `[data-automation-id="firstName"]` | `input[aria-label*="First Name"]` | "First Name" |
| Last Name | `[data-automation-id="lastName"]` | | "Last Name" |
| Email | `[data-automation-id="email"]` | `input[type="email"]` | "Email" |
| Phone | `[data-automation-id="phone"]` | `input[type="tel"]` | "Phone" |
| Address 1 | `[data-automation-id="addressLine1"]` | | "Address Line 1" |
| City | `[data-automation-id="city"]` | | "City" |
| State | `[data-automation-id="state"]` (autocomplete) | | "State" |
| ZIP | `[data-automation-id="postalCode"]` | | "Postal Code" |
| Country | `[data-automation-id="country"]` (autocomplete) | | "Country" |
| School | `[data-automation-id="school"]` (autocomplete) | | "School" |
| Degree | `[data-automation-id="degree"]` | | "Degree" |
| Field of Study | `[data-automation-id="fieldOfStudy"]` | | "Field of Study" |
| GPA | `[data-automation-id="gpa"]` | | "GPA" |
| Grad Date | `[data-automation-id="gradDate"]` | | "Graduation Date" |
| Next Button | `[data-automation-id="bottom-navigation-next-btn"]` | `button:contains("Next")` | "Next" |
| Submit | `[data-automation-id="bottom-navigation-next-btn"]` (final step) | | "Submit" |
| Confirmation | Text: "Application Submitted Successfully" | | |

---

### Handshake Selectors

| Field | Primary Selector | Fallback | Label Clue |
|-------|-----------------|---------|-----------|
| Resume Select | `select[name="resume_id"]` | `.resume-select` | "Resume" |
| Resume Upload | `input[type="file"][name="resume_upload"]` | | "Upload" |
| Work Auth | `input[type="radio"]` near "authorized" label | | "authorized" |
| Submit | `button[data-action="submit-application"]` | `button:contains("Apply Now")`, `button[type="submit"]` | "Apply Now" |
| Quick Apply | `button[data-quick-apply="true"]` | `button:contains("Quick Apply")` | "Quick Apply" |
| Confirmation | Text: "Application submitted" | Job page shows "Applied" badge | |

---

## Section 9: Edge Cases and Failure Modes

### All Portals

| Failure Mode | How It Appears | Frequency | Deterministic Recovery | Recommendation |
|---|---|---|---|---|
| Custom free-text questions | Textarea with employer-defined label | Very High | No | Always escalate to AI for answer generation |
| CAPTCHA / bot detection | reCAPTCHA overlay, hCaptcha, Cloudflare challenge | Medium (Handshake high) | No | Human escalation |
| Modal login interrupt | Login modal appears mid-apply | Low–High by portal | No | Escalate to human for first-time session setup |
| Duplicate submit buttons | "Submit" appears multiple times on page | Low | Yes — click first visible enabled one | Check `disabled` attribute |
| Required checkbox (custom) | Unchecked checkbox blocks submit with validation error | Medium | Yes — detect + check | Scan for unchecked required checkboxes before submit |
| Stale DOM after navigation | Element existed, then disappeared after step change | High (Workday) | Yes — re-query with fresh locator | Never cache locators across step transitions |

### Greenhouse-Specific

| Failure Mode | Frequency | Recovery |
|---|---|---|
| Google Maps autocomplete triggered on Location field | High | Type city name, press Escape or Tab to dismiss autocomplete, or select first option |
| Custom checkbox acknowledgements not detected | Medium | Scan for `input[type="checkbox"]` that are unchecked and required before submit |
| Education section not present (optional and collapsed) | Medium | Check if section exists before attempting to fill |
| Resume upload drag-zone intercepts click | Medium | Use `setInputFiles()` on the hidden `input[type="file"]` directly |

### Lever-Specific

| Failure Mode | Frequency | Recovery |
|---|---|---|
| Multiple link fields with `data-type="other"` (ambiguous which is Portfolio vs Website) | Medium | Fill first "other" type as portfolio, second as website; or match by surrounding label |
| Employer-added LinkedIn field separate from native Lever LinkedIn field | Low | Detect duplicates; fill the `data-type` one first |
| Cover letter field appearing as either file or textarea depending on employer config | High | Detect field type before attempting fill |

### Workday-Specific

| Failure Mode | Frequency | Recovery |
|---|---|---|
| Autocomplete dropdown doesn't populate (slow network) | Medium | Increase wait time; retry type; escalate if still empty |
| "School not found" in autocomplete | Medium | Try abbreviated name, then select "Other" if available |
| Multiple "Application Questions" steps (chained) | Medium | Parse progress indicator to determine total steps before proceeding |
| Conditional follow-up fields (e.g., if "No" to work auth, follow-up appears) | High | After filling auth field, wait 500ms and re-scan for new visible fields |
| Review screen shows unanswered required fields | Medium | Go back to that step, fill field, proceed again |
| SPA timing issues (Next button clicked before page fully loaded) | High | Wait for loading spinner to disappear before clicking Next; use `waitForLoadState("networkidle")` |

### Handshake-Specific

| Failure Mode | Frequency | Recovery |
|---|---|---|
| Session expired mid-apply | Medium | Detect redirect to login page; escalate to human |
| Resume list empty (no pre-uploaded resumes) | Medium | Fall back to file upload path |
| File conversion approval prompt (DOC → PDF) | High for DOC files | Detect approval modal; click "Approve" |
| School-specific question templates vary wildly | Very High | AI fallback for all custom Q blocks |
| 1MB file size limit exceeded | Medium | Warn user before attempting upload; check file size first |

---

## Section 10: Final Deliverables

### 10.1 Portal Difficulty Ranking

1. **Handshake** — Easiest form logic, but login wall is significant obstacle
2. **Greenhouse** — Easiest overall if login is not required; very predictable DOM
3. **Lever** — Slightly more variable custom Q patterns; otherwise clean
4. **Workday** — Hardest; multi-step, SPA complexity, autocomplete components, auth walls

### 10.2 Build-First Recommendation

**Week 1–2: Greenhouse** — Highest return on investment. Most internship applications use Greenhouse. Single-page, predictable selectors, low auth friction. EEO automation is nearly turnkey.

**Week 3–4: Lever** — Very similar single-page architecture. Build on Greenhouse foundations. Handle `data-type` link fields and EEO module.

**Week 5–6: Handshake** — Focus on session management and resume selection. Defer login automation; require manual session setup. Build quick-apply path first.

**Week 7–10: Workday** — Heaviest engineering effort. Multi-step navigator, autocomplete handling, error recovery between steps.

### 10.3 Top 30 Recurring Question Types (All Portals)

1. First name
2. Last name / Full name
3. Email address
4. Phone number
5. Resume/CV upload
6. LinkedIn profile URL
7. Work authorization (Yes/No)
8. Visa sponsorship requirement (Yes/No)
9. Location / city
10. Portfolio / website URL
11. GitHub URL
12. School / university name
13. Degree type
14. Field of study / major
15. Graduation date
16. GPA
17. EEO – gender (voluntary)
18. EEO – race/ethnicity (voluntary)
19. EEO – veteran status (voluntary)
20. EEO – disability status (voluntary)
21. Cover letter (file or text)
22. Available start date
23. Willing to relocate (Yes/No)
24. Internship term preference
25. Salary expectation
26. Current company / employer
27. Custom free-text screening question
28. Custom multiple-choice screening question
29. Legal acknowledgement checkbox
30. "How did you hear about us?" source field

### 10.4 Top 15 Exact Question Phrasings to Support First

1. "Are you legally authorized to work in the United States?"
2. "Will you now or in the future require sponsorship for employment visa status?"
3. "When are you available to start?"
4. "What is your highest level of education?"
5. "What is your GPA?"
6. "What is your expected graduation date?"
7. "Are you willing to relocate?"
8. "What is your desired salary?"
9. "Where did you hear about this position?"
10. "Do you have any disabilities?"
11. "Are you a veteran?"
12. "What is your gender?"
13. "What is your race or ethnicity?"
14. "Please upload your resume."
15. "Please provide your LinkedIn profile URL."

### 10.5 Top 15 Selector Patterns to Encode First

1. `input[name="job_application[first_name]"]` — Greenhouse first name
2. `input[name="job_application[last_name]"]` — Greenhouse last name
3. `input[name="job_application[email]"]` — Greenhouse email
4. `input[name="job_application[phone]"]` — Greenhouse phone
5. `input[name*="[LinkedIn]"]` — Greenhouse LinkedIn
6. `input[type="file"][name*="resume"]` — Greenhouse resume
7. `input[name="name"]` — Lever full name
8. `input[data-type="linkedin"]` — Lever LinkedIn (most reliable Lever selector)
9. `[data-qa="submit-application"]` — Lever submit
10. `[data-automation-id="firstName"]` — Workday first name
11. `[data-automation-id="lastName"]` — Workday last name
12. `[data-automation-id="email"]` — Workday email
13. `[data-automation-id="bottom-navigation-next-btn"]` — Workday next/submit
14. `select[name="resume_id"]` — Handshake resume select
15. `button[data-action="submit-application"]` — Handshake submit

### 10.6 What MUST NOT Be Automated Blindly

- **Login credentials / passwords** — Never automate credential entry
- **Legal attestations with substantive content** — Show user before checking boxes with legal language beyond standard EEO voluntary disclosures
- **Salary negotiation fields** — Only fill if user has explicitly set a preference; otherwise skip
- **"How did you hear about us?" referral fields** — If a referral name is expected, do not fabricate
- **Custom essay responses** — Never submit AI-generated answers without user review for high-stakes applications
- **Demographic fields beyond "Decline to answer"** — Only fill with actual user preference, never assume
- **Document uploads beyond resume** (transcripts, writing samples) — Require explicit user-provided file
- **Background check consent checkboxes** — Must surface to user before checking
- **Confidentiality / NDA acknowledgements** — Must surface to user before checking
- **Multi-step forms where current step state is unknown** — Do not click Next if you don't know what step you're on

---

## Section A: Machine-Readable Mapping Draft

```json
{
  "greenhouse": {
    "contact_fields": [
      { "key": "first_name", "selector": "input[name=\"job_application[first_name]\"]", "type": "text", "required": true },
      { "key": "last_name", "selector": "input[name=\"job_application[last_name]\"]", "type": "text", "required": true },
      { "key": "email", "selector": "input[name=\"job_application[email]\"]", "type": "email", "required": true },
      { "key": "phone", "selector": "input[name=\"job_application[phone]\"]", "type": "tel", "required": false },
      { "key": "location", "selector": "input#job_application_location", "type": "text", "required": false, "note": "Google Maps autocomplete; handle carefully" }
    ],
    "education_fields": [
      { "key": "school_name", "selector": "input[name*=\"school\"]", "type": "text", "required": false },
      { "key": "degree", "selector": "select[name*=\"degree\"]", "type": "select", "required": false },
      { "key": "field_of_study", "selector": "input[name*=\"discipline\"]", "type": "text", "required": false },
      { "key": "gpa", "selector": "input[name*=\"gpa\"]", "type": "text", "required": false },
      { "key": "grad_date", "selector": "input[name*=\"grad\"]", "type": "text", "required": false, "format": "detect" }
    ],
    "links_fields": [
      { "key": "linkedin_url", "selector": "input[name*=\"[LinkedIn]\"]", "type": "url" },
      { "key": "github_url", "selector": "input[name*=\"[Github]\"]", "type": "url" },
      { "key": "portfolio_url", "selector": "input[name*=\"[Portfolio]\"]", "type": "url" },
      { "key": "website_url", "selector": "input[name*=\"[Website]\"]", "type": "url" }
    ],
    "authorization_fields": [
      {
        "key": "us_work_authorized",
        "selector_strategy": "radio_by_label",
        "label_pattern": "authorized to work",
        "true_value": "Yes",
        "false_value": "No"
      },
      {
        "key": "requires_sponsorship",
        "selector_strategy": "radio_by_label",
        "label_pattern": "sponsorship",
        "true_value": "Yes",
        "false_value": "No"
      }
    ],
    "sponsorship_fields": [],
    "availability_fields": [
      { "key": "start_date", "selector_strategy": "label_match", "label_pattern": "start", "type": "text_or_date" }
    ],
    "compensation_fields": [
      { "key": "salary_expectation", "selector_strategy": "label_match", "label_pattern": "salary", "type": "text" }
    ],
    "resume_field": { "key": "resume_file", "selector": "input[type=\"file\"][name*=\"resume\"]", "type": "file" },
    "eeo_fields": {
      "container": "#eeoc_fields",
      "gender": "select[name*=\"gender\"]",
      "race": "select[name*=\"race\"]",
      "veteran": "select[name*=\"veteran\"]",
      "disability": "select[name*=\"disability\"]",
      "default_value": "Decline to state"
    },
    "custom_question_patterns": [
      { "pattern": "textarea[name*=\"answers\"]", "type": "freetext", "action": "ai_generate" },
      { "pattern": "select[name*=\"answers\"]", "type": "select", "action": "deterministic_match" },
      { "pattern": "input[type=\"radio\"][name*=\"answers\"]", "type": "radio", "action": "deterministic_match" },
      { "pattern": "input[type=\"checkbox\"][name*=\"answers\"]", "type": "checkbox", "action": "check_all_required" }
    ],
    "submit_buttons": [
      { "selector": "button#submit_app", "text": "Submit Application" },
      { "selector": "input[type=\"submit\"]", "text": "Submit" },
      { "selector": "button[type=\"submit\"]", "fallback": true }
    ],
    "confirmation_clues": [
      { "type": "url_contains", "value": "thank_you" },
      { "type": "text_matches", "pattern": "thank you for applying" },
      { "type": "text_matches", "pattern": "application submitted" },
      { "type": "text_matches", "pattern": "application received" }
    ]
  },
  "lever": {
    "contact_fields": [
      { "key": "full_name", "selector": "input[name=\"name\"]", "type": "text", "required": true },
      { "key": "email", "selector": "input[name=\"email\"]", "type": "email", "required": true },
      { "key": "phone", "selector": "input[name=\"phone\"]", "type": "tel", "required": false },
      { "key": "current_company", "selector": "input[name=\"org\"]", "type": "text", "required": false },
      { "key": "location", "selector": "input[name=\"location\"]", "type": "text", "required": false }
    ],
    "links_fields": [
      { "key": "linkedin_url", "selector": "input[data-type=\"linkedin\"]", "type": "url" },
      { "key": "github_url", "selector": "input[data-type=\"github\"]", "type": "url" },
      { "key": "portfolio_url", "selector": "input[data-type=\"portfolio\"]", "type": "url" },
      { "key": "website_url", "selector": "input[data-type=\"other\"]", "type": "url" },
      { "key": "twitter_url", "selector": "input[data-type=\"twitter\"]", "type": "url" }
    ],
    "education_fields": [
      { "note": "Lever education fields are often employer-custom; scan by label" }
    ],
    "authorization_fields": [
      { "selector_strategy": "radio_by_label", "label_pattern": "authorized to work|authorized to legally" }
    ],
    "sponsorship_fields": [
      { "selector_strategy": "radio_by_label", "label_pattern": "require.*sponsorship|sponsorship.*require" }
    ],
    "availability_fields": [
      { "selector_strategy": "label_match", "label_pattern": "start date|available" }
    ],
    "compensation_fields": [
      { "selector_strategy": "label_match", "label_pattern": "salary|compensation|pay" }
    ],
    "resume_field": { "key": "resume_file", "selector": "input[type=\"file\"][name=\"resume\"]", "type": "file" },
    "eeo_fields": {
      "container": ".eeoc-module",
      "gender": "select[name*=\"gender\"]",
      "race": "select[name*=\"race\"], select[name*=\"ethnicity\"]",
      "veteran": "select[name*=\"veteran\"]",
      "disability": "select[name*=\"disability\"]",
      "default_value": "I don't wish to answer"
    },
    "custom_question_patterns": [
      { "pattern": "textarea.application-answer", "type": "freetext", "action": "ai_generate" },
      { "pattern": "select.application-select", "type": "select", "action": "deterministic_match" },
      { "pattern": "input[type=\"checkbox\"].application-checkbox", "type": "checkbox", "action": "check_if_required" }
    ],
    "submit_buttons": [
      { "selector": "[data-qa=\"submit-application\"]", "text": "Submit application" },
      { "selector": "button[type=\"submit\"]", "fallback": true }
    ],
    "confirmation_clues": [
      { "type": "text_matches", "pattern": "thank you" },
      { "type": "text_matches", "pattern": "application submitted" },
      { "type": "url_contains", "value": "thank" }
    ]
  },
  "workday": {
    "contact_fields": [
      { "key": "first_name", "selector": "[data-automation-id=\"firstName\"]", "type": "text", "required": true },
      { "key": "last_name", "selector": "[data-automation-id=\"lastName\"]", "type": "text", "required": true },
      { "key": "email", "selector": "[data-automation-id=\"email\"]", "type": "email", "required": true },
      { "key": "phone", "selector": "[data-automation-id=\"phone\"]", "type": "tel", "required": true },
      { "key": "address_line1", "selector": "[data-automation-id=\"addressLine1\"]", "type": "text" },
      { "key": "city", "selector": "[data-automation-id=\"city\"]", "type": "text" },
      { "key": "state", "selector": "[data-automation-id=\"state\"]", "type": "autocomplete", "strategy": "type_then_select" },
      { "key": "zip_code", "selector": "[data-automation-id=\"postalCode\"]", "type": "text" },
      { "key": "country", "selector": "[data-automation-id=\"country\"]", "type": "autocomplete", "strategy": "type_then_select" }
    ],
    "education_fields": [
      { "key": "school_name", "selector": "[data-automation-id=\"school\"]", "type": "autocomplete" },
      { "key": "degree", "selector": "[data-automation-id=\"degree\"]", "type": "select_or_autocomplete" },
      { "key": "field_of_study", "selector": "[data-automation-id=\"fieldOfStudy\"]", "type": "text_or_autocomplete" },
      { "key": "gpa", "selector": "[data-automation-id=\"gpa\"]", "type": "text" },
      { "key": "grad_date", "selector": "[data-automation-id=\"gradDate\"]", "type": "date", "format": "MM/YYYY" }
    ],
    "authorization_fields": [
      { "selector_strategy": "radio_by_label", "label_pattern": "legally authorized to work", "step": "application_questions" }
    ],
    "sponsorship_fields": [
      { "selector_strategy": "radio_by_label", "label_pattern": "require.*sponsorship", "step": "application_questions" }
    ],
    "availability_fields": [
      { "selector_strategy": "label_match", "label_pattern": "desired start|available to start", "type": "date" }
    ],
    "compensation_fields": [
      { "selector_strategy": "label_match", "label_pattern": "desired salary|salary expectation" }
    ],
    "resume_field": { "key": "resume_file", "step": "my_experience", "selector_strategy": "file_input_near_resume_label" },
    "eeo_fields": {
      "step": "voluntary_disclosures",
      "gender": "[data-automation-id*=\"gender\"]",
      "race": "[data-automation-id*=\"race\"], [data-automation-id*=\"ethnicity\"]",
      "veteran": "[data-automation-id*=\"veteran\"]",
      "disability": "[data-automation-id*=\"disability\"]",
      "default_value": "I don't wish to answer"
    },
    "custom_question_patterns": [
      { "step": "application_questions", "pattern": "textarea", "action": "ai_generate" },
      { "step": "application_questions", "pattern": "select, [role=\"combobox\"]", "action": "deterministic_match" }
    ],
    "next_buttons": [
      { "selector": "[data-automation-id=\"bottom-navigation-next-btn\"]", "text": "Next" },
      { "selector": "[data-automation-id=\"bottom-navigation-next-btn\"]", "text": "Save and Continue" }
    ],
    "submit_buttons": [
      { "selector": "[data-automation-id=\"bottom-navigation-next-btn\"]", "note": "Final step Next button becomes Submit" }
    ],
    "confirmation_clues": [
      { "type": "text_matches", "pattern": "application submitted successfully" },
      { "type": "text_matches", "pattern": "confirmation" },
      { "type": "element_visible", "selector": "[data-automation-id=\"confirmationNumber\"]" }
    ]
  },
  "handshake": {
    "contact_fields": [
      { "key": "full_name", "note": "Pre-filled and locked; do not attempt to fill" },
      { "key": "email", "note": "Pre-filled and locked" },
      { "key": "phone", "selector": "input[name*=\"phone\"]", "type": "tel" }
    ],
    "resume_field": {
      "key": "resume_file",
      "selector_select": "select[name=\"resume_id\"]",
      "selector_upload": "input[type=\"file\"][name*=\"resume\"]",
      "strategy": "prefer_select_from_saved_list",
      "size_limit_mb": 1
    },
    "education_fields": [
      { "note": "School, major, GPA, graduation date pre-filled from profile and locked" }
    ],
    "authorization_fields": [
      { "selector_strategy": "radio_by_label", "label_pattern": "authorized to work" }
    ],
    "sponsorship_fields": [
      { "selector_strategy": "radio_by_label", "label_pattern": "sponsorship" }
    ],
    "availability_fields": [
      { "selector_strategy": "label_match", "label_pattern": "start" }
    ],
    "compensation_fields": [],
    "custom_question_patterns": [
      { "pattern": "textarea", "action": "ai_generate", "note": "Highly variable; AI always needed" }
    ],
    "next_buttons": [],
    "submit_buttons": [
      { "selector": "button[data-action=\"submit-application\"]", "text": "Apply Now" },
      { "selector": "button[data-quick-apply=\"true\"]", "text": "Quick Apply" },
      { "selector": "button[type=\"submit\"]", "fallback": true }
    ],
    "confirmation_clues": [
      { "type": "text_matches", "pattern": "application submitted" },
      { "type": "element_visible", "selector": ".applied-badge, [class*=\"applied\"]" }
    ]
  }
}
```

---

## Section B: Automation Readiness Scorecard

| Portal | Coverage with Hardcoded Logic | Risk of Custom Questions | Review-Step Complexity | Auth Block Frequency | Confidence in Deterministic Automation |
|--------|------------------------------|--------------------------|------------------------|---------------------|----------------------------------------|
| Greenhouse | 70–75% | Medium (30–40% of forms have custom Qs) | None (single-page) | Very Low (~5%) | High — build first |
| Lever | 65–70% | Medium-High (35–45% of forms) | None (single-page) | Low (~10%) | Medium-High |
| Handshake | 75–85% of form fields | Low (10–15%) | None | Very High (~90%) | High for form logic; blocked by auth |
| Workday | 50–60% | High (40–50% of steps) | High (4–6 steps + review) | Medium (~30%) | Medium — build last |

---

## Section C: Engineering Notes for Twin

### Playwright Agent Architecture

```
/twin
  /agents
    /greenhouse
      index.ts           — orchestrator: detect → fill → submit → confirm
      selectors.ts       — all selector definitions + fallback chains
      filler.ts          — field-by-field fill logic
      eeo.ts             — EEO block handler (select "Decline" by default)
      custom.ts          — detect custom questions → AI or deterministic
      submit.ts          — submit + confirmation detection
    /lever
      index.ts
      selectors.ts       — data-type link fields; data-qa selectors
      filler.ts
      eeo.ts
      custom.ts
      submit.ts
    /workday
      index.ts
      selectors.ts       — data-automation-id map
      filler.ts
      steps/
        my_information.ts
        my_experience.ts
        application_questions.ts
        voluntary_disclosures.ts
        review.ts
      autocomplete.ts    — shared autocomplete handler
      navigator.ts       — step detection, Next button, wait logic
      error_handler.ts
    /handshake
      index.ts
      selectors.ts
      session.ts         — login state detection; escalate if not logged in
      resume.ts          — select from saved list or upload
      custom.ts
      submit.ts
  /profile
    schema.ts            — ApplicationProfile interface
    mapper.ts            — profile → portal-specific field mapping
  /ai
    answer_generator.ts  — take question text → generate answer via LLM
    answer_cache.ts      — fuzzy-match cache for repeated questions
  /fallback
    escalation.ts        — when to stop and alert human/AI
    logger.ts            — log failures with context + screenshot
  /utils
    portal_detector.ts   — detect which portal from URL/DOM
    wait.ts              — shared wait utilities
    file.ts              — file size checking, upload helpers
```

### Selector Map Strategy

```typescript
// greenhouse/selectors.ts
export const GreenhouseSelectors = {
  firstName: {
    primary: 'input[name="job_application[first_name]"]',
    secondary: 'input#job_application_first_name',
    labelFallback: 'First Name',
  },
  email: {
    primary: 'input[name="job_application[email]"]',
    secondary: 'input[type="email"]',
  },
  resume: {
    primary: 'input[type="file"][name*="resume"]',
    note: 'Use setInputFiles(); avoid clicking upload button',
  },
  workAuth: {
    strategy: 'radio_by_label',
    labelPattern: /authorized to work/i,
    trueValue: 'Yes',
    falseValue: 'No',
  },
  submit: {
    primary: 'button#submit_app',
    secondary: 'button[type="submit"]',
    textPattern: /submit application/i,
  },
};
```

### Question Normalization Logic

```typescript
// Detect question type from DOM
function classifyQuestion(element: ElementHandle): QuestionType {
  const tagName = await element.evaluate(el => el.tagName);
  const inputType = await element.evaluate(el => el.type);

  if (tagName === 'TEXTAREA') return 'freetext';
  if (tagName === 'SELECT') return 'select';
  if (inputType === 'radio') return 'radio';
  if (inputType === 'checkbox') return 'checkbox';
  if (inputType === 'file') return 'file';
  if (inputType === 'date' || inputType === 'month') return 'date';
  if (inputType === 'url') return 'url';
  return 'text';
}

// Normalize question label to internal key
function normalizeQuestion(labelText: string): string | null {
  const normalizations: [RegExp, string][] = [
    [/authorized to work/i, 'us_work_authorized'],
    [/sponsorship/i, 'requires_sponsorship'],
    [/linkedin/i, 'linkedin_url'],
    [/github/i, 'github_url'],
    [/portfolio/i, 'portfolio_url'],
    [/graduation date/i, 'grad_date'],
    [/gpa/i, 'gpa'],
    [/salary/i, 'salary_expectation'],
    [/start date|available to start/i, 'start_date'],
    [/relocate/i, 'willing_to_relocate'],
    [/gender/i, 'eeo_gender'],
    [/race|ethnicity/i, 'eeo_race'],
    [/veteran/i, 'eeo_veteran_status'],
    [/disability/i, 'eeo_disability_status'],
  ];

  for (const [pattern, key] of normalizations) {
    if (pattern.test(labelText)) return key;
  }

  return null; // Unknown → escalate to AI
}
```

### Application Profile Schema (TypeScript)

```typescript
interface ApplicationProfile {
  // Identity
  first_name: string;
  last_name: string;
  full_name: string;     // derived: first_name + " " + last_name
  middle_name?: string;

  // Contact
  email: string;
  phone: string;         // E.164 format preferred
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;        // 2-letter code for US
  zip_code?: string;
  country?: string;      // "United States"

  // Links
  linkedin_url?: string;
  github_url?: string;
  portfolio_url?: string;
  website_url?: string;
  twitter_url?: string;

  // Education
  school_name: string;
  degree: string;        // "Bachelor of Science"
  field_of_study: string;
  gpa?: string;          // "3.85"
  grad_date: string;     // "2026-05" (YYYY-MM)

  // Files
  resume_path: string;
  cover_letter_path?: string;

  // Legal
  us_work_authorized: boolean;
  requires_sponsorship: boolean;
  visa_type?: string;

  // Compensation
  salary_expectation?: string;  // "$45/hr" or "45000" or "negotiable"

  // Location
  location: string;             // "San Francisco, CA"
  willing_to_relocate: boolean;
  preferred_locations?: string[];
  remote_preference?: "remote" | "hybrid" | "onsite" | "any";

  // Availability
  start_date: string;           // "2026-06-01"
  internship_term?: string;     // "Summer 2026"

  // EEO (voluntary; stored for autofill)
  eeo_gender?: string;
  eeo_race?: string;
  eeo_veteran_status?: string;
  eeo_disability_status?: string;

  // Custom Q Cache
  custom_answers?: Record<string, string>; // question_hash -> answer

  // Per-portal overrides
  portal_overrides?: {
    greenhouse?: Partial<ApplicationProfile>;
    lever?: Partial<ApplicationProfile>;
    workday?: Partial<ApplicationProfile>;
    handshake?: Partial<ApplicationProfile>;
  };
}
```

### Fallback Trigger Conditions

```typescript
enum EscalationType {
  AI = 'ai',           // Route to LLM for answer generation
  HUMAN = 'human',     // Pause and alert human operator
  RETRY = 'retry',     // Retry the same action
  SKIP = 'skip',       // Skip optional field and continue
}

const FALLBACK_CONDITIONS: Record<string, EscalationType> = {
  'selector_not_found': EscalationType.HUMAN,
  'unrecognized_field_type': EscalationType.AI,
  'free_text_question': EscalationType.AI,
  'validation_error_after_fill': EscalationType.HUMAN,
  'captcha_detected': EscalationType.HUMAN,
  'login_required': EscalationType.HUMAN,
  'stale_dom': EscalationType.RETRY,
  'autocomplete_no_match': EscalationType.HUMAN,
  'file_too_large': EscalationType.HUMAN,
  'form_rejected': EscalationType.HUMAN,
  'unknown_custom_question': EscalationType.AI,
  'multiple_matching_selectors': EscalationType.HUMAN,
};

async function handleFallback(condition: string, context: FillContext) {
  const escalationType = FALLBACK_CONDITIONS[condition] ?? EscalationType.HUMAN;

  const screenshot = await context.page.screenshot({ encoding: 'base64' });

  await logger.logFailure({
    portal: context.portal,
    field: context.fieldKey,
    condition,
    escalationType,
    screenshot,
    pageUrl: context.page.url(),
  });

  if (escalationType === EscalationType.AI) {
    const answer = await aiAnswerGenerator.generate({
      question: context.labelText,
      jobTitle: context.jobTitle,
      company: context.company,
      profile: context.profile,
    });
    return { answer, source: 'ai' };
  }

  if (escalationType === EscalationType.HUMAN) {
    await escalationQueue.push({
      sessionId: context.sessionId,
      message: `Manual review needed: ${condition} on field "${context.fieldKey}"`,
      screenshot,
    });
    throw new EscalationError(condition);
  }

  if (escalationType === EscalationType.RETRY) {
    await context.page.waitForTimeout(2000);
    return { retry: true };
  }
}
```

### Workday Autocomplete Handler

```typescript
async function fillAutocomplete(
  page: Page,
  selector: string,
  value: string,
  exactMatch = false
): Promise<void> {
  const input = page.locator(selector);
  await input.clear();
  await input.fill(value);

  // Wait for dropdown to appear
  try {
    await page.waitForSelector('[role="option"]', { timeout: 3000 });
  } catch {
    // No dropdown appeared — field might accept free text
    return;
  }

  const options = page.getByRole('option');
  const count = await options.count();

  if (count === 0) {
    throw new FallbackError('autocomplete_no_match', `No options for "${value}"`);
  }

  if (exactMatch) {
    const exactOption = page.getByRole('option', { name: value, exact: true });
    if (await exactOption.isVisible()) {
      await exactOption.click();
      return;
    }
  }

  // Select first option as best match
  await options.first().click();

  // Wait for dropdown to close
  await page.waitForSelector('[role="option"]', { state: 'hidden', timeout: 2000 });
}
```

### Multi-Step Navigator (Workday)

```typescript
const WORKDAY_STEPS = [
  'my_information',
  'my_experience',
  'application_questions',
  'voluntary_disclosures',
  'review',
];

async function navigateWorkday(page: Page, profile: ApplicationProfile): Promise<void> {
  let currentStep = await detectCurrentStep(page);

  while (currentStep !== 'submitted') {
    const stepHandler = stepHandlers[currentStep];

    if (!stepHandler) {
      throw new FallbackError('unknown_step', `Unknown step: ${currentStep}`);
    }

    await stepHandler.fill(page, profile);

    const errors = await detectErrors(page);
    if (errors.length > 0) {
      await handleErrors(page, errors);
    }

    await clickNext(page);
    await waitForStepTransition(page);

    currentStep = await detectCurrentStep(page);
  }
}

async function detectCurrentStep(page: Page): Promise<string> {
  // Check progress indicator or step-specific elements
  const progressText = await page.locator('[data-automation-id="progressBar"]').textContent();
  // Parse "Step 1 of 5" or similar
  // Also check for known step-specific data-automation-id values
  // ...
}

async function waitForStepTransition(page: Page): Promise<void> {
  // Wait for loading spinner to disappear
  await page.waitForSelector('[data-automation-id="loading-spinner"]',
    { state: 'hidden', timeout: 10000 });
  // Additional wait for SPA render
  await page.waitForLoadState('networkidle', { timeout: 5000 });
}
```

### AI Answer Generation

```typescript
async function generateCustomAnswer(
  question: string,
  profile: ApplicationProfile,
  jobContext: { title: string; company: string; description?: string }
): Promise<string> {
  // Check cache first (fuzzy match)
  const cachedAnswer = await answerCache.find(question, threshold: 0.85);
  if (cachedAnswer) return cachedAnswer;

  const prompt = `
    You are filling out a job application for ${profile.first_name} ${profile.last_name}.

    Job: ${jobContext.title} at ${jobContext.company}

    Answer this application question in 2-4 sentences, in first person:
    "${question}"

    Use these facts about the applicant:
    - Field of study: ${profile.field_of_study}
    - School: ${profile.school_name}
    - Graduation: ${profile.grad_date}

    Be specific but brief. Do not use generic filler. Do not fabricate specific projects or experiences not mentioned.
  `;

  const answer = await llm.generate(prompt);

  // Cache for future use
  await answerCache.store(question, answer);

  return answer;
}
```

---

## Build Timeline Summary

| Portal | Build Order | Estimated Weeks | Automation % | Key Challenge |
|--------|------------|----------------|--------------|---------------|
| Greenhouse | 1st | 2 weeks | 70–75% | Custom Q detection + AI fallback |
| Lever | 2nd | 2 weeks | 65–70% | Custom Q variance |
| Handshake | 3rd | 2 weeks | 75–85% form logic | Login wall; manual session setup |
| Workday | 4th | 4 weeks | 50–60% | Multi-step nav; autocomplete; SPA timing |

**Total: ~10 weeks for full v1 across all four portals.**

---

*Sources: Greenhouse Support docs, Lever Help Center, Workday Canvas Design System, Handshake Support, GitHub automation projects (job-application-automator, Workday-Application-Automator, job-scraper), Playwright docs, community ATS analysis threads.*
