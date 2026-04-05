# Job matching standardization plan

**Purpose:** Single source of truth for how jobs are ingested and stored today, how user preferences are stored and matched, known gaps, and the **target model**: internal geographic taxonomy, **orthogonal work modality** (remote / hybrid / onsite), **multi-location OR matching**, **positive-only** regional preferences, and a **stratified career-level taxonomy** (internships, seasonal, new grad, experience bands).

**Audience:** Engineering and product (ingest, profiles, matching, onboarding, scraper).

---

## 1. Executive summary

**Today:** Jobs land in `public.jobs` as mostly **flat** columns plus `metadata`. User fit uses **flat arrays** and **substring** location checks. Two ingest paths (Next.js API vs Python scraper) can diverge. SQL RPCs pre-filter candidates and must stay aligned with `matchJobToProfile`.

**Target:** Represent fit dimensions with **internal taxonomies**—especially a **wide geographic tree** (country → region → state, plus roughly **50 major cities**) and a **career / role-type tree** that separates internships (including **seasonal**), full-time, new grad, and **experience-heavy** roles. **Geographic preferences are allow-lists only:** users select what they are open to; **not selecting a region means they are not open to it** (e.g. selecting Central, South, and East Coast only implies West Coast is out—no separate “deny subtree” product construct). **Multi-location jobs** match if **any** listed site resolves to a node the user allowed. **Remote and hybrid** are **separate from geography** (not children of the geo tree).

This document: (a) describes the **current** pipeline and matcher, (b) lists **gaps**, (c) states **locked product decisions**, (d) specifies the **target taxonomies and matching rules**, (e) outlines **UX** and **phased delivery**.

---

## 2. Locked product decisions

These drive schema and algorithms; implementation should not contradict them.

| Topic | Decision |
|--------|-----------|
| **Multi-location jobs** | **OR semantics:** the job matches a user’s geographic preferences if **any** listed workplace resolves to a geo node that intersects the user’s **allowed** geo set. |
| **Remote / hybrid / onsite** | **Orthogonal work-modality dimension**, not nodes under the geographic tree. A job can be tagged with modality (and optionally geography for hybrid/onsite). Matching combines: geo rules **and** modality rules per product spec (e.g. user “remote OK” + job “remote” → pass modality regardless of geo). |
| **Geographic preferences** | **Positive selection only** (allow-list). Users pick regions (and optionally states/cities) they want. **Omission = not open.** Example: selecting **Central, South, and East Coast** only means **West Coast** is not selected and therefore **not** in the allow set—no separate deny-subtree UX. |
| **Deny subtrees** | **Not required** for geography given the allow-list model. (Company/industry exclusions may remain separate—see §5.5 and Phase 3.) |
| **Geo taxonomy** | **Minimal internal schema, maximal coverage at upper levels:** **countries**, **regions** (e.g. US census-style: Northeast, Midwest, South, West, plus territories as needed), **all states/provinces** in scope; **~50 major cities** as explicit nodes; **not** every small municipality in v1. |
| **Career / role taxonomy** | **Separate stratified tree** from geography: distinguish **internships** (with **seasonal** / term semantics where relevant), **full-time** early-career, **new grad** programs, and roles that **require meaningful prior experience** (levels TBD in §6.4). Aligns with and eventually subsumes today’s `level`, `role_family`, `experience_band`, and recruiting window fields. |

---

## 3. Backend job pipeline (current state)

### 3.1 Two write paths

| Path | Mechanism | Auth | Dedupe |
|------|-----------|------|--------|
| **A. Next.js API** | `POST /api/jobs/ingest` | Worker secret | `canonical_url` |
| **B. Python scraper** | `scraper/ingest_jobs.py` → Supabase service role | Service role key | `canonical_url` |

Path **A** uses Zod + TS normalizers (`lib/job-ingest.ts`). Path **B** duplicates similar logic in `_make_row`—**drift risk**.

### 3.2 Path A — `lib/job-ingest.ts`

1. **`jobIngestPayloadSchema`** validates payload; **`parseJobIngestPayload`** fills missing **`level`** via **`inferJobLevel`** (`lib/job-normalization.ts`).
2. **`mapJobIngestPayloadToInsert`:** `canonicalizeJobUrl`, **`resolvePortal`**, **`inferQualificationTags`**, **`normalizeJobIndustries`**, **`sanitizeJdSummary`**, **`metadata`** (source, tags, salary, etc.).
3. **`upsertJobFromIngestPayload`:** lookup by `canonical_url`, update rules, then candidate profiles + `matchJobToProfile`.

### 3.3 Path B — `scraper/ingest_jobs.py`

**`_make_row`:** `canonicalize_url`, **`infer_level`**, inline **role_family** / **target_term** / **target_year**, **`experience_band`**, industries passthrough (often **empty**—no TS `normalizeJobIndustries`), **`status: "active"`** (vs API **`pending`**).

### 3.4 Stored job shape (matching-relevant today)

From **`Database["public"]["Tables"]["jobs"]`** (`lib/supabase/database.types.ts`):

| Column | Role |
|--------|------|
| `industries` | `text[]` vs `profiles.industries` |
| `level`, `role_family`, `experience_band`, `target_term`, `target_year` | Role + window |
| `location` | **Single string** (multi-site not modeled) |
| `remote` | Boolean only—**no hybrid** |
| `canonical_*`, `url`, `application_url` | Dedupe, portal |
| `metadata` | Opaque to matcher |

Migrations (e.g. `20260402120000_job_routing_and_targeting.sql`) backfill canonical and targeting fields from legacy data.

---

## 4. User preferences (current state)

### 4.1 `public.profiles`

| Column | Use today |
|--------|-----------|
| `industries`, `levels`, `target_role_families`, `target_terms`, `target_years`, `graduation_year` | Flat arrays / scalars vs job fields |
| `locations` | Free-text list; **substring** vs **one** `jobs.location` |
| `remote_ok` | Remote branch only |
| `gray_areas` | Company/industry **substring** exclusions |
| `city`, `state_region`, `country` | Applicant address—**not** used for job-location fit |

### 4.2 `PersistedProfile` / onboarding

Multi-select and free text; no guided geo tree or career tree yet.

---

## 5. Matching today (`lib/matching.ts` + RPCs)

- **Score ≥ 50** and **no rejections** → `matched`.
- **Weights:** Industry 40, Role family 20, Recruiting window 10, Location 20, Gray-area pass 10.
- **Location:** One string vs many substrings; remote shortcuts.
- **RPCs** (`select_candidate_profiles_for_job`, `select_candidate_jobs_for_profile` in `20260402120000_job_routing_and_targeting.sql`): approximate same predicates; **LIKE**-based location.

Ingest uses RPC → then TS matcher per profile.

---

## 6. Gaps (current vs target)

### 6.1 Dual ingest

Python vs TS differ on industries, `target_term` shape, `experience_band`, `status`. Same logical job can match differently.

### 6.2 `target_term` vocabulary

TS **`parseTerm`** can emit values **`normalizeTargetTerm`** does not recognize → matcher sees `null`; RPC string equality can disagree. **Fix in Phase 0** before taxonomies.

### 6.3 Location and multi-site

- One `location` string; **no** structured multi-location array.
- **Cannot** implement “match if **any** site fits” until jobs store **multiple resolved geo nodes** (or multiple raw strings with resolver).

### 6.4 Remote / hybrid

Only **`remote` boolean**; **hybrid** and explicit **onsite** missing as first-class modality for matching.

### 6.5 Geographic preferences

Substring lists ≠ **country / region / state** truth; no allow-list of taxonomy node IDs.

### 6.6 Career stratification

`level` + `role_family` + `experience_band` are **flat** and **split** across columns; **seasonal internship** vs **full-time new grad** vs **experienced hire** is not a single navigable tree for users or a unified resolver output for jobs.

### 6.7 `gray_areas`

Substring exclusions remain **ambiguous**; future work may keep them for company names or fold industry blocks into taxonomy **deny** lists—**out of scope** for geo allow-list (§2).

### 6.8 RPC / TS drift

Any matcher change must update RPCs or widen RPC and tighten TS.

---

## 7. Target model: three composable dimensions

Matching is the conjunction of policies across dimensions (exact boolean rules to be specified in implementation). At minimum:

1. **Geography (taxonomy nodes, allow-list)**  
2. **Work modality (remote / hybrid / onsite)** — orthogonal  
3. **Career / role type (taxonomy nodes)** — orthogonal to geo  

