# Claude Research Prompt: ATS Portal Question Mapping

Use the prompt below as-is with Claude for deep research on how internship application portals actually ask questions. The goal is not generic ATS commentary. The goal is to extract portal-by-portal, field-by-field implementation patterns that can be converted into deterministic automation logic for `Twin`.

---

## Prompt

You are doing product and implementation research for an automated job application engine called `Twin`.

Your job is to research how the major internship/job application portals structure their application forms, what exact questions they ask, how those questions are phrased, how those questions are rendered in HTML/UI, and which parts are deterministic enough to automate without AI.

This research will be used to build portal-specific Playwright agents for:

1. Greenhouse
2. Lever
3. Workday
4. Handshake

The application engine strategy is:

- Hardcode deterministic portal logic for the major portals.
- Use no AI for known portal flows whenever possible.
- Use a vision fallback only for unknown/custom portals.
- Prioritize cheap, stable automation for internship applications.

I need implementation-grade research, not just high-level summaries.

## What you are researching

Research how these portals ask:

1. Basic identity/contact questions
2. Resume / CV upload
3. LinkedIn / portfolio / website
4. Work authorization
5. Visa sponsorship / future sponsorship
6. Location preferences
7. Salary expectations
8. Earliest start date / availability
9. School / degree / graduation date / GPA
10. Demographic / EEO / voluntary self-ID blocks
11. Custom written questions
12. Multiple-choice screening questions
13. Checkboxes and acknowledgements
14. Multi-step review / next / continue / submit flows
15. Login walls / account creation interruptions
16. Confirmation pages / success states / confirmation text

## Scope and method

For each portal, inspect a broad sample of real public job postings, especially:

- internships
- new grad roles
- software engineering roles
- PM / product roles
- data / ML roles
- startups and larger companies

Use a representative sample and look for repeated patterns.

Do not just summarize one or two pages.

## Required output format

Organize the answer in the exact sections below.

### Section 1: Executive Summary

Provide:

- Which portal fields are most standardized and safe to hardcode
- Which portal fields vary but are still pattern-matchable
- Which portal fields are most likely to require fallback logic
- Which portal is easiest to automate first
- Which portal is hardest and why
- Estimated automation coverage by portal for internship applications

### Section 2: Portal-by-Portal Deep Dive

Create one subsection each for:

1. Greenhouse
2. Lever
3. Workday
4. Handshake

Inside each portal subsection, include:

- Overall form architecture
- Whether it is single-page or multi-step
- Typical navigation patterns
- Whether review pages are common
- Whether auth/login interruptions are common
- Whether custom question blocks are embedded consistently
- How success/confirmation states typically appear

Then create a detailed table with these columns:

| Question Category | Exact Example Phrasing | Field Type | Typical HTML/DOM Pattern | Common Selector Clues | Required vs Optional | Standardized or Custom | Automation Difficulty | Notes |

Populate the table with as many real recurring question patterns as you can find.

### Section 3: Exact Question Library

Build a normalized library of the actual questions these portals ask.

For each portal, create grouped lists for:

- Contact info
- Resume / CV
- Links
- Education
- Work authorization
- Sponsorship
- Availability / start date
- Location / relocation
- Compensation
- EEO / demographic
- Written screening questions
- Legal acknowledgements
- Final review / submit

For each group, list:

- exact example wording
- close wording variants
- likely normalized meaning
- suggested normalized internal field name

Example format:

| Portal | Exact wording | Variants | Normalized meaning | Suggested internal field key |

I want a very large list, not a short sample.

### Section 4: HTML / UI Implementation Patterns

For each portal, describe the common rendering patterns for each question type:

- text input
- textarea
- file upload
- select dropdown
- radio group
- checkbox
- date picker
- dynamic add/remove fields
- conditional follow-up fields
- modal interruptions
- review screen

For each, include:

- common DOM structure
- common attribute names
- common label patterns
- common button labels
- common ways errors are displayed
- common ways required fields are marked

If selectors or patterns vary, explain the variants.

### Section 5: Deterministic Automation Opportunities

For each portal, break questions into three buckets:

1. Deterministic and easy to hardcode
2. Deterministic but needs fallback selector logic
3. Too custom for safe hardcoding and likely needs fallback AI or human review

Be concrete. Tie the classification to real question types.

### Section 6: Recommended Internal Data Model

