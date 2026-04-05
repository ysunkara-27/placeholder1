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

## 9. Implementation phases

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

## 10. Remaining open questions (not locked)

1. **Remote + geo:** If user selects **no** geo but **remote only**, is that “US remote only” or “anywhere”? Define explicit **remote geography policy** (e.g. country of employment).  
2. **Hybrid:** Match if **any** office site is allowed, or **all** listed sites? (Default **any** aligns with §2 multi-location OR.)  
3. **“Open to all US”** UX: single **country** node select vs explicit **region** multi-select—product shortcut.  
4. **International job seeker:** Multiple **country** roots under profile allow—ordering and expansion rules.  
5. **Scoring:** Keep numeric **score + reasons** or move to **hard gates** per dimension + optional ranking score?  
6. **Low-confidence resolver:** Admin queue vs user confirmation vs suppress job.

---

## 11. Document control

- **Code references:** `lib/job-ingest.ts`, `lib/job-normalization.ts`, `lib/job-industries.ts`, `lib/matching.ts`, `lib/candidate-routing.ts`, `scraper/ingest_jobs.py`, `scraper/sources/common.py`, `supabase/migrations/20260402120000_job_routing_and_targeting.sql`, `lib/supabase/database.types.ts`, `lib/platform/profile.ts`.  
- **Next step:** Execute **Phase 0**, then seed **geo taxonomy** table design + **~50 city** list in repo for Phase 2.