Plus existing **industry** overlap (flat or future industry tree), **recruiting window** (calendar tree recommended), and **gray_areas** / exclusions as needed.

### 7.1 Geography — internal tree (extensive upper levels)

**Structure (conceptual):**

- **Root:** per country of operation (start with countries Twin actually serves; design for multi-country).
- **Below country:** **regions** (for US: Northeast, Midwest, South, West, Pacific, Mountain, etc.—align to a single internal standard document).
- **Below region:** **states / provinces / territories** (full enumeration for in-scope countries).
- **Cities:** **~50 major metros** as explicit nodes (e.g. NYC, SF Bay Area, Chicago, …—maintain curated list in repo or seed table). **Smaller cities** deferred: resolver maps to **state** or **metro area** when possible until expanded.

**Job side:**

- **`job_geo_node_ids uuid[]`** (or junction table): one job can have **N** nodes (multi-location posting → **N** entries). Resolver pipeline: raw location string(s) → one or more node IDs (with confidence).

**Profile side:**

- **`profile_geo_allow_node_ids uuid[]`** (or normalized rows): user-selected **allowed** nodes. Semantics: job geo matches if  
  **`job_geo_node_ids && expanded(profile_geo_allow_node_ids)`** is non-empty,  
  where **expanded(allow)** includes **all descendants** of selected nodes (selecting “South” implies all states/cities under South without listing each).  
- **No West Coast selected** → West Coast nodes not in allow → **no match** for SF-only job (unless **modality** allows fully remote and user accepts remote—§7.2).

**Multi-location OR:** If job has `{NYC, SF}` and user allows `{Northeast …}` only, **NYC** hits → **match** on geo (subject to modality).

### 7.2 Work modality — separate from geo

**Suggested enum per job (and mirrored in preferences):** e.g. `remote` | `hybrid` | `onsite` (names TBD).

- **Remote:** geography may be “any” or “company hub only” for legal copy—**matching rule:** user flag `open_to_remote` (or equivalent) gates these jobs regardless of geo, per product rules.
- **Hybrid / onsite:** **geo tree applies** to physical site(s); user must allow that location **and** accept hybrid/onsite if they filter by modality.

Stored **separately** from `job_geo_node_ids` so we never model “hybrid” as a child of “California.”

### 7.3 Career / role stratification tree

**Goal:** One conceptual tree (stored as **`taxonomy_node`** with `dimension = 'career_role'` or separate table) so onboarding can **drill down** and jobs resolve to **one primary node** (or a small set) for matching.

**Illustrative branches (to be finalized in seed data):**

| Branch | Intent |
|--------|--------|
| **Student / early pipeline** | **Internship** → optional **seasonal** leaves (spring / summer / fall / winter) + **year**; **co-op**; **part-time** while enrolled |
| **New graduate** | Full-time roles explicitly targeting new grads (programs, “early career” with 0–1 YOE) |
| **Full-time (non-intern)** | Sibling to intern track where job is **not** term-limited student role |
| **Experience-required** | Stratify **early professional** vs **mid** vs **senior** (or similar) for roles that assume **substantial prior experience**—distinct from intern/new-grad leaves |

**Mapping from current fields:**

- Today’s **`level`**, **`role_family`**, **`experience_band`**, **`target_term`**, **`target_year`**, **`is_early_career`** become **inputs to a resolver** that assigns **`job_career_node_id`** (and optional secondary tags).
- **`profiles`:** **`profile_career_allow_node_ids`** (allow-list, same expansion semantics as geo: selecting a parent selects all descendants unless we introduce explicit “this node only” flags later).

**Recruiting calendar:** Prefer a **small shared tree** or normalized `(season, year)` tied to career leaves for internships, fixing **`target_term`** string drift (§6.2).

### 7.4 Composition rule (reference)

- **Geo match:** OR over job sites vs expanded profile geo allow (§7.1).  
- **Modality match:** User filters vs job modality (§7.2).  
- **Career match:** Job’s resolved career node ∈ expanded profile career allow (§7.3).  
- **Industry / window / exclusions:** Existing or upgraded rules in parallel.

---

## 8. Profile UX (cohesive with §2 and §7)

1. **Geography:** User picks **countries → regions → states**; optional drill to **major cities** from curated list. **Only selected nodes count as allowed.** Clear copy: “We’ll only show jobs in areas you select.”
2. **Work setup:** Separate step or section: **Remote**, **Hybrid**, **Onsite** (checkboxes or cards)—independent of map/region UI.
3. **Role type:** Progressive drill—**internship (season?)** vs **new grad** vs **full-time experienced**, etc.—mirroring **§7.3** tree.
4. **Jobs list / cards:** Show badges from resolved taxonomy paths (e.g. `USA › South › Texas`, `Internship › Summer 2026`, `Hybrid`).

**Migration from today:** Map `locations[]` strings to **best-effort** node IDs; prompt user to **confirm** ambiguous parses (e.g. “Springfield”).

---

## 9. Implementation-ready attribute spec

This section defines the implementation contract for normalized matching and application autofill. It covers:

- the **user-facing term** the product should use in onboarding/profile/browse UX
- the **internal object attribute / variable name**
- the **taxonomy dimension**
- whether the dimension is used for **browse filtering**, **application completion**, or both
- whether jobs and profiles may map to **multiple nodes**
- the required **fallback / confidence** behavior

### 9.1 Canonical model shape

Use one generic taxonomy system with dimension-specific trees.

**Core taxonomy objects**

| Object | Purpose |
|--------|---------|
| `taxonomy_nodes` | Canonical n-ary tree node record for every dimension (`geo`, `industry`, `job_function`, etc.) |
| `taxonomy_aliases` | Synonyms, alternate spellings, abbreviations, recruiter wording, and scraped label variants that should resolve to a canonical node |
| `taxonomy_edges` or `parent_node_id` | Parent/child relationship for tree traversal |
| `taxonomy_paths` or materialized ancestry columns | Fast ancestor/descendant expansion for branch-level matching |

**Suggested shared node fields**

| Field | Purpose |
|------|---------|
| `id` | Canonical node id |
| `dimension` | Which tree this node belongs to |
| `slug` | Stable internal identifier |
| `label` | Human-readable canonical label |
| `parent_node_id` | Tree structure |
| `depth` | Branch depth |
| `is_leaf` | Fast leaf-vs-branch checks |
| `status` | `active`, `draft`, `deprecated` |
| `metadata` | Optional dimension-specific metadata |

**Suggested shared mapping object shape**

Jobs and profiles should resolve source text and structured values into a reusable mapping envelope:

| Field | Purpose |
|------|---------|
| `dimension` | Taxonomy dimension |
| `node_id` | Best resolved node |
| `path_node_ids` | Full branch-path address from root to resolved node |
| `confidence` | Numeric or enum confidence |
| `resolution_kind` | `exact_alias`, `exact_slug`, `semantic_match`, `parent_fallback`, `manual_override` |
| `source_value` | Original string or object fragment |
| `source_field` | Input field name (`job.title`, `profile.major`, etc.) |
| `is_primary` | Primary vs secondary mapping |
| `needs_review` | Flag for admin/operator review |

**Matching posture**

- Every important attribute should resolve to a **leaf node when possible**.
- If leaf resolution is not high confidence, preserve the **best parent-level path** and mark the mapping as lower confidence.
- Matching should use **branch pruning** first, then score by **leaf exactness** and **tree distance**.
- Browse can show **`possible_match`** for low-confidence or branch-only overlap.
- Apply execution should prefer **high-confidence structured profile facts**, but may still use parent/secondary mappings to guide field selection or prompt surfacing.

### 9.2 Dimension summary