Recommend a normalized internal application profile schema that would cover the recurring questions across these portals.

Include fields for:

- identity
- contact
- links
- education
- legal/work authorization
- compensation
- location preferences
- start date / availability
- custom freeform answers
- demographic answers

For each suggested field, include:

- field key
- type
- example value
- which portals use it often
- whether it should be user-authored, inferred, or generated

### Section 7: Recommended Automation Rules

For each portal, propose implementation rules for an automation engine:

- portal detection logic
- field fill order
- optional vs required field strategy
- multi-step navigation strategy
- how to detect validation errors
- how to detect success
- how to detect auth/login blockers
- when to stop and escalate to fallback logic

Write these like practical engineering recommendations, not product fluff.

### Section 8: High-Signal Selector Clues

Produce a selector-clue inventory for each portal.

For each portal, list the most reliable clues for:

- first name
- last name
- full name
- email
- phone
- LinkedIn
- portfolio / website
- resume upload
- work authorization
- sponsorship
- location
- salary
- graduation date
- start date
- school
- degree
- GPA
- custom question blocks
- next / continue
- submit
- confirmation state

I do not need exact final selectors only. I do need:

- likely attribute names
- likely label text
- repeated naming conventions
- useful fallback matching heuristics

### Section 9: Edge Cases and Failure Modes

List the common things that break deterministic automation for each portal:

- custom employer-added questions
- modal sign-ins
- duplicate labels
- hidden or progressively revealed fields
- required checkboxes
- inconsistent radio values
- stale DOM after moving to next step
- duplicate submit buttons
- attachment upload blockers
- review screens with final unanswered required fields

For each failure mode, explain:

- how it appears
- how often it likely occurs
- whether deterministic logic can recover
- whether fallback vision or manual review is better

### Section 10: Final Deliverables

End with these final artifacts:

1. A portal difficulty ranking from easiest to hardest
2. A “build-first” recommendation for implementation order
3. A normalized master list of top 30 recurring question types across all portals
4. A list of the top 15 exact question phrasings we should support first
5. A list of the top 15 selector patterns we should encode first
6. A list of what absolutely should not be automated blindly

## Important research constraints

- Focus on implementation detail.
- Use real public examples where possible.
- Distinguish standardized portal-native fields from employer custom fields.
- If you are unsure, explicitly say uncertainty level.
- Prefer specificity over breadth when a pattern is stable.
- Prefer breadth over detail when the portal is highly variable.
- Do not give shallow advice like “use robust selectors.”
- Do not just describe ATS software generally.
- Do not output only prose. Use many structured tables.
- Do not stop at the obvious contact fields.

## Extra requested output

At the very end, include:

### A. Machine-Readable Mapping Draft

Provide a draft JSON object shaped like this:

```json
{
  "greenhouse": {
    "contact_fields": [],
    "education_fields": [],
    "authorization_fields": [],
    "sponsorship_fields": [],
    "availability_fields": [],
    "compensation_fields": [],
    "custom_question_patterns": [],
    "next_buttons": [],
    "submit_buttons": [],
    "confirmation_clues": []
  },
  "lever": {},
  "workday": {},
  "handshake": {}
}
```

Populate it with concrete values, not placeholders.

### B. Automation Readiness Scorecard

Create a scorecard table like:

| Portal | Coverage with Hardcoded Logic | Risk of Custom Questions | Review-Step Complexity | Auth Block Frequency | Confidence in Deterministic Automation |

### C. Engineering Notes for Twin

Write a final section called `Engineering Notes for Twin` with direct recommendations for how to translate your findings into:

- Playwright agent code
- selector maps
- question normalization logic
- application profile schema
- fallback trigger conditions

This should read like handoff notes to an engineer building the automation layer.

---

## How to use the output

When Claude returns the research:

1. Save the result.
2. Feed the exact output back into the `Twin` code implementation workflow.
3. Use the question library to expand portal selectors and normalized field mappings.
4. Use the failure-mode section to decide when to invoke vision fallback.

## Optional follow-up prompt

If the first Claude pass is too broad, use this follow-up:

> Narrow the analysis to only Greenhouse and Lever. I want a much more exhaustive breakdown of exact question phrasings, selector clues, and common internship screening questions. Expand the machine-readable mappings and give me implementation-grade normalized field definitions.