| User-facing term | Internal attribute(s) | Taxonomy dimension | Job multi-node? | Profile multi-node? | Browse filter | Apply completion |
|------------------|-----------------------|--------------------|-----------------|---------------------|---------------|------------------|
| Location | `job_geo_node_ids`, `profile_geo_allow_node_ids`, `profile_geo_fact_node_ids` | `geo` | Yes | Yes | Yes | Yes |
| Work setup | `job_work_modality`, `profile_work_modality_allow` | `work_modality` | Usually no | Yes | Yes | Yes |
| Industry | `job_industry_node_ids`, `profile_industry_allow_node_ids` | `industry` | Yes | Yes | Yes | Yes |
| Job function | `job_function_node_ids`, `profile_job_function_allow_node_ids` | `job_function` | Yes | Yes | Yes | Yes |
| Role type / career stage | `job_career_node_ids`, `profile_career_allow_node_ids` | `career_role` | Yes | Yes | Yes | Yes |
| Degree type | `job_degree_requirement_node_ids`, `profile_degree_node_ids` | `education_degree` | Yes | Yes | Yes | Yes |
| Major / field of study | `job_education_field_node_ids`, `profile_education_field_node_ids` | `education_field` | Yes | Yes | Yes | Yes |
| Work authorization | `job_work_auth_node_ids`, `profile_work_auth_node_ids` | `work_authorization` | Yes | Yes | Yes | Yes |
| Employment type | `job_employment_type_node_ids`, `profile_employment_type_allow_node_ids` | `employment_type` | Yes | Yes | Yes | Yes |

### 9.3 Profile data model: two internal layers, one user flow

The product should collect profile information in one logical onboarding/profile flow, but store it internally in **two layers**:

| Internal layer | Purpose | Example attributes |
|---------------|---------|--------------------|
| `profile_match_preferences` | What jobs the user wants to see and be considered for | preferred geographies, industries, job functions, career tracks, work setups, employment types |
| `profile_application_facts` | Canonical facts and disclosure rules used to answer ATS questions | legal name, address, degree history, majors, GPA, work authorization, sponsorship, graduation dates, start date, salary preference, disclosure settings |

**Important product rule**

- The UI should **not** expose these as separate concepts to the user.
- Questions should be grouped by natural user intent: e.g. “Where do you want to work?”, “What are you studying?”, “Work authorization”, “Application preferences”.
- A single answer may populate both internal layers. Example: “Open to New York and Texas” feeds matching; “Current address in Illinois” feeds application facts.

### 9.4 Dimension spec: Geography

**User-facing terms**

- `Location`
- `Where do you want to work?`
- `Current address`
- `Open to relocate`

**Internal attributes**

- Job:
  - `job_locations_raw`
  - `job_geo_node_ids`
  - `job_geo_mappings`
- Profile matching:
  - `profile_geo_allow_node_ids`
  - `profile_geo_allow_mappings`
- Profile application facts:
  - `profile_geo_fact_node_ids`
  - `profile_current_address`
  - `profile_relocation_preferences`

**Dimension**

- `geo`

**Tree shape**

```text
geo
  country
    region
      state_or_province
        major_metro
          city_or_submetro (optional later)
```

**Example nodes**

- `geo.usa.northeast.new_york.new_york_city`
- `geo.usa.west.california.san_francisco_bay_area`
- `geo.canada.ontario.toronto`

**Job-side source fields**

- `jobs.location`
- future `jobs.locations_text[]`
- job description text
- ATS metadata indicating remote eligibility or office hubs

**Profile-side source fields**

- current free-text `locations[]`
- `city`, `state_region`, `country`
- future explicit location selections in onboarding

**Matching rules**

- Expand selected profile geo nodes to descendants.
- A geo match passes when **any** `job_geo_node_ids` overlaps the expanded profile allow-set.
- If a job only resolves at parent level, allow branch-level overlap with lower score.
- If a job is fully remote, geo may be bypassed only according to remote geography policy and modality rules.

**Apply-completion rules**

- Use canonical address facts for address inputs.
- Use relocation preferences to answer relocation willingness questions.
- Preserve exact structured location history where forms ask for city/state/country separately.

**Fallback**

- If exact city resolution fails, store state/province or region-level node.
- Mark branch-only matches as eligible for `possible_match`.

### 9.5 Dimension spec: Work modality

**User-facing terms**

- `Work setup`
- `Remote`
- `Hybrid`
- `Onsite`

**Internal attributes**

- Job:
  - `job_work_modality`
  - `job_work_modality_confidence`
- Profile matching:
  - `profile_work_modality_allow`
- Profile application facts:
  - `profile_remote_preference_note`
  - `profile_onsite_preference_note`

**Dimension**

- `work_modality`

**Canonical values**

- `remote`
- `hybrid`
- `onsite`

**Job-side source fields**

- existing `jobs.remote`
- scraped title/location wording
- job description text
- ATS labels such as “remote eligible”, “hybrid”, “in office”

**Profile-side source fields**

- existing `remote_ok`
- future multi-select work setup preferences

**Matching rules**

- Treat modality as orthogonal to geography.
- Remote jobs may still carry geo nodes for eligibility restrictions.
- Hybrid and onsite jobs require both modality acceptance and geo compatibility.

**Apply-completion rules**

- Use preference notes when forms ask about work setup or commuting willingness.
- Do not infer relocation acceptance solely from remote preference.

### 9.6 Dimension spec: Industry

**User-facing terms**

- `Industry`
- `Industries you want`
- `Industries to avoid` (future exclusion layer)

**Internal attributes**

- Job:
  - `job_industry_node_ids`
  - `job_industry_mappings`
- Profile matching:
  - `profile_industry_allow_node_ids`
  - `profile_industry_allow_mappings`
- Profile application facts:
  - usually none required for ATS autofill, but may inform answer selection and screening interpretation

**Dimension**

- `industry`

**Tree shape**

```text
industry
  technology
    enterprise_software
    devtools
    cybersecurity
    ai_ml
    data_infrastructure
  finance
    investment_banking
    asset_management
    hedge_fund
    private_equity
    fintech
  consulting
    management_consulting
    strategy_consulting
    operations_consulting
  healthcare_biotech
    biotech
    medical_devices
    healthcare_services
  research
    academic_research
    applied_research
    national_lab
```

**Important design rule**

- Industry must be broad enough to cover finance, consulting, strategy, data, AI/ML, software, biotech, research, and adjacent sectors already present in scraped jobs.
- Jobs may map to **multiple industry nodes** where the company or role genuinely spans sectors.

**Job-side source fields**

- existing `industries`
- company description
- job title
- job description
- scraper source/category defaults

**Profile-side source fields**

- current `industries`
- future guided onboarding choices

**Matching rules**

- Use branch matching to avoid brute-force leaf comparison.
- Exact leaf overlap scores strongest.
- Shared parent branch with different leaves should still score as related.
- Branch-only overlap may produce `possible_match`.

**Apply-completion rules**

- Industry is not usually a direct form answer, but it helps classify ambiguous questions and tune answer selection.
- It should also support later company/industry exclusion logic.

### 9.7 Dimension spec: Job function

**User-facing terms**

- `Role focus`
- `What kinds of roles do you want?`
- `Job function`

**Internal attributes**

- Job:
  - `job_function_node_ids`
  - `job_function_mappings`
- Profile matching:
  - `profile_job_function_allow_node_ids`
  - `profile_job_function_allow_mappings`
- Profile application facts:
  - may influence resume/project selection later

**Dimension**

- `job_function`

**Tree shape**

```text
job_function
  engineering
    software_engineering
      backend
      frontend
      full_stack
      mobile
      infra_platform
      ml_engineering
    hardware_engineering
    qa_test
  data
    data_science
    data_analytics
    data_engineering
    quantitative_research
  product
    product_management
    technical_product_management
    product_operations
  business
    strategy
    operations
    business_analyst
    sales
    customer_success
  research
    research_science
    applied_science
    lab_research
```

**Important design rule**

- Industry and job function are separate dimensions and may both have multiple nodes.
- Example: a quant job can map to `industry.finance.hedge_fund` and `job_function.data.quantitative_research`.

**Job-side source fields**

- title
- team
- description
- department

**Profile-side source fields**

- current `target_role_families`
- future detailed role-interest picks
- resume/project signals if later needed

**Matching rules**

- Support multiple job function nodes per job.
- Use path overlap and tree distance for ranking.
- Low-confidence function mappings should not hard reject; they should lower confidence and may route to `possible_match`.

**Apply-completion rules**

- Function mapping can guide portfolio/resume variant selection later.
- It can also help interpret freeform questions like “What area are you most interested in?”

### 9.8 Dimension spec: Career role

**User-facing terms**

- `Role type`
- `Career stage`
- `Internship / New Grad / Experienced`

**Internal attributes**

- Job:
  - `job_career_node_ids`
  - `job_career_mappings`
- Profile matching:
  - `profile_career_allow_node_ids`
  - `profile_career_allow_mappings`
- Profile application facts:
  - `profile_graduation_dates`
  - `profile_current_student_status`

**Dimension**

- `career_role`

**Tree shape**

```text
career_role
  student
    internship
      spring
      summer
      fall
      winter
    co_op
    part_time_student
  early_career
    new_grad
    associate
    apprenticeship
  experienced
    entry_level
    mid_level
    senior
```

**Clarification**

- This tree answers **what recruiting track or career stage the role belongs to**.
- It is not the same as industry or job function.
- Jobs may map to multiple career nodes if postings are intentionally broad, e.g. `new_grad` plus `entry_level`.

**Job-side source fields**

- `level`
- `role_family`
- `experience_band`
- `target_term`
- `target_year`
- title/description text

**Profile-side source fields**

- current `levels`, `target_role_families`, `target_terms`, `target_years`, `graduation_year`
- future explicit career-interest selections

**Matching rules**

- Match by expanded allow-set over career nodes.
- Seasonal internship leaves should be used when available.
- Parent-only overlap should remain matchable but weaker.

**Apply-completion rules**

- Career-role mappings help interpret graduation timing, student status, and internship eligibility questions.
- They should also influence whether the apply engine expects term/year-specific prompts.

### 9.9 Dimension spec: Education degree

**User-facing terms**

- `Degree type`
- `What degree are you pursuing or have completed?`

**Internal attributes**

- Job:
  - `job_degree_requirement_node_ids`
  - `job_degree_requirement_mappings`
- Profile application facts:
  - `profile_degree_node_ids`
  - `profile_education_records[].degree_node_id`
- Profile matching:
  - optional `profile_degree_interest_node_ids` if needed later

**Dimension**

- `education_degree`

**Tree shape**

```text
education_degree
  undergraduate
    associates
    bachelors
      ba
      bs
      beng
  graduate
    masters
      ms
      mba
      meng
    doctorate
      phd
      md
      jd
```

**Job-side source fields**

- degree requirements in description
- ATS screening prompts

**Profile-side source fields**

- education history
- current degree pursuit

**Matching rules**

- Degree requirements should not over-filter unless the requirement is explicit.
- Missing or low-confidence degree requirements should not hard reject by default.

**Apply-completion rules**

- Degree nodes must support accurate education history filling across multiple degrees.
- Preserve per-record school, degree, majors, minors, GPA, start date, and end date.

### 9.10 Dimension spec: Education field

**User-facing terms**

- `Major / field of study`
- `What are you studying?`

**Internal attributes**

- Job:
  - `job_education_field_node_ids`
  - `job_education_field_mappings`
- Profile application facts:
  - `profile_education_field_node_ids`
  - `profile_education_records[].major_node_ids`
  - `profile_education_records[].minor_node_ids`
- Profile matching:
  - optional `profile_education_field_allow_node_ids`

**Dimension**

- `education_field`

**Tree shape**

```text
education_field
  engineering
    computer_science
    electrical_engineering
    mechanical_engineering
    bioengineering
  business
    finance
    accounting
    marketing
    business_analytics
  math_statistics
    mathematics
    statistics
    actuarial_science
  natural_sciences
    biology
    chemistry
    physics
  humanities_social_sciences
    economics
    psychology
    political_science
```

**Important design rule**

- Profiles must support **multiple degrees and multiple majors/minors**.
- Jobs may specify broad or multiple acceptable fields; store all valid normalized mappings.

**Job-side source fields**

- degree/major requirement text in description
- ATS question hints

**Profile-side source fields**

- education records
- current major/minor text

**Matching rules**

- Use branch overlap so `computer engineering` can still partially match broader engineering requests.
- Parent-only overlap may feed `possible_match`.

**Apply-completion rules**

- This dimension is critical for accurately filling education sections and degree-specific screening questions.

### 9.11 Dimension spec: Work authorization

**User-facing terms**

- `Work authorization`
- `Will you now or in the future require sponsorship?`

**Internal attributes**

- Job:
  - `job_work_auth_node_ids`
  - `job_work_auth_mappings`
- Profile application facts:
  - `profile_work_auth_node_ids`
  - `profile_requires_sponsorship`
  - `profile_visa_status`
- Profile matching:
  - optional derived routing flags

**Dimension**

- `work_authorization`

**Tree shape**

```text
work_authorization
  eligible_to_work
    us_citizen
    permanent_resident
    unrestricted_work_auth
    student_work_auth
  sponsorship
    no_sponsorship_needed
    future_sponsorship_needed
    current_sponsorship_needed
  visa_program
    f1_opt
    cpt
    h1b
```

**Job-side source fields**

- description text
- explicit sponsorship language
- ATS question wording

**Profile-side source fields**

- work authorization step in onboarding/profile

**Matching rules**

- Work authorization may be used as a hard filter only when the posting is explicit and confidence is high.
- Otherwise it should reduce confidence or route to `possible_match`, not silently suppress.

**Apply-completion rules**

- This is a first-class execution attribute and must answer ATS authorization questions deterministically.

### 9.12 Dimension spec: Employment type

**User-facing terms**

- `Employment type`
- `Full-time`
- `Part-time`
- `Contract`
- `Temporary`

**Internal attributes**

- Job:
  - `job_employment_type_node_ids`
  - `job_employment_type_mappings`
- Profile matching:
  - `profile_employment_type_allow_node_ids`
- Profile application facts:
  - optional availability notes

**Dimension**

- `employment_type`

**Tree shape**

```text
employment_type
  permanent
    full_time
    part_time
  temporary
    internship
    co_op
    seasonal
    contract
```

**Job-side source fields**

- title
- description
- structured employment type fields from ATS when present

**Profile-side source fields**

- explicit preference selections
- inferred from desired role types when needed

**Matching rules**

- Employment type should work alongside career-role, not replace it.
- Example: `internship` may appear under employment type and also under career role for different use cases.

**Apply-completion rules**

- Helps answer availability and role-type prompts consistently.

### 9.13 Non-taxonomy but required application facts

Some fields should remain structured profile/application facts even if they are not modeled as taxonomy trees.

| User-facing term | Internal attribute(s) | Browse filter | Apply completion |
|------------------|-----------------------|---------------|------------------|
| GPA | `profile_education_records[].gpa`, `profile_gpa_policy` | Optional later | Yes |
| School | `profile_education_records[].school_name`, future `school_node_id` optional | No | Yes |
| Graduation date | `profile_education_records[].graduation_date` | Yes via derived career logic | Yes |
| Start date availability | `profile_start_date_availability` | Optional | Yes |
| Salary expectations | `profile_salary_expectations`, `profile_salary_policy` | Optional | Yes |
| LinkedIn / portfolio / website | `profile_links` | No | Yes |
| Demographic disclosures | `profile_demographic_answers`, `profile_demographic_policy` | No | Yes |

**Disclosure-policy rule**

For fields that may be withheld when optional, store both:

- the underlying fact/value
- the disclosure policy

Examples:

- `profile_gpa_policy = 'required_only' | 'always' | 'never_if_optional'`
- `profile_demographic_policy.veteran_status = 'required_only'`
- `profile_salary_policy = 'required_only'`

### 9.14 `possible_match` semantics

`possible_match` should be a first-class result state, not an ad hoc UI label.

Use `possible_match` when one or more of the following is true:

- job taxonomy mapping is only available at a parent branch, not a confident leaf
- profile preference mapping is broad or ambiguous
- the job and profile overlap only at a higher branch level, not exact leaves
- a critical dimension has partial evidence but not enough confidence for a strong match
- the job appears relevant from title/description projection but normalized fields are incomplete

**Suggested match states**

- `strong_match`
- `match`
- `possible_match`
- `not_matchable_yet`
- `no_match`

### 9.15 Scoring and pruning contract

Use the trees to reduce compute first, then score.

**Order of operations**

1. Resolve raw job/profile inputs into normalized mappings.
2. Expand ancestor/descendant sets for selected profile allow nodes.
3. Prune by top-level or mid-level branch overlap instead of scanning all leaves.
4. Score surviving candidates by:
   - exact leaf match
   - same parent branch
   - same grandparent branch
   - confidence of resolution
   - whether the overlap is primary or secondary
5. Emit both score and reasons so browse and operator tooling can explain the result.

**Implementation rule**

- Do not brute-force compare every leaf against every other leaf when a branchpoint can rule out the subtree.

### 9.16 Deterministic reduction contract for jobs

This section defines how scraped job records are deterministically reduced into taxonomy categories. The core requirement is:

- **every job must resolve to at least one category path per required dimension**

For MVP, the required dimensions are:

- `industry`
- `job_function`
- `career_role`
- `geo`
- `work_modality`

For some jobs, additional dimensions should also resolve when evidence exists:

- `education_degree`
- `education_field`
- `work_authorization`
- `employment_type`

The resolver must stay fully deterministic. No AI classification is required or allowed for the primary reduction path.

### 9.17 Reduction principle: jobs are not classified from title alone

Jobs should be reduced using a layered evidence model because titles often encode **job function** but not the company’s real **industry**.

Examples:

- `Software Engineering Intern` strongly indicates `job_function`, but not enough to identify `industry` without company or description context.
- `Investment Banking Summer Analyst` strongly indicates both `industry` and `job_function`.
- `Research Engineer` is ambiguous without company, department, or description evidence.

Therefore:

- **industry reduction** should rely most heavily on company priors and company/context phrases
- **job-function reduction** should rely most heavily on title, team, and department
- **career-role reduction** should rely most heavily on title, commitment, tags, and recruiting-window text

### 9.18 Deterministic evidence sources

Each job should be normalized into a resolver input bundle before taxonomy mapping.

**Suggested resolver input bundle**

| Internal input | Typical source |
|---------------|----------------|
| `job.company_name` | scraper/app payload |
| `job.company_slug` | normalized company id if known |
| `job.title` | posting title |
| `job.team` | Greenhouse/Lever team/category |
| `job.department` | department/category |
| `job.commitment` | internship/full-time/co-op style category |
| `job.location_texts[]` | location plus any office list |
| `job.description_plain` | HTML-stripped description |
| `job.source_defaults` | source-config priors |
| `job.tags[]` | portal tags / ingest tags |
| `job.notes` | source notes / admin notes where available |

**Evidence priority by dimension**

| Dimension | Highest-priority evidence | Supporting evidence | Lowest-priority fallback |
|----------|----------------------------|---------------------|--------------------------|
| `industry` | company prior, company description, known company mapping | title, description, source notes, tags | source defaults, parent fallback |
| `job_function` | title, team, department | description, tags | company prior only if absolutely necessary |
| `career_role` | title, commitment, tags | description, graduation/term language | parent fallback |
| `geo` | explicit locations, office list | description text | parent fallback |
| `work_modality` | explicit remote/hybrid/onsite fields or location text | description text | unknown -> conservative default |

### 9.19 Deterministic reduction outputs

Each required dimension should emit a normalized result object.

**Suggested output shape**

| Field | Purpose |
|------|---------|
| `dimension` | taxonomy dimension |
| `primary_node_ids` | most confident canonical nodes |
| `secondary_node_ids` | additional supported nodes |
| `path_node_ids_by_node` | full path for each mapped node |
| `confidence` | `high`, `medium`, `low` |
| `resolution_kind` | `company_prior`, `alias_match`, `weighted_match`, `parent_fallback`, `hard_fallback` |
| `matched_evidence` | phrases/fields that caused the mapping |
| `needs_review` | operator-review flag |

**Required invariant**

- `primary_node_ids.length >= 1` for every required dimension after resolution completes

### 9.20 Company priors are first-class deterministic inputs

Company priors are required to make industry reduction reliable.

Many postings do not contain enough industry language in the title or body to infer industry accurately from the posting alone. A deterministic system therefore needs a curated company-level prior layer.

**Suggested company-prior shape**

| Field | Purpose |
|------|---------|
| `company_slug` | normalized company id |
| `primary_industry_node_ids` | default company industries |
| `secondary_industry_node_ids` | additional valid industries |
| `default_job_function_node_ids` | optional common functions for company families if useful |
| `company_aliases` | alternate spellings/acquisitions/brand aliases |
| `notes` | operator context |

**Examples**

- `Stripe`:
  - primary industry: `industry.finance.fintech`
  - secondary industry: `industry.technology.enterprise_software`
- `Benchling`:
  - primary industry: `industry.healthcare_biotech.biotech`
  - secondary industry: `industry.technology.enterprise_software`
- `Anduril`:
  - primary industry: `industry.industrial.defense_technology`
  - secondary industry: `industry.technology.robotics_autonomy`
- `OpenAI`:
  - primary industry: `industry.technology.ai_ml`
  - secondary industry: `industry.research.applied_research`

**Rule**

- Company priors should establish the default industry branch even when the posting title is generic.
- Title/description evidence may refine, expand, or downgrade leaf confidence, but should not discard a strong company prior without explicit contradictory evidence.

### 9.21 Alias dictionaries must be phrase families, not flat keywords

The deterministic mapper should use curated aliases attached to taxonomy nodes.

This is not a bag-of-words classifier. Each node should define:

- `positive_aliases`
- `supporting_phrases`
- `negative_aliases`
- optional `field_boosts`

**Example: investment banking**

```text
node: industry.finance.investment_banking
positive_aliases:
- investment banking
- m&a
- mergers and acquisitions
- capital markets
- leveraged finance
- restructuring
negative_aliases:
- retail banking
- branch banking
- treasury operations
```

**Example: biotech**

```text
node: industry.healthcare_biotech.biotech
positive_aliases:
- biotech
- therapeutics
- drug discovery
- genomics
- protein engineering
- molecular biology
- biologics
negative_aliases:
- hospital scheduling
- medical billing
- insurance claims
```

**Example: software engineering**

```text
node: job_function.engineering.software_engineering
positive_aliases:
- software engineer
- software engineering
- backend engineer
- frontend engineer
- full stack engineer
- platform engineer
- developer
negative_aliases:
- sales engineer
- solutions engineer
```

### 9.22 Multi-stage deterministic reduction algorithm

The resolver should run as a deterministic pipeline.

**Stage 1: Normalize source fields**

- lowercase and trim
- strip punctuation where appropriate
- normalize common abbreviations
- strip HTML to plain text
- split structured categories into separate inputs
- preserve original text for audit/debug

**Stage 2: Resolve company identity**

- map `company_name` to `company_slug` if known
- attach company priors and known aliases
- attach source-config defaults

**Stage 3: Branch selection**

For each dimension, score top-level branches using the strongest available evidence.

Example for `industry` branches:

- `technology`
- `finance`
- `consulting`
- `healthcare_biotech`
- `research`
- `industrial`
- `consumer`
- `public_sector`
- `other`

Only branches with evidence above threshold should remain active for leaf scoring.

**Stage 4: Leaf scoring within active branches**

- score candidate leaves using node alias dictionaries and field weights
- allow multiple leaves if evidence supports more than one
- allow leaf assignment across multiple branches when the company or role genuinely spans them

**Stage 5: Parent fallback**

- if no leaf in an active branch meets threshold, assign the highest-confidence parent branch or sub-branch
- preserve evidence and mark `resolution_kind = parent_fallback`

**Stage 6: Hard fallback guarantee**

- if no branch clears threshold, assign a deterministic fallback node
- this should be rare and should mark `needs_review = true`

### 9.23 Field weighting rules

Different fields should affect dimensions differently.

**Suggested weighting posture**

| Field | `industry` | `job_function` | `career_role` |
|------|------------|----------------|---------------|
| company prior | highest | low | none |
| company/source notes | high | low | none |
| title | medium | highest | highest |
| team | medium | high | low |
| department | medium | high | low |
| commitment | low | low | highest |
| tags | medium | medium | high |
| description | medium | medium | medium |

**Design rule**

- `industry` should usually be decided by company context plus supporting posting text
- `job_function` should usually be decided by title/team/department plus description
- `career_role` should usually be decided by title/commitment/tags plus description

### 9.24 Positive and negative evidence

Reduction must consider both what the job **looks like** and what it **does not** look like.

**Positive evidence**

- phrases that directly support a node
- department/team names aligned to the node
- known company prior

**Negative evidence**

- phrases that commonly cause false positives
- phrases that indicate a sibling node instead
- seniority terms that disqualify early-career leaves

**Examples**

- `product analyst` should not automatically map to `job_function.product.product_management`
- `sales engineer` should not collapse into `software_engineering`
- `equity research` should not collapse into generic `research`
- `operations research` should not collapse into generic `operations`

### 9.25 Multi-node assignment is normal, not exceptional

A deterministic system should allow multiple nodes when the job genuinely spans them.

This applies especially to:

- `industry`
- `job_function`
- `career_role`
- `education_field`

**Examples**

- AI drug-discovery company:
  - `industry.healthcare_biotech.biotech`
  - `industry.technology.ai_ml`
- Quantitative role at hedge fund:
  - `industry.finance.hedge_fund`
  - `job_function.data.quantitative_research`
- Broad early-career role:
  - `career_role.early_career.new_grad`
  - `career_role.experienced.entry_level`

**Rule**

- multi-node assignment should require real supporting evidence
- one node should still be marked primary when possible

### 9.26 Parent fallback is part of the model

Parent fallback should be expected whenever evidence is broad but not precise.

**Examples**

- enough evidence for `industry.finance`, but not enough to distinguish `hedge_fund` vs `asset_management`
- enough evidence for `job_function.engineering`, but not enough to distinguish `backend` vs `full_stack`
- enough evidence for `career_role.student.internship`, but term is unclear

**Rule**

- never leave a required dimension empty if a valid parent branch is defensible
- branch-level matches should remain usable for filtering and `possible_match`

### 9.27 Hard fallback buckets

To guarantee that every job is categorized, each required dimension should include safe fallback nodes.

**Industry fallback branches**

- `industry.technology`
- `industry.finance`
- `industry.consulting`
- `industry.healthcare_biotech`
- `industry.research`
- `industry.industrial`
- `industry.consumer`
- `industry.public_sector`
- `industry.other`

**Job-function fallback branches**

- `job_function.engineering`
- `job_function.data`
- `job_function.product`
- `job_function.business`
- `job_function.research`
- `job_function.operations`
- `job_function.other`

**Career-role fallback branches**

- `career_role.student`
- `career_role.early_career`
- `career_role.experienced`

**Rule**

- `other` should exist but be rare
- if `other` is assigned, the job should be eligible for operator review and taxonomy expansion

### 9.28 Required-dimension resolution guarantees

For MVP, the deterministic resolver must guarantee:

**Industry**

- every job resolves to at least one `industry` node
- known companies should almost never fall to `industry.other`

**Job function**

- every job resolves to at least one `job_function` node
- generic titles should still fall to a broad function branch

**Career role**

- every job resolves to at least one `career_role` node
- early-career scraping scope means this dimension should usually resolve with high confidence

**Geo**

- every job resolves to at least one `geo` path, even if only to state/region/country

**Work modality**

- every job resolves to one of `remote`, `hybrid`, `onsite`, or explicit `unknown`

### 9.29 Deterministic examples

**Example A: generic software internship at known fintech**

```text
Company: Stripe
Title: Software Engineering Intern
Team: Infrastructure
Description: Build internal developer systems and APIs
```

Expected reduction:

- `industry.finance.fintech` (company prior)
- optional secondary: `industry.technology.enterprise_software`
- `job_function.engineering.software_engineering.infra_platform`
- `career_role.student.internship`

**Example B: biotech ML role**

```text
Company: Benchling
Title: Machine Learning Engineer Intern
Description: Support molecular data systems and AI workflows for life science R&D
```

Expected reduction:

- `industry.healthcare_biotech.biotech`
- secondary: `industry.technology.ai_ml`
- `job_function.engineering.software_engineering.ml_engineering`
- optional secondary: `job_function.research.applied_science`
- `career_role.student.internship`

**Example C: vague title at unknown company with clear body text**

```text
Company: Apex Labs
Title: Analyst Intern
Description: Support transaction modeling, M&A analysis, capital markets materials
```

Expected reduction:

- `industry.finance.investment_banking`
- `job_function.business.finance_analysis` or equivalent finance-function leaf if present
- `career_role.student.internship`

**Example D: ambiguous finance subdomain**

```text
Company: Meridian Capital
Title: Summer Analyst
Description: Work on investment research and portfolio support
```

Expected reduction:

- at minimum `industry.finance`
- if evidence supports it, refine to `asset_management`
- if not, remain at parent with `resolution_kind = parent_fallback`

### 9.30 Operator review and taxonomy growth

A deterministic system still needs operational feedback loops.

Jobs should be flagged for review when:

- a required dimension resolves only to `other`
- only hard fallback nodes were assigned
- evidence was too weak for leaf selection
- multiple sibling leaves tie repeatedly
- a company repeatedly produces the same unresolved pattern

Those reviewed jobs should feed:

- new taxonomy nodes
- new aliases
- new negative/disambiguation phrases
- improved company priors

### 9.31 Draft implementation tables for deterministic reduction

The following helper datasets should exist in some durable form.

| Dataset | Purpose |
|--------|---------|
| `taxonomy_nodes` | canonical tree nodes |
| `taxonomy_aliases` | positive alias and synonym mapping |
| `taxonomy_negative_aliases` or metadata field | false-positive prevention |
| `company_taxonomy_priors` | company-level default industry mappings |
| `job_taxonomy_resolution_logs` | resolver evidence/debug trail |
| `job_taxonomy_mappings` | persisted resolved mappings per job and dimension |

### 9.32 Non-goals for the deterministic resolver

The reducer should not:

- depend on embeddings or AI classification
- try to infer niche leaves from weak evidence when parent fallback is sufficient
- silently return no category for required dimensions
- overload `industry` to represent `job_function`

### 9.33 Recommended next implementation order

1. implement shared resolver input normalization
2. seed top-level and mid-level `industry` tree with required fallback nodes
3. seed `job_function` and `career_role` trees
4. add company priors for all known source companies
5. replace current `infer_industries` keyword buckets with deterministic node-based resolution
6. persist mapping evidence and fallback kinds for operator review
7. wire browse filtering to normalized dimensions and `possible_match`

## 10. Full implementation plan

This section translates the taxonomy spec and deterministic reduction contract into an execution plan that is ready for schema work and implementation.

### 10.1 Objectives

The implementation must achieve all of the following:

- unify job normalization across Next.js ingest and Python scraper ingest
- reduce every job into required taxonomy-backed dimensions deterministically
- store enough mapping evidence to debug why a job matched, weakly matched, or failed to match
- support two user outcomes from the same normalized model:
  - accurate browse filtering
  - accurate automatic application completion
- preserve a seamless user-facing profile flow while storing two internal profile layers
- avoid large brute-force comparisons by using branch-aware pruning and indexed overlap

### 10.2 Scope by system

| System area | Responsibility in this plan |
|------------|------------------------------|
| `scraper/*` | produce normalized resolver inputs and stop doing flat keyword-only industry mapping |
| `lib/job-ingest.ts` | become one canonical write-time normalization contract for jobs |
| `lib/matching.ts` | move from flat arrays/string matching toward taxonomy-aware matching |
| `app/onboarding/*` and profile flows | collect structured profile facts and preferences through one logical UX |
| Supabase schema | store taxonomy nodes, aliases, company priors, job/profile mappings, and review/debug data |
| browse APIs | filter against taxonomy-backed dimensions and expose `possible_match` |
| apply engine / applicant export | consume profile application facts plus normalized job requirements for deterministic form filling |

### 10.3 Target data model

Use a hybrid model:

- canonical taxonomy entities and reusable priors live in normalized tables
- resolved job/profile mappings are stored in normalized tables and, where useful for performance, denormalized arrays/json columns on `jobs` and `profiles`

### 10.4 Proposed Supabase tables

**Core taxonomy**

| Table | Purpose |
|------|---------|
| `taxonomy_nodes` | all taxonomy nodes across dimensions |
| `taxonomy_aliases` | positive aliases and synonyms for nodes |
| `taxonomy_negative_aliases` | optional false-positive phrases per node |
| `taxonomy_paths` | ancestor/descendant expansion support |

**Priors and curation**

| Table | Purpose |
|------|---------|
| `company_taxonomy_priors` | default industry priors and optional function priors per company |
| `taxonomy_curation_events` | optional audit trail for manual node/alias/company-prior changes |

**Resolved mappings**

| Table | Purpose |
|------|---------|
| `job_taxonomy_mappings` | resolved job mappings by dimension with evidence and confidence |
| `profile_taxonomy_mappings` | resolved profile mappings by dimension and layer (`match_preferences` vs `application_facts`) |
| `job_taxonomy_resolution_logs` | optional full resolver debug trail for operator/admin inspection |

### 10.5 Proposed table shapes

**`taxonomy_nodes`**

Suggested columns:

- `id uuid primary key`
- `dimension text not null`
- `slug text not null unique`
- `label text not null`
- `parent_node_id uuid null references taxonomy_nodes(id)`
- `depth int not null`
- `is_leaf boolean not null default false`
- `status text not null default 'active'`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Suggested constraints/indexes:

- unique on `(dimension, slug)`
- index on `(dimension, parent_node_id)`
- index on `(dimension, depth)`

**`taxonomy_aliases`**

Suggested columns:

- `id uuid primary key`
- `node_id uuid not null references taxonomy_nodes(id)`
- `alias text not null`
- `alias_normalized text not null`
- `match_kind text not null default 'positive'`
- `field_scope text[] not null default '{}'`
- `weight numeric not null default 1`
- `metadata jsonb not null default '{}'::jsonb`

Suggested constraints/indexes:

- unique on `(node_id, alias_normalized, match_kind)`
- index on `alias_normalized`
- index on `node_id`

**`taxonomy_negative_aliases`**

Suggested columns:

- `id uuid primary key`
- `node_id uuid not null references taxonomy_nodes(id)`
- `phrase text not null`
- `phrase_normalized text not null`
- `field_scope text[] not null default '{}'`
- `penalty numeric not null default 1`

**`taxonomy_paths`**

Suggested columns:

- `ancestor_node_id uuid not null references taxonomy_nodes(id)`
- `descendant_node_id uuid not null references taxonomy_nodes(id)`
- `distance int not null`

Suggested constraints/indexes:

- primary key on `(ancestor_node_id, descendant_node_id)`
- index on `descendant_node_id`

**`company_taxonomy_priors`**

Suggested columns:

- `id uuid primary key`
- `company_slug text not null unique`
- `company_name text not null`
- `company_aliases text[] not null default '{}'`
- `primary_industry_node_ids uuid[] not null default '{}'`
- `secondary_industry_node_ids uuid[] not null default '{}'`
- `default_job_function_node_ids uuid[] not null default '{}'`
- `confidence text not null default 'high'`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

**`job_taxonomy_mappings`**

Suggested columns:

- `id uuid primary key`
- `job_id uuid not null references public.jobs(id) on delete cascade`
- `dimension text not null`
- `node_id uuid not null references taxonomy_nodes(id)`
- `is_primary boolean not null default false`
- `confidence text not null`
- `resolution_kind text not null`
- `source_fields text[] not null default '{}'`
- `matched_evidence jsonb not null default '[]'::jsonb`
- `needs_review boolean not null default false`
- `created_at timestamptz not null default now()`

Suggested constraints/indexes:

- unique on `(job_id, dimension, node_id)`
- index on `(job_id, dimension)`
- index on `(dimension, node_id)`
- partial index on `(needs_review)` where `needs_review = true`

**`profile_taxonomy_mappings`**

Suggested columns:

- `id uuid primary key`
- `profile_id uuid not null references public.profiles(id) on delete cascade`
- `profile_layer text not null`
- `dimension text not null`
- `node_id uuid not null references taxonomy_nodes(id)`
- `is_primary boolean not null default false`
- `confidence text not null`
- `resolution_kind text not null`
- `source_fields text[] not null default '{}'`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

Suggested constraints/indexes:

- unique on `(profile_id, profile_layer, dimension, node_id)`
- index on `(profile_id, profile_layer, dimension)`

### 10.6 Proposed additions to `public.jobs`

Add performance-oriented and API-friendly columns to `public.jobs` while keeping mapping tables canonical.

Suggested additions:

- `locations_text text[] not null default '{}'`
- `work_modality text null`
- `work_modality_confidence text null`
- `job_geo_node_ids uuid[] not null default '{}'`
- `job_industry_node_ids uuid[] not null default '{}'`
- `job_function_node_ids uuid[] not null default '{}'`
- `job_career_node_ids uuid[] not null default '{}'`
- `job_degree_requirement_node_ids uuid[] not null default '{}'`
- `job_education_field_node_ids uuid[] not null default '{}'`
- `job_work_auth_node_ids uuid[] not null default '{}'`
- `job_employment_type_node_ids uuid[] not null default '{}'`
- `job_taxonomy_summary jsonb not null default '{}'::jsonb`
- `taxonomy_resolution_version text null`
- `taxonomy_needs_review boolean not null default false`

### 10.7 Proposed additions to `public.profiles`

Keep old fields during migration, but add normalized structures for both internal layers.

Suggested additions:

- `profile_match_preferences jsonb not null default '{}'::jsonb`
- `profile_application_facts jsonb not null default '{}'::jsonb`
- `profile_geo_allow_node_ids uuid[] not null default '{}'`
- `profile_industry_allow_node_ids uuid[] not null default '{}'`
- `profile_job_function_allow_node_ids uuid[] not null default '{}'`
- `profile_career_allow_node_ids uuid[] not null default '{}'`
- `profile_work_modality_allow text[] not null default '{}'`
- `profile_degree_node_ids uuid[] not null default '{}'`
- `profile_education_field_node_ids uuid[] not null default '{}'`
- `profile_work_auth_node_ids uuid[] not null default '{}'`
- `profile_employment_type_allow_node_ids uuid[] not null default '{}'`
- `profile_taxonomy_summary jsonb not null default '{}'::jsonb`

### 10.8 Canonical resolver package layout

Implement one shared normalization package and mirror it in both TS and Python only where necessary.

Preferred structure:

- `lib/taxonomy/`
  - `dimensions.ts`
  - `normalize-text.ts`
  - `resolver-types.ts`
  - `company-priors.ts`
  - `resolve-industry.ts`
  - `resolve-job-function.ts`
  - `resolve-career-role.ts`
  - `resolve-geo.ts`
  - `resolve-work-modality.ts`
  - `resolve-profile.ts`
  - `persist-job-mappings.ts`
  - `persist-profile-mappings.ts`

Python side:

- stop duplicating mapping rules in `scraper/ingest_jobs.py`
- either:
  - send raw resolver inputs to the Next.js/API contract and let TS own normalization
  - or load shared seed/alias/prior JSON artifacts generated from one source of truth

For MVP, the safest direction is:

- **TS owns taxonomy resolution**
- Python scraper forwards raw job payloads and stops making final classification decisions beyond minimal extraction

### 10.9 Deterministic resolver contract by dimension

**Industry resolver**

Inputs:

- company name / slug
- title
- team
- department
- description
- source defaults
- notes / tags

Output requirements:

- at least one `industry` node always
- primary + optional secondary nodes
- evidence trail
- parent fallback when leaf confidence is insufficient

**Job-function resolver**

Inputs:

- title
- team
- department
- description
- tags

Output requirements:

- at least one `job_function` node always
- multi-node support for broad roles

**Career-role resolver**

Inputs:

- title
- commitment
- target term/year text
- tags
- description

Output requirements:

- at least one `career_role` node always
- season leaf when evidence exists
- parent fallback for unclear internship/new-grad timing

**Geo resolver**

Inputs:

- location strings
- office list
- description references

Output requirements:

- at least one geo path always
- city if possible, else state, region, or country
- multi-site OR preserved

**Work-modality resolver**

Inputs:

- explicit structured field if available
- location text
- description text

Output requirements:

- one of `remote`, `hybrid`, `onsite`, or `unknown`
- eligibility restrictions may still add geo nodes for remote jobs

### 10.10 Seed-data plan

The taxonomy system will fail if the seeds are too narrow. Seed broadly from the start.

**Initial dimensions to seed**

1. `geo`
2. `industry`
3. `job_function`
4. `career_role`
5. `education_degree`
6. `education_field`
7. `work_authorization`
8. `employment_type`

**Industry seed requirements**

The initial seed set must support at minimum:

- software / enterprise software / devtools / infrastructure / cybersecurity / AI-ML / data platforms
- fintech / banking / investment banking / private equity / hedge funds / asset management / payments
- management consulting / strategy consulting / operations consulting
- biotech / medical devices / healthcare services / pharma / research labs
- robotics / defense tech / hardware / semiconductor / industrial tech
- consumer internet / marketplaces / logistics / mobility
- public sector / government / nonprofit

**Company-prior seed requirements**

Create priors for:

- all companies in `data/job-sources/internship-sources.json`
- companies already present in jobs tables or seed jobs
- companies appearing frequently in current scraper source lists

### 10.11 Browse filtering plan

Browse filtering should move from flat columns and substring checks to taxonomy-aware filtering.

**Phase A**

- preserve current browse behavior
- add taxonomy-backed enrichments alongside current fields
- show match explanations using taxonomy summaries where available

**Phase B**

- filter by normalized node overlap for:
  - geo
  - work modality
  - industry
  - job function
  - career role
- surface:
  - `strong_match`
  - `match`
  - `possible_match`

**Phase C**

- retire old free-text location filtering and flat industry matching once migration quality is acceptable

### 10.12 Apply-completion plan

The apply engine and applicant export should consume normalized job requirements plus structured application facts.

**Use normalized job data to:**

- identify likely required degree/major expectations
- interpret relocation and work-setup questions
- answer work authorization deterministically
- choose the correct education record when multiple exist
- decide whether GPA, salary, or disclosures should be withheld unless required

**Use structured profile facts to:**

- fill education history accurately
- fill multiple majors/minors accurately
- answer work authorization and sponsorship questions deterministically
- fill current address and relocation answers consistently
- obey per-field disclosure policy

### 10.13 Profile UX implementation plan

The UX should stay seamless even though storage splits into two internal layers.

**Implementation approach**

- keep one onboarding/profile flow
- group questions by user logic, not internal storage
- write answers into both `profile_match_preferences` and `profile_application_facts` as needed

**Suggested onboarding sections**

1. Basics and contact
2. Current location and work setup
3. Where you want to work
4. Education history
5. Industries and role interests
6. Career-stage / internship / new-grad preferences
7. Work authorization and sponsorship
8. Application preferences and disclosure policies

### 10.14 Migration plan

Migrate in batches so current product flows continue to work.

**Migration 1: taxonomy foundation**

- create taxonomy tables
- create mapping tables
- seed initial dimensions and fallback nodes

**Migration 2: job/profile storage extensions**

- add new taxonomy-backed columns to `jobs` and `profiles`
- keep old fields intact

**Migration 3: canonical resolver introduction**

- implement TS resolver pipeline
- route Next.js ingest through resolver
- have Python scraper stop final classification drift

**Migration 4: backfill existing jobs**

- re-resolve current jobs into taxonomy mappings
- store evidence and review flags
- identify unresolved and fallback-heavy jobs

**Migration 5: profile backfill**

- map current `industries`, `locations`, `levels`, `target_role_families`, `target_terms`, and `target_years` into taxonomy-backed structures
- preserve old fields during dual-write / dual-read period

**Migration 6: browse dual-read**

- compare legacy matcher output with taxonomy matcher output
- track disagreement rates
- only cut over once mismatch analysis is acceptable

**Migration 7: apply-engine cutover**

- move applicant export and ATS answer logic to `profile_application_facts` plus normalized job requirements

### 10.15 Dual-write and cutover strategy

During migration:

- writes should populate both legacy fields and taxonomy-backed fields where feasible
- browse and matching can dual-read both systems for validation
- operator/admin tools should expose both old and new values during transition

Cutover criteria:

- taxonomy resolution coverage is high on required dimensions
- known-source companies rarely hit hard fallback nodes
- browse disagreement rate is understood and acceptable
- application-fact export produces equal or better ATS answer quality

### 10.16 Matching engine update plan

The matcher should move from flat score components to taxonomy-aware gates plus scoring.

**Proposed logic**

1. hard or near-hard gating:
   - work modality incompatibility
   - explicit work authorization mismatch when confidence is high
2. branch-aware compatibility:
   - geo overlap
   - industry overlap
   - job-function overlap
   - career-role overlap
3. scoring:
   - exact leaf match
   - same parent branch
   - same grandparent branch
   - primary vs secondary node
   - mapping confidence
4. result state:
   - `strong_match`
   - `match`
   - `possible_match`
   - `not_matchable_yet`
   - `no_match`

### 10.17 RPC and index plan

RPC coarse filtering should use normalized arrays and path expansion, not free-text `LIKE`.

Potential helpers:

- profile-expanded allow sets by dimension
- overlap checks on `uuid[]`
- materialized or cached ancestor/descendant expansion

Recommended indexes:

- GIN indexes on taxonomy node arrays stored on `jobs` and `profiles`
- indexes on mapping tables by `(dimension, node_id)`
- indexes on `taxonomy_paths`

### 10.18 Admin and operator tooling plan

Admin/operator surfaces should support taxonomy debugging.

Needed capabilities:

- inspect a job’s resolved taxonomy nodes by dimension
- inspect evidence used for each resolution
- see whether a mapping came from:
  - company prior
  - alias match
  - weighted match
  - parent fallback
  - hard fallback
- filter jobs that need review
- manually override mappings where needed
- create new aliases or company priors from admin review

### 10.19 Verification plan

Every material code batch should keep the existing repo verification rule:

- `npm run test:apply-engine`
- `python3 -m py_compile $(find apply_engine -name '*.py')`
- `npm run build`

Add taxonomy-specific verification:

- unit tests for alias matching
- unit tests for negative/disambiguation rules
- resolver tests for industry/function/career-role examples
- backfill smoke tests on a representative job sample
- browse parity comparison tests between old and new matchers

### 10.20 Risks and mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| taxonomy too shallow | poor matching and overuse of `other` | seed broader branches and company priors first |
| taxonomy too deep too early | maintenance burden and false precision | allow parent fallback and expand leaves gradually |
| company priors incomplete | poor industry classification for generic titles | prioritize priors for all known source companies |
| dual-ingest drift persists | jobs classified differently by path | centralize final resolution in TS write path |
| legacy/profile migration ambiguity | noisy profile matches | keep dual-read period and surface confirmation UX for ambiguous mappings |
| browse regressions during cutover | trust loss | dual-run matcher before switching |
| apply-engine fact mapping incomplete | autofill blockers remain | prioritize education, work auth, location, and disclosure-policy fields |

### 10.21 Implementation sequence recommendation

Recommended execution order:

1. schema + taxonomy foundation
2. company priors + initial seeds
3. deterministic `industry` resolver
4. deterministic `job_function` resolver
5. deterministic `career_role` resolver
6. job ingest dual-write
7. job backfill + admin review tooling
8. profile storage + onboarding dual-write
9. browse matcher cutover
10. apply-engine/application-facts cutover

## 11. Implementation phases

**Phase 0 — Vocabulary and single ingest story**  
Unify **`target_term`** (and related) at **write** time; align TS matcher + RPCs; shared spec or codegen for **role_family / level** across API and Python; fix **`pending` vs `active`**; Python industries parity with **`normalizeJobIndustries`**.

**Phase 1 — Structured fields without full taxonomy**  
Multi-location **raw** capture (`location` → `locations_text[]` or JSON); parse **work modality** enum; optional structured **state/country** columns from string parse.

**Phase 2 — Geo taxonomy MVP**  
Seed **`taxonomy_node`** (geo dimension): countries, US regions, all states, **~50 cities**. Add **`job_geo_node_ids`**, **`profile_geo_allow_node_ids`**, resolver service, RPC overlap + TS matcher; implement **OR** across job sites.

**Phase 3 — Career taxonomy + calendar**  
Seed career tree; **`job_career_node_id`** (or ids); **`profile_career_allow_node_ids`**; wire onboarding; migrate from `level` / `role_family` / `experience_band` via resolver.

**Phase 4 — Industry tree (optional)**  
Deeper industry nodes if product needs; align with `gray_areas` / exclusions strategy.

---

## 12. Remaining open questions (not locked)

1. **Remote + geo:** If user selects **no** geo but **remote only**, is that “US remote only” or “anywhere”? Define explicit **remote geography policy** (e.g. country of employment).  
2. **Hybrid:** Match if **any** office site is allowed, or **all** listed sites? (Default **any** aligns with §2 multi-location OR.)  
3. **“Open to all US”** UX: single **country** node select vs explicit **region** multi-select—product shortcut.  
4. **International job seeker:** Multiple **country** roots under profile allow—ordering and expansion rules.  
5. **Scoring:** Keep numeric **score + reasons** or move to **hard gates** per dimension + optional ranking score?  
6. **Low-confidence resolver:** Admin queue vs user confirmation vs suppress job.

---

## 13. Document control

- **Code references:** `lib/job-ingest.ts`, `lib/job-normalization.ts`, `lib/job-industries.ts`, `lib/matching.ts`, `lib/candidate-routing.ts`, `scraper/ingest_jobs.py`, `scraper/sources/common.py`, `supabase/migrations/20260402120000_job_routing_and_targeting.sql`, `lib/supabase/database.types.ts`, `lib/platform/profile.ts`.  
- **Next step:** Execute **Phase 0**, then seed **geo taxonomy** table design + **~50 city** list in repo for Phase 2.
