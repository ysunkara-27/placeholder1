from __future__ import annotations

import re
from typing import Any

from apply_engine.browser import (
    execute_actions,
    fill_combobox_input,
    get_preferred_selector,
    normalize_confirmation_text,
    selector_exists,
)
from apply_engine.models import ApplicantProfile, BlockedFieldFamily, PlannedAction


CUSTOM_ANSWER_KEY_ALIASES = {
    "university": "school",
    "college": "school",
    "school_name": "school",
    "major": "degree",
    "discipline": "discipline",
    "field_of_study": "discipline",
    "graduation": "graduation_date",
    "grad_date": "graduation_date",
    "graduation_year": "graduation_date",
    "relocate": "relocation",
    "willing_to_relocate": "relocation",
    "source": "heard_about_us",
    "how_did_you_hear_about_us": "heard_about_us",
    "onsite": "onsite_preference",
    "work_mode": "onsite_preference",
    "onsite_or_remote": "onsite_preference",
    "hours_per_week": "weekly_availability_hours",
    "weekly_hours": "weekly_availability_hours",
    "availability_hours": "weekly_availability_hours",
    "graduation_timeline": "graduation_window",
    "class_year": "graduation_window",
    "grad_window": "graduation_window",
    "commute": "commute_preference",
    "commute_radius": "commute_preference",
    "gender": "gender",
    "sex": "gender",
    "race": "race_ethnicity",
    "ethnicity": "race_ethnicity",
    "race_ethnicity": "race_ethnicity",
    "veteran": "veteran_status",
    "veteran_status": "veteran_status",
    "disability": "disability_status",
    "disability_status": "disability_status",
    "technologies": "technologies",
    "skills": "technologies",
    "programming_languages": "technologies",
    "languages": "technologies",
}


STANDARD_HINT_ALIASES: dict[str, list[str]] = {
    "school": [
        "current school",
        "name of school",
        "name of university",
        "academic institution",
    ],
    "degree": [
        "highest degree earned",
        "degree pursued",
        "degree program",
        "level of study",
    ],
    "discipline": [
        "field of study",
        "academic discipline",
        "major area of study",
    ],
    "start_month": [
        "start month",
        "education start month",
    ],
    "start_year": [
        "start year",
        "education start year",
    ],
    "end_month": [
        "graduation month",
        "end month",
    ],
    "end_year": [
        "graduation year",
        "end year",
    ],
    "graduation_date": [
        "anticipated graduation",
        "expected graduation date",
        "expected grad date",
    ],
    "graduation_window": [
        "when will you graduate",
        "class year",
        "graduation term",
    ],
    "relocation": [
        "open to relocation",
        "willing to move",
        "willing to relocate for this position",
    ],
    "heard_about_us": [
        "applicant source",
        "candidate source",
        "how did you hear about this opportunity",
        "how did you hear about this role",
    ],
    "onsite_preference": [
        "work arrangement preference",
        "work setup preference",
        "preferred work arrangement",
        "preferred work environment",
        "office cadence preference",
    ],
    "weekly_availability_hours": [
        "hours available each week",
        "hours available per week",
        "how many hours can you work",
    ],
    "commute_preference": [
        "distance willing to commute",
        "maximum commute",
        "commuting preference",
    ],
    "work_authorization": [
        "eligible to work",
        "employment authorization",
        "authorized for employment",
    ],
    "sponsorship_required": [
        "employment based visa sponsorship",
        "immigration sponsorship",
        "sponsor your visa",
    ],
    "gender": [
        "self identify your gender",
        "voluntary self identification of gender",
    ],
    "race_ethnicity": [
        "race ethnicity",
        "self identify your race",
        "ethnic background",
    ],
    "veteran_status": [
        "protected veteran status",
        "veteran classification",
    ],
    "disability_status": [
        "voluntary self identification of disability",
        "disability self identification",
        "disability status",
    ],
    "motivation": [
        "why are you interested",
        "why do you want to work here",
        "why this company",
        "why us",
        "why do you want to join",
        "why are you applying",
    ],
}


def normalize_custom_answer_key(key: str) -> str:
    normalized = key.strip().lower()
    return CUSTOM_ANSWER_KEY_ALIASES.get(normalized, normalized)


def normalize_hint_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.strip().lower()).strip()


def build_custom_answer_actions(
    custom_answers: dict[str, str],
    custom_selectors: dict[str, dict[str, str]],
) -> list[PlannedAction]:
    actions: list[PlannedAction] = []

    for key, answer in custom_answers.items():
        spec = custom_selectors.get(normalize_custom_answer_key(key))
        if not spec or not answer:
            continue

        normalized = answer.strip()
        normalized_lower = normalized.lower()

        if normalized_lower in {"yes", "true"} and spec.get("yes_selector"):
            actions.append(PlannedAction("check", spec["yes_selector"], required=False))
            continue

        if normalized_lower in {"no", "false"} and spec.get("no_selector"):
            actions.append(PlannedAction("check", spec["no_selector"], required=False))
            continue

        if spec.get("select_selector"):
            actions.append(
                PlannedAction("select", spec["select_selector"], normalized, required=False)
            )
            continue

        if spec.get("fill_selector"):
            actions.append(
                PlannedAction("fill", spec["fill_selector"], normalized, required=False)
            )

    return actions


def infer_answer_for_field_key(profile: ApplicantProfile, field_key: str) -> str | None:
    custom_answers = {
        normalize_custom_answer_key(key): value
        for key, value in profile.custom_answers.items()
        if value
    }

    def first_non_empty(*values: str) -> str | None:
        for value in values:
            if value and value.strip():
                return value.strip()
        return None

    def match_custom_answer(*keys: str) -> str | None:
        for key in keys:
            value = custom_answers.get(key)
            if value and value.strip():
                return value.strip()
        return None

    def parse_date_parts(value: str) -> tuple[int, int] | None:
        if not value:
            return None
        match = re.search(r"\b(20\d{2})-(\d{2})-\d{2}\b", value)
        if not match:
            match = re.search(r"\b(20\d{2})-(\d{2})\b", value)
        if not match:
            year_match = re.search(r"\b(20\d{2})\b", value)
            if year_match:
                return int(year_match.group(1)), 6
            return None
        return int(match.group(1)), int(match.group(2))

    def infer_degree_level() -> str | None:
        raw = first_non_empty(match_custom_answer("degree"), profile.major)
        if not raw:
            if profile.school or profile.major or profile.graduation:
                return "Bachelor's Degree"
            return None
        normalized = raw.lower()
        if any(token in normalized for token in ("phd", "ph.d", "doctor")):
            return "Doctorate"
        if any(token in normalized for token in ("mba", "master", "ms", "m.s")):
            return "Master's Degree"
        if any(token in normalized for token in ("associate", "aa", "a.a")):
            return "Associate Degree"
        if any(token in normalized for token in ("bachelor", "bs", "b.s", "ba", "b.a")):
            return "Bachelor's Degree"
        if profile.school or profile.major or profile.graduation:
            return "Bachelor's Degree"
        return match_custom_answer("degree")

    def infer_education_timeline(key: str) -> str | None:
        graduation_parts = parse_date_parts(first_non_empty(profile.graduation, match_custom_answer("graduation_date", "graduation")))
        if not graduation_parts:
            return None

        graduation_year, graduation_month = graduation_parts
        if key == "end_year":
            return str(graduation_year)
        if key == "end_month":
            return f"{graduation_month:02d}"
        if key == "start_year":
            return str(graduation_year - 4)
        if key == "start_month":
            return "08"
        return None

    normalized_key = normalize_custom_answer_key(field_key)

    if normalized_key == "school":
        return first_non_empty(profile.school, match_custom_answer("school"))
    if normalized_key == "degree":
        return first_non_empty(infer_degree_level(), match_custom_answer("degree"))
    if normalized_key in {"major", "discipline"}:
        return first_non_empty(profile.major, match_custom_answer("discipline"), match_custom_answer("major"))
    if normalized_key == "gpa":
        return first_non_empty(profile.gpa, match_custom_answer("gpa"))
    if normalized_key == "graduation_date":
        return first_non_empty(profile.graduation, profile.graduation_window, match_custom_answer("graduation_date", "graduation_window"))
    if normalized_key == "graduation_window":
        return first_non_empty(profile.graduation_window, profile.graduation, match_custom_answer("graduation_window", "graduation_date"))
    if normalized_key in {"start_month", "start_year", "end_month", "end_year"}:
        return first_non_empty(match_custom_answer(normalized_key), infer_education_timeline(normalized_key))
    if normalized_key == "start_date":
        return first_non_empty(profile.start_date)
    if normalized_key == "salary_expectation":
        return first_non_empty(profile.salary_expectation)
    if normalized_key == "heard_about_us":
        return first_non_empty(match_custom_answer("heard_about_us"), "Company Website")
    if normalized_key == "onsite_preference":
        return first_non_empty(profile.onsite_preference, match_custom_answer("onsite_preference"))
    if normalized_key == "weekly_availability_hours":
        return first_non_empty(profile.weekly_availability_hours, match_custom_answer("weekly_availability_hours"))
    if normalized_key == "commute_preference":
        return first_non_empty(profile.commute_preference, match_custom_answer("commute_preference"))
    if normalized_key == "relocation":
        return first_non_empty(match_custom_answer("relocation"), "yes")
    if normalized_key == "technologies":
        return first_non_empty(match_custom_answer("technologies"))
    if normalized_key == "work_authorization":
        return first_non_empty(profile.work_authorization, "yes")
    if normalized_key == "sponsorship_required":
        return "yes" if profile.sponsorship_required else "no"
    if normalized_key == "gender":
        return first_non_empty(profile.eeo.get("gender", ""))
    if normalized_key == "race_ethnicity":
        return first_non_empty(profile.eeo.get("race_ethnicity", ""))
    if normalized_key == "veteran_status":
        return first_non_empty(profile.eeo.get("veteran_status", ""))
    if normalized_key == "disability_status":
        return first_non_empty(profile.eeo.get("disability_status", ""))
    if normalized_key == "motivation":
        company_name = first_non_empty(match_custom_answer("company"), "the team")
        return (
            f"I am excited about {company_name} because the work is ambitious, "
            "the team is building meaningful products, and the role matches my "
            "background in software engineering and rapid learning."
        )

    return first_non_empty(match_custom_answer(normalized_key))


def infer_answer_from_hint_aliases(
    profile: ApplicantProfile,
    hint: str,
    hint_aliases: dict[str, list[str]] | None = None,
) -> str | None:
    normalized_hint = normalize_hint_text(hint)
    if not normalized_hint:
        return None

    merged_aliases = dict(STANDARD_HINT_ALIASES)
    if hint_aliases:
        for key, aliases in hint_aliases.items():
            merged_aliases.setdefault(key, []).extend(aliases)

    for field_key, aliases in merged_aliases.items():
        for alias in aliases:
            normalized_alias = normalize_hint_text(alias)
            if normalized_alias and normalized_alias in normalized_hint:
                answer = infer_answer_for_field_key(profile, field_key)
                if answer:
                    return answer

    return None


def classify_blocked_field_family(error: str) -> str | None:
    normalized = error.strip().lower()
    if not normalized:
        return None

    if any(
        token in normalized
        for token in ("email", "phone", "linkedin", "website", "portfolio", "name is required")
    ):
        return "contact"

    if any(token in normalized for token in ("resume", "cv", "cover letter")):
        return "resume"

    if any(
        token in normalized
        for token in ("work authorization", "authorized", "sponsorship", "visa")
    ):
        return "authorization"

    if any(
        token in normalized
        for token in ("school", "degree", "major", "gpa", "graduation")
    ):
        return "education"

    if any(
        token in normalized
        for token in ("start date", "availability", "hours", "onsite", "relocation", "commute")
    ):
        return "availability"

    if any(
        token in normalized
        for token in (
            "gender",
            "race",
            "ethnicity",
            "veteran",
            "disability",
            "equal employment",
            "eeo",
        )
    ):
        return "eeo"

    if any(
        token in normalized
        for token in (
            "why are you interested",
            "why do you want",
            "why this company",
            "why us",
            "why are you applying",
        )
    ):
        return "custom"

    if any(
        token in normalized
        for token in ("required", "please enter", "please select", "complete this field")
    ):
        return "custom"

    return None


def resolve_blocked_field_family(
    error: str,
    runtime_hints: dict[str, object] | None = None,
) -> BlockedFieldFamily | None:
    family = classify_blocked_field_family(error)
    if family and family != "custom":
        return family

    hinted_family = (
        runtime_hints.get("likely_blocked_family")
        if runtime_hints and isinstance(runtime_hints.get("likely_blocked_family"), str)
        else None
    )
    if hinted_family in {
        "contact",
        "resume",
        "authorization",
        "education",
        "availability",
        "eeo",
    }:
        return hinted_family

    hinted_families = (
        runtime_hints.get("historical_blocked_families")
        if runtime_hints and isinstance(runtime_hints.get("historical_blocked_families"), list)
        else []
    )
    for hinted in hinted_families:
        if hinted in {
            "contact",
            "resume",
            "authorization",
            "education",
            "availability",
            "eeo",
        }:
            return hinted

    return family


def build_recovery_actions(
    profile: ApplicantProfile,
    family: str,
    selectors: dict[str, str],
    custom_selectors: dict[str, dict[str, str]],
) -> list[PlannedAction]:
    actions: list[PlannedAction] = []

    if family == "contact":
        contact_map = (
            ("first_name", profile.first_name),
            ("last_name", profile.last_name),
            ("name", f"{profile.first_name} {profile.last_name}".strip()),
            ("email", profile.email),
            ("phone", profile.phone),
            ("linkedin", profile.linkedin),
            ("website", profile.website),
        )
        for key, value in contact_map:
            selector = selectors.get(key)
            if selector and value:
                actions.append(PlannedAction("fill", selector, value, required=False))
        return actions

    if family == "resume":
        selector = selectors.get("resume_upload")
        if selector and profile.resume_pdf_path:
            actions.append(PlannedAction("upload", selector, profile.resume_pdf_path, required=False))
        return actions

    if family == "authorization":
        selector = selectors.get("work_authorization")
        if selector and profile.work_authorization:
            actions.append(PlannedAction("select", selector, profile.work_authorization, required=False))

        authorized_selector = (
            selectors.get("authorized_yes")
            if profile.work_authorization
            else selectors.get("authorized_no")
        )
        if authorized_selector:
            actions.append(PlannedAction("check", authorized_selector, required=False))

        sponsorship_selector = (
            selectors.get("sponsorship_yes")
            if profile.sponsorship_required
            else selectors.get("sponsorship_no")
        )
        if sponsorship_selector:
            actions.append(PlannedAction("check", sponsorship_selector, required=False))
        return actions

    if family == "education":
        recovery_answers: dict[str, str] = {}
        if profile.school:
            recovery_answers["school"] = profile.school
        if profile.major:
            recovery_answers["degree"] = infer_answer_for_field_key(profile, "degree") or profile.major
            recovery_answers["discipline"] = profile.major
        if profile.graduation:
            recovery_answers["graduation_date"] = profile.graduation
            for timeline_key in ("start_month", "start_year", "end_month", "end_year"):
                timeline_value = infer_answer_for_field_key(profile, timeline_key)
                if timeline_value:
                    recovery_answers[timeline_key] = timeline_value
        if profile.gpa:
            recovery_answers["gpa"] = profile.gpa
        return build_custom_answer_actions(recovery_answers, custom_selectors)

    if family == "availability":
        recovery_answers: dict[str, str] = {}
        if profile.start_date and selectors.get("start_date"):
            actions.append(
                PlannedAction("fill", selectors["start_date"], profile.start_date, required=False)
            )
        if profile.location_preference and selectors.get("location_preference"):
            actions.append(
                PlannedAction(
                    "fill",
                    selectors["location_preference"],
                    profile.location_preference,
                    required=False,
                )
            )
        if profile.salary_expectation and selectors.get("salary_expectation"):
            actions.append(
                PlannedAction(
                    "fill",
                    selectors["salary_expectation"],
                    profile.salary_expectation,
                    required=False,
                )
            )
        if profile.onsite_preference:
            recovery_answers["onsite_preference"] = profile.onsite_preference
        if profile.weekly_availability_hours:
            recovery_answers["weekly_availability_hours"] = profile.weekly_availability_hours
        if profile.graduation_window:
            recovery_answers["graduation_window"] = profile.graduation_window
        if profile.commute_preference:
            recovery_answers["commute_preference"] = profile.commute_preference
        if profile.custom_answers.get("relocation"):
            recovery_answers["relocation"] = profile.custom_answers["relocation"]
        actions.extend(build_custom_answer_actions(recovery_answers, custom_selectors))
        return actions

    if family == "eeo":
        recovery_answers: dict[str, str] = {}
        for key, value in profile.eeo.items():
            if value:
                recovery_answers[normalize_custom_answer_key(key)] = value
        return build_custom_answer_actions(recovery_answers, custom_selectors)

    return actions


async def attempt_recovery_for_blocked_family(
    page: Any,
    profile: ApplicantProfile,
    error: str,
    *,
    selectors: dict[str, str],
    custom_selectors: dict[str, dict[str, str]],
    runtime_hints: dict[str, object] | None = None,
    hint_aliases: dict[str, list[str]] | None = None,
) -> str | None:
    family = resolve_blocked_field_family(error, runtime_hints)
    if not family:
        return None

    actions = [] if family == "custom" else build_recovery_actions(profile, family, selectors, custom_selectors)
    recovered = False

    if actions:
        await execute_actions(page, actions)
        recovered = True

    alias_fills = await fill_detected_questions_by_hint(page, profile, hint_aliases)
    if alias_fills:
        recovered = True

    return family if recovered else None


def build_common_contact_actions(
    profile: ApplicantProfile,
    *,
    phone_selector: str,
    linkedin_selector: str,
    website_selector: str,
    resume_selector: str,
    work_authorization_selector: str,
    start_date_selector: str,
    location_preference_selector: str,
    salary_expectation_selector: str,
    authorized_yes_selector: str,
    authorized_no_selector: str,
    sponsorship_yes_selector: str,
    sponsorship_no_selector: str,
    custom_selectors: dict[str, dict[str, str]],
) -> list[PlannedAction]:
    actions = []
    normalized_custom_answers = dict(profile.custom_answers)

    if profile.phone:
        actions.append(
            PlannedAction("fill", phone_selector, profile.phone, required=False)
        )

    if profile.linkedin:
        actions.append(
            PlannedAction(
                "fill",
                linkedin_selector,
                profile.linkedin,
                required=False,
            )
        )

    if profile.website:
        actions.append(
            PlannedAction("fill", website_selector, profile.website, required=False)
        )

    if profile.resume_pdf_path:
        actions.append(PlannedAction("upload", resume_selector, profile.resume_pdf_path))

    if profile.start_date:
        actions.append(
            PlannedAction("fill", start_date_selector, profile.start_date, required=False)
        )

    if profile.location_preference:
        actions.append(
            PlannedAction(
                "fill",
                location_preference_selector,
                profile.location_preference,
                required=False,
            )
        )

    if profile.salary_expectation:
        actions.append(
            PlannedAction(
                "fill",
                salary_expectation_selector,
                profile.salary_expectation,
                required=False,
            )
        )

    if profile.work_authorization:
        actions.append(
            PlannedAction(
                "select",
                work_authorization_selector,
                profile.work_authorization,
                required=False,
            )
        )
        actions.append(
            PlannedAction(
                "check",
                authorized_yes_selector,
                required=False,
            )
        )
    else:
        actions.append(
            PlannedAction(
                "check",
                authorized_no_selector,
                required=False,
            )
        )

    actions.append(
        PlannedAction(
            "check",
            sponsorship_yes_selector if profile.sponsorship_required else sponsorship_no_selector,
            required=False,
        )
    )

    if profile.onsite_preference:
        normalized_custom_answers.setdefault("onsite_preference", profile.onsite_preference)

    if profile.weekly_availability_hours:
        normalized_custom_answers.setdefault(
            "weekly_availability_hours",
            profile.weekly_availability_hours,
        )

    if profile.graduation_window:
        normalized_custom_answers.setdefault("graduation_window", profile.graduation_window)

    if profile.commute_preference:
        normalized_custom_answers.setdefault("commute_preference", profile.commute_preference)

    if profile.school:
        normalized_custom_answers.setdefault("school", profile.school)

    degree_value = infer_answer_for_field_key(profile, "degree")
    if degree_value:
        normalized_custom_answers.setdefault("degree", degree_value)

    discipline_value = infer_answer_for_field_key(profile, "discipline")
    if discipline_value:
        normalized_custom_answers.setdefault("discipline", discipline_value)

    if profile.gpa:
        normalized_custom_answers.setdefault("gpa", profile.gpa)

    graduation_date_value = infer_answer_for_field_key(profile, "graduation_date")
    if graduation_date_value:
        normalized_custom_answers.setdefault("graduation_date", graduation_date_value)

    for timeline_key in ("start_month", "start_year", "end_month", "end_year"):
        timeline_value = infer_answer_for_field_key(profile, timeline_key)
        if timeline_value:
            normalized_custom_answers.setdefault(timeline_key, timeline_value)

    for eeo_key, eeo_value in profile.eeo.items():
        if eeo_value:
            normalized_custom_answers.setdefault(normalize_custom_answer_key(eeo_key), eeo_value)

    actions.extend(build_custom_answer_actions(normalized_custom_answers, custom_selectors))

    return actions


SCAN_FORM_QUESTIONS_SCRIPT = """
() => {
  const isVisible = (el) => {
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  };

  const normalize = (value) => value.replace(/\\s+/g, " ").trim();
  const selectorFor = (el) => {
    if (el.id) return `#${el.id}`;
    if (el.name) return `${el.tagName.toLowerCase()}[name="${el.name}"]`;
    return null;
  };

  const getGroupLabel = (el) => {
    const group = el.closest("fieldset, [role='group'], .application-question, .application-field, .field");
    const label = group?.querySelector(
      ".application-label .text, legend, h3, h4, label, [data-qa='question-description']"
    );
    if (label?.textContent) return label.textContent;
    return "";
  };

  const getLabel = (el) => {
    const aria = el.getAttribute("aria-label");
    if (aria) return aria;
    const groupLabel = getGroupLabel(el);
    if (groupLabel) return groupLabel;
    if (el.id) {
      const explicit = document.querySelector(`label[for="${el.id}"]`);
      if (explicit?.textContent) return explicit.textContent;
    }
    const wrapped = el.closest("label");
    if (wrapped?.textContent) return wrapped.textContent;
    return el.getAttribute("placeholder") || el.getAttribute("name") || el.getAttribute("id") || "";
  };

  const elements = Array.from(document.querySelectorAll("input, select, textarea"))
    .filter((el) => isVisible(el) && !el.disabled);

      const radioGroups = new Map();
      const checkboxGroups = new Map();
      const descriptors = [];

      for (const el of elements) {
        const tag = el.tagName.toLowerCase();
        const selector = selectorFor(el);
        if (!selector) continue;

    if (el instanceof HTMLInputElement && el.type === "radio" && el.name) {
      const hint = normalize(getGroupLabel(el) || getLabel(el));
      if (!radioGroups.has(el.name)) {
        radioGroups.set(el.name, {
          type: "radio_group",
          selector: `input[name="${el.name}"]`,
          hint,
          required: el.required,
          options: [],
        });
      }

      const optionLabel = (() => {
        if (el.id) {
          const label = document.querySelector(`label[for="${el.id}"]`);
          if (label?.textContent) return normalize(label.textContent);
        }
        const wrapped = el.closest("label");
        if (wrapped?.textContent) return normalize(wrapped.textContent);
        return normalize(el.value || "option");
      })();

      radioGroups.get(el.name).options.push({
        selector,
        value: normalize(el.value || optionLabel),
        label: optionLabel,
      });
      continue;
      }

      if (el instanceof HTMLInputElement && el.type === "checkbox" && el.name) {
        const hint = normalize(getGroupLabel(el) || getLabel(el));
        if (!checkboxGroups.has(el.name)) {
          checkboxGroups.set(el.name, {
            type: "checkbox_group",
            selector: `input[name="${el.name}"]`,
            hint,
            required: el.required,
            options: [],
          });
        }

        const optionLabel = (() => {
          if (el.id) {
            const label = document.querySelector(`label[for="${el.id}"]`);
            if (label?.textContent) return normalize(label.textContent);
          }
          const wrapped = el.closest("label");
          if (wrapped?.textContent) return normalize(wrapped.textContent);
          return normalize(el.value || "option");
        })();

        checkboxGroups.get(el.name).options.push({
          selector,
          value: normalize(el.value || optionLabel),
          label: optionLabel,
        });
        continue;
      }

      descriptors.push({
        type:
          el instanceof HTMLTextAreaElement
            ? "textarea"
          : el instanceof HTMLSelectElement
            ? "select"
            : el instanceof HTMLInputElement && el.type === "checkbox"
              ? "checkbox"
              : tag === "input"
                ? (el.getAttribute("type") || "text")
                : tag,
      selector,
      hint: normalize(getLabel(el)),
      required: Boolean(el.required || el.getAttribute("aria-required") === "true"),
      options:
        el instanceof HTMLSelectElement
          ? Array.from(el.options)
              .map((option) => ({
                selector: selector,
                value: normalize(option.value),
                label: normalize(option.textContent || option.value),
              }))
              .filter((option) => option.value || option.label)
          : [],
      checked: el instanceof HTMLInputElement && el.type === "checkbox" ? el.checked : false,
    });
  }

  return descriptors
    .concat(Array.from(radioGroups.values()))
    .concat(Array.from(checkboxGroups.values()));
}
"""


GREENHOUSE_METADATA_QUESTIONS_SCRIPT = """
() => {
  const routeData = window.__remixContext?.state?.loaderData?.["routes/$url_token_.jobs_.$job_post_id"];
  const jobPost = routeData?.jobPost;
  if (!jobPost) return [];

  const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim();
  const descriptors = [];

  const pushQuestion = (question) => {
    const hint = normalize(question?.label);
    if (!hint || !Array.isArray(question?.fields)) return;

    for (const field of question.fields) {
      const name = field?.name;
      const fieldType = field?.type;
      if (!name || !fieldType) continue;

      if (fieldType === "input_text") {
        descriptors.push({
          type: "text",
          selector: `#${name}`,
          hint,
          required: Boolean(question.required),
          options: [],
        });
      } else if (fieldType === "textarea") {
        descriptors.push({
          type: "textarea",
          selector: `#${name}`,
          hint,
          required: Boolean(question.required),
          options: [],
        });
      } else if (fieldType === "multi_value_single_select") {
        descriptors.push({
          type: "combobox_select",
          selector: `#${name}`,
          hint,
          required: Boolean(question.required),
          options: Array.isArray(field.values)
            ? field.values.map((option) => ({
                selector: `#${name}`,
                value: normalize(String(option.value)),
                label: normalize(option.label),
              }))
            : [],
        });
      }
    }
  };

  for (const question of jobPost.questions || []) {
    pushQuestion(question);
  }

  for (const section of jobPost.eeoc_sections || []) {
    for (const question of section.questions || []) {
      pushQuestion(question);
    }
  }

  const education = jobPost.education_config || {};
  const educationFields = [
    ["school_name", "School", "#school--0", "combobox_select"],
    ["degree", "Degree", "#degree--0", "combobox_select"],
    ["discipline", "Discipline", "#discipline--0", "combobox_select"],
    ["start_month", "Start date month", "#start-month--0", "combobox_select"],
    ["start_year", "Start date year", "#start-year--0", "number"],
    ["end_month", "End date month", "#end-month--0", "combobox_select"],
    ["end_year", "End date year", "#end-year--0", "number"],
  ];

  for (const [key, label, selector, fieldType] of educationFields) {
    if (education[key] && education[key] !== "hidden") {
      descriptors.push({
        type: fieldType,
        selector,
        hint: label,
        required: education[key] === "required",
        options: [],
      });
    }
  }

  return descriptors;
}
"""


LEVER_METADATA_QUESTIONS_SCRIPT = """
() => {
  const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim();
  const descriptors = [];
  const templateInputs = Array.from(
    document.querySelectorAll('input[type="hidden"][name$="[baseTemplate]"]')
  );

  const parseCardId = (name) => {
    const match = name.match(/^cards\\[([^\\]]+)\\]\\[baseTemplate\\]$/);
    return match ? match[1] : "";
  };

  const selectorForField = (cardId, index, type) => {
    const fieldName = `cards[${cardId}][field${index}]`;
    if (type === "textarea") {
      return `textarea[name="${fieldName}"]`;
    }
    return `input[name="${fieldName}"], textarea[name="${fieldName}"], select[name="${fieldName}"]`;
  };

  for (const input of templateInputs) {
    const cardId = parseCardId(input.name || "");
    if (!cardId) continue;

    let template;
    try {
      template = JSON.parse(input.value || "{}");
    } catch (_error) {
      continue;
    }

    const fields = Array.isArray(template?.fields) ? template.fields : [];
    fields.forEach((field, index) => {
      const text = normalize(field?.text);
      if (!text) return;

      const fieldType = String(field?.type || "text");
      descriptors.push({
        type: fieldType === "textarea" ? "textarea" : "text",
        selector: selectorForField(cardId, index, fieldType),
        hint: text,
        required: Boolean(field?.required),
        options: [],
      });
    });
  }

  return descriptors;
}
"""


LEVER_ERROR_FIELD_METADATA_SCRIPT = """
({ fieldNames }) => {
  const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim();
  const requested = new Set(Array.isArray(fieldNames) ? fieldNames : []);
  const descriptors = [];
  const templateInputs = Array.from(
    document.querySelectorAll('input[name$="[baseTemplate]"]')
  );

  const parseCardId = (name) => {
    const match = name.match(/^cards\\[([^\\]]+)\\]\\[baseTemplate\\]$/);
    return match ? match[1] : "";
  };

  for (const input of templateInputs) {
    const cardId = parseCardId(input.name || "");
    if (!cardId) continue;

    let template;
    try {
      template = JSON.parse(input.value || "{}");
    } catch (_error) {
      continue;
    }

    const fields = Array.isArray(template?.fields) ? template.fields : [];
    fields.forEach((field, index) => {
      const fieldName = `cards[${cardId}][field${index}]`;
      if (!requested.has(fieldName)) return;

      const selector = field?.type === "textarea"
        ? `textarea[name="${fieldName}"]`
        : `input[name="${fieldName}"], textarea[name="${fieldName}"], select[name="${fieldName}"]`;

      descriptors.push({
        type: field?.type === "textarea" ? "textarea" : "text",
        selector,
        hint: normalize(field?.text || fieldName),
        required: Boolean(field?.required),
        options: [],
      });
    });
  }

  return descriptors;
}
"""


async def scan_form_questions(page: Any) -> list[dict[str, object]]:
    evaluate = getattr(page, "evaluate", None)
    if not callable(evaluate):
        return []

    descriptors: list[dict[str, object]] = []

    try:
        scanned = await evaluate(SCAN_FORM_QUESTIONS_SCRIPT)
        if isinstance(scanned, list):
            descriptors.extend(item for item in scanned if isinstance(item, dict))
    except Exception:
        pass

    try:
        greenhouse_scanned = await evaluate(GREENHOUSE_METADATA_QUESTIONS_SCRIPT)
        if isinstance(greenhouse_scanned, list):
            existing_index = {
                (str(item.get("selector", "")), str(item.get("hint", "")).lower()): index
                for index, item in enumerate(descriptors)
            }
            for item in greenhouse_scanned:
                if not isinstance(item, dict):
                    continue
                key = (str(item.get("selector", "")), str(item.get("hint", "")).lower())
                if key in existing_index:
                    current = descriptors[existing_index[key]]
                    current_type = str(current.get("type", ""))
                    incoming_type = str(item.get("type", ""))
                    current_options = current.get("options")
                    incoming_options = item.get("options")

                    should_replace = (
                        incoming_type == "combobox_select"
                        and current_type != "combobox_select"
                    ) or (
                        isinstance(incoming_options, list)
                        and len(incoming_options) > 0
                        and (not isinstance(current_options, list) or len(current_options) == 0)
                    )

                    if should_replace:
                        descriptors[existing_index[key]] = item
                    continue
                descriptors.append(item)
    except Exception:
        pass

    try:
        lever_scanned = await evaluate(LEVER_METADATA_QUESTIONS_SCRIPT)
        if isinstance(lever_scanned, list):
            existing_by_key = {
                (str(item.get("selector", "")), str(item.get("hint", "")).lower()): index
                for index, item in enumerate(descriptors)
            }
            existing_by_selector = {
                str(item.get("selector", "")): index
                for index, item in enumerate(descriptors)
            }
            for item in lever_scanned:
                if not isinstance(item, dict):
                    continue
                key = (str(item.get("selector", "")), str(item.get("hint", "")).lower())
                selector = str(item.get("selector", ""))
                existing_index = existing_by_key.get(key)
                if existing_index is None and selector:
                    existing_index = existing_by_selector.get(selector)

                if existing_index is not None:
                    current = descriptors[existing_index]
                    current_required = bool(current.get("required"))
                    incoming_required = bool(item.get("required"))
                    current_hint = str(current.get("hint", "")).strip()
                    incoming_hint = str(item.get("hint", "")).strip()

                    should_replace = incoming_required and not current_required
                    if not should_replace and len(incoming_hint) > len(current_hint):
                        should_replace = True

                    if should_replace:
                        descriptors[existing_index] = item
                    continue
                descriptors.append(item)
    except Exception:
        pass

    return descriptors


def infer_answer_for_hint(
    profile: ApplicantProfile,
    hint: str,
    options: list[dict[str, str]] | None = None,
    hint_aliases: dict[str, list[str]] | None = None,
) -> str | None:
    normalized = hint.strip().lower()
    if not normalized:
        return None

    normalized_hint_key = normalize_hint_text(hint)
    for key, value in profile.custom_answers.items():
        if not value or not isinstance(value, str):
            continue
        if normalize_hint_text(key) == normalized_hint_key:
            return value.strip()

    def normalized_option_text() -> str:
        return " ".join(
            f"{option.get('label', '')} {option.get('value', '')}".lower()
            for option in (options or [])
        )

    if any(keyword in normalized for keyword in ("linkedin", "github", "website", "portfolio", "first name", "last name", "full name", "email", "phone", "location")):
        return None

    if any(keyword in normalized for keyword in ("school", "university", "college", "institution")):
        return infer_answer_for_field_key(profile, "school")
    if any(keyword in normalized for keyword in ("major", "field of study", "concentration", "discipline")):
        return infer_answer_for_field_key(profile, "discipline")
    if any(
        keyword in normalized
        for keyword in (
            "are you legally authorized",
            "are you currently legally authorized",
            "u.s. citizen",
            "lawful permanent resident",
            "protected individual",
            "required authorizations from the u.s. department of state",
        )
    ):
        return "yes" if profile.work_authorization else "no"
    if any(
        keyword in normalized
        for keyword in (
            "bound by any agreements",
            "restrict your ability to work",
            "non compete",
            "non solicitation",
            "confidentiality or non disclosure agreements",
            "will you now or in the future require company sponsorship",
            "will you now or in the future require employment based visa sponsorship",
            "will you now or in the future require sponsorship",
        )
    ):
        if any(
            keyword in normalized
            for keyword in (
                "bound by any agreements",
                "restrict your ability to work",
                "non compete",
                "non solicitation",
                "confidentiality or non disclosure agreements",
            )
        ):
            return "no"
        return "yes" if profile.sponsorship_required else "no"
    if "degree" in normalized:
        return infer_answer_for_field_key(profile, "degree")
    if "gpa" in normalized:
        return infer_answer_for_field_key(profile, "gpa")
    if any(keyword in normalized for keyword in ("graduation", "graduate", "class year", "expected grad")):
        return infer_answer_for_field_key(profile, "graduation_date")
    if any(
        keyword in normalized
        for keyword in (
            "start date",
            "available",
            "earliest start",
            "when can you start",
            "start internship",
            "available to start",
        )
    ):
        return infer_answer_for_field_key(profile, "start_date")
    if any(keyword in normalized for keyword in ("salary", "compensation", "pay")):
        return infer_answer_for_field_key(profile, "salary_expectation")
    if any(keyword in normalized for keyword in ("how did you hear", "where did you hear", "source", "referral")):
        return infer_answer_for_field_key(profile, "heard_about_us")
    if any(keyword in normalized for keyword in ("onsite", "on-site", "hybrid", "work mode")):
        return infer_answer_for_field_key(profile, "onsite_preference")
    if any(keyword in normalized for keyword in ("hours per week", "weekly availability", "availability hours")):
        return infer_answer_for_field_key(profile, "weekly_availability_hours")
    if any(keyword in normalized for keyword in ("commute", "travel distance", "commute radius")):
        return infer_answer_for_field_key(profile, "commute_preference")
    if any(keyword in normalized for keyword in ("relocate", "relocation")):
        return infer_answer_for_field_key(profile, "relocation")
    if any(keyword in normalized for keyword in ("technology", "technologies", "skills", "programming language", "languages")):
        return infer_answer_for_field_key(profile, "technologies")
    if any(keyword in normalized for keyword in ("authorized to work", "work authorization", "legally authorized")):
        return infer_answer_for_field_key(profile, "work_authorization")
    if any(keyword in normalized for keyword in ("sponsorship", "visa", "require sponsorship")):
        return infer_answer_for_field_key(profile, "sponsorship_required")
    if "gender" in normalized or "sex" in normalized:
        return infer_answer_for_field_key(profile, "gender")
    if "race" in normalized or "ethnicity" in normalized:
        return infer_answer_for_field_key(profile, "race_ethnicity")
    if "veteran" in normalized:
        return infer_answer_for_field_key(profile, "veteran_status")
    if "disability" in normalized:
        return infer_answer_for_field_key(profile, "disability_status")
    if any(
        keyword in normalized
        for keyword in (
            "why are you interested",
            "why do you want",
            "why this company",
            "why us",
            "why join",
            "why are you applying",
            "why rendezvous",
            "why this role",
        )
    ):
        return infer_answer_for_field_key(profile, "motivation")

    alias_answer = infer_answer_from_hint_aliases(profile, hint, hint_aliases)
    if alias_answer:
        return alias_answer

    if options:
        option_text = normalized_option_text()
        if "yes" in option_text and any(keyword in normalized for keyword in ("relocate", "sponsorship", "authorized", "work authorization")):
            if "sponsorship" in normalized:
                return infer_answer_for_field_key(profile, "sponsorship_required")
            return infer_answer_for_field_key(profile, "work_authorization")
        if any(keyword in option_text for keyword in ("open to onsite", "onsite", "remote", "hybrid")) and any(keyword in normalized for keyword in ("onsite", "work mode", "hybrid")):
            return infer_answer_for_field_key(profile, "onsite_preference")

    return None


def resolve_option_selector(
    answer: str,
    options: list[dict[str, str]],
) -> str | None:
    normalized_answer = answer.strip().lower()
    if not normalized_answer:
        return None

    def normalized_values(option: dict[str, str]) -> list[str]:
        return [
            option.get("label", "").strip().lower(),
            option.get("value", "").strip().lower(),
        ]

    def canonicalize(value: str) -> str:
        normalized = value.strip().lower()
        normalized = re.sub(r"[^a-z0-9]+", " ", normalized).strip()
        month_names = {
            "01": "january",
            "1": "january",
            "02": "february",
            "2": "february",
            "03": "march",
            "3": "march",
            "04": "april",
            "4": "april",
            "05": "may",
            "5": "may",
            "06": "june",
            "6": "june",
            "07": "july",
            "7": "july",
            "08": "august",
            "8": "august",
            "09": "september",
            "9": "september",
            "10": "october",
            "11": "november",
            "12": "december",
        }
        if normalized in month_names:
            return month_names[normalized]

        replacements = (
            ("open to onsite", "onsite"),
            ("on site", "onsite"),
            ("hybrid preferred", "hybrid"),
            ("remote only", "remote"),
            ("us citizen", "citizen"),
            ("u s citizen", "citizen"),
            ("citizen or permanent resident", "citizen"),
            ("green card", "permanent resident"),
            ("permanent resident", "permanent resident"),
            ("authorized to work for any employer", "authorized"),
            ("legally authorized to work", "authorized"),
            ("do not require sponsorship", "no sponsorship"),
            ("will not require sponsorship", "no sponsorship"),
            ("no sponsorship required", "no sponsorship"),
            ("prefer not to answer", "decline"),
            ("prefer not to self identify", "decline"),
            ("decline to answer", "decline"),
            ("i am not a protected veteran", "not veteran"),
            ("not a protected veteran", "not veteran"),
            ("no i do not have a disability", "no disability"),
            ("i do not have a disability", "no disability"),
            ("asian", "asian"),
            ("woman", "female"),
            ("man", "male"),
            ("woman", "woman"),
            ("b s ", "bachelor"),
            ("bs ", "bachelor"),
            ("bachelor of science", "bachelor"),
            ("bachelors", "bachelor"),
            ("bachelor s", "bachelor"),
            ("m s ", "master"),
            ("ms ", "master"),
            ("master of science", "master"),
            ("masters", "master"),
            ("master s", "master"),
        )

        for source, target in replacements:
            if source in normalized:
                return target

        hours_match = re.search(r"\b(\d{1,2})\b", normalized)
        if hours_match and any(token in normalized for token in ("hour", "week", "weekly")):
            return hours_match.group(1)

        graduation_match = re.search(r"\b(20\d{2})\b", normalized)
        if graduation_match and any(
            token in normalized
            for token in ("graduat", "class", "grad", "year")
        ):
            return graduation_match.group(1)

        if "computer science" in normalized:
            return "computer science"

        return normalized

    canonical_answer = canonicalize(answer)

    for option in options:
        values = normalized_values(option)
        if normalized_answer in values or canonical_answer in {canonicalize(value) for value in values if value}:
            return option.get("selector")

    if normalized_answer in {"yes", "true"}:
        for option in options:
            values = normalized_values(option)
            if any(value in {"yes", "true"} or canonicalize(value) in {"yes", "true"} for value in values):
                return option.get("selector")

    if normalized_answer in {"no", "false"}:
        for option in options:
            values = normalized_values(option)
            if any(value in {"no", "false"} or canonicalize(value) in {"no", "false"} for value in values):
                return option.get("selector")

    if canonical_answer in {"authorized", "citizen", "permanent resident"}:
        for option in options:
            values = normalized_values(option)
            if any(
                canonicalize(value) in {"authorized", "citizen", "permanent resident"}
                for value in values
            ):
                return option.get("selector")

    if canonical_answer in {"no sponsorship", "decline", "no disability", "not veteran"}:
        for option in options:
            values = normalized_values(option)
            if any(
                canonicalize(value) == canonical_answer
                for value in values
            ):
                return option.get("selector")

    for option in options:
        values = normalized_values(option)
        if any(normalized_answer in value or canonical_answer in canonicalize(value) for value in values if value):
            return option.get("selector")

    answer_words = {word for word in re.split(r"[^a-z0-9]+", canonical_answer) if word}
    if answer_words:
        best_selector = None
        best_score = 0
        for option in options:
            values = " ".join(canonicalize(value) for value in normalized_values(option) if value)
            option_words = {word for word in re.split(r"[^a-z0-9]+", values) if word}
            score = len(answer_words & option_words)
            if score > best_score:
                best_score = score
                best_selector = option.get("selector")
        if best_score > 0:
            return best_selector

    return None


def resolve_option_value(answer: str, options: list[dict[str, str]]) -> str:
    normalized_answer = answer.strip().lower()
    if not normalized_answer:
        return answer

    def canonicalize(value: str) -> str:
        normalized = value.strip().lower()
        normalized = re.sub(r"[^a-z0-9]+", " ", normalized).strip()
        month_names = {
            "01": "january",
            "1": "january",
            "02": "february",
            "2": "february",
            "03": "march",
            "3": "march",
            "04": "april",
            "4": "april",
            "05": "may",
            "5": "may",
            "06": "june",
            "6": "june",
            "07": "july",
            "7": "july",
            "08": "august",
            "8": "august",
            "09": "september",
            "9": "september",
            "10": "october",
            "11": "november",
            "12": "december",
        }
        if normalized in month_names:
            return month_names[normalized]
        if "open to onsite" in normalized or "on site" in normalized:
            return "onsite"
        if "hybrid" in normalized:
            return "hybrid"
        if "remote only" in normalized:
            return "remote"
        if "us citizen" in normalized or "u s citizen" in normalized:
            return "citizen"
        if "citizen or permanent resident" in normalized:
            return "citizen"
        if "green card" in normalized or "permanent resident" in normalized:
            return "permanent resident"
        if "woman" in normalized:
            return "female"
        if normalized == "man" or " man " in f" {normalized} ":
            return "male"
        if "authorized to work for any employer" in normalized or "legally authorized to work" in normalized:
            return "authorized"
        if "do not require sponsorship" in normalized or "will not require sponsorship" in normalized or "no sponsorship required" in normalized:
            return "no sponsorship"
        if "prefer not to answer" in normalized or "prefer not to self identify" in normalized or "decline to answer" in normalized:
            return "decline"
        if "not a protected veteran" in normalized:
            return "not veteran"
        if "do not have a disability" in normalized:
            return "no disability"
        if any(token in normalized for token in ("bachelor of science", "bachelors", "bachelor s", " b s ", "bs ")):
            return "bachelor"
        if any(token in normalized for token in ("master of science", "masters", "master s", " m s ", "ms ")):
            return "master"
        hours_match = re.search(r"\b(\d{1,2})\b", normalized)
        if hours_match and any(token in normalized for token in ("hour", "week", "weekly")):
            return hours_match.group(1)
        graduation_match = re.search(r"\b(20\d{2})\b", normalized)
        if graduation_match and any(
            token in normalized
            for token in ("graduat", "class", "grad", "year")
        ):
            return graduation_match.group(1)
        if "computer science" in normalized:
            return "computer science"
        return normalized

    canonical_answer = canonicalize(answer)

    for option in options:
        label = option.get("label", "").strip()
        value = option.get("value", "").strip()
        if normalized_answer in {label.lower(), value.lower()}:
            return value or label or answer
        if canonical_answer in {canonicalize(label), canonicalize(value)}:
            return value or label or answer

    selector = resolve_option_selector(answer, options)
    if selector:
        for option in options:
            if option.get("selector") == selector:
                return option.get("value") or option.get("label") or answer

    return answer


def resolve_combobox_text(answer: str, options: list[dict[str, str]]) -> str:
    normalized_answer = answer.strip()
    if not normalized_answer or not options:
        return answer

    selector = resolve_option_selector(answer, options)
    if not selector:
        return answer

    for option in options:
        if option.get("selector") != selector:
            continue
        label = option.get("label", "").strip()
        value = option.get("value", "").strip()
        return label or value or answer

    return answer


async def fill_detected_questions_by_hint(
    page: Any,
    profile: ApplicantProfile,
    hint_aliases: dict[str, list[str]] | None = None,
) -> list[str]:
    descriptors = await scan_form_questions(page)
    if not descriptors:
        return []

    filled_hints: list[str] = []

    for descriptor in descriptors:
        if not isinstance(descriptor, dict):
            continue

        hint = normalize_confirmation_text(str(descriptor.get("hint", "")), limit=160).lower()
        selector = descriptor.get("selector")
        field_type = descriptor.get("type")
        options = descriptor.get("options") if isinstance(descriptor.get("options"), list) else []

        if not hint or not isinstance(selector, str) or not selector:
            continue

        answer = infer_answer_for_hint(profile, hint, options, hint_aliases)
        if not answer:
            continue

        try:
            if not await selector_exists(page, selector):
                continue

            target_selector = await get_preferred_selector(page, selector)
            if field_type in {"text", "textarea", "email", "tel", "number", "date"}:
                await page.fill(target_selector, answer)
                filled_hints.append(hint)
            elif field_type == "select":
                await page.select_option(target_selector, resolve_option_value(answer, options))
                filled_hints.append(hint)
            elif field_type == "combobox_select":
                combobox_text = resolve_combobox_text(answer, options)
                await fill_combobox_input(page, target_selector, combobox_text)
                filled_hints.append(hint)
            elif field_type == "radio_group":
                option_selector = resolve_option_selector(answer, options)
                if option_selector:
                    option_target = await get_preferred_selector(page, option_selector)
                    await page.click(option_target)
                    filled_hints.append(hint)
            elif field_type == "checkbox_group":
                selections = [
                    selection.strip()
                    for selection in answer.split(",")
                    if selection.strip()
                ] or [answer]
                matched_any = False
                for selection in selections:
                    option_selector = resolve_option_selector(selection, options)
                    if not option_selector:
                        continue
                    if not await selector_exists(page, option_selector):
                        continue
                    option_target = await get_preferred_selector(page, option_selector)
                    if hasattr(page, "check"):
                        await page.check(option_target)
                    else:
                        await page.click(option_target)
                    matched_any = True
                if matched_any:
                    filled_hints.append(hint)
            elif field_type == "checkbox":
                normalized_answer = answer.strip().lower()
                if normalized_answer in {"yes", "true"}:
                    if hasattr(page, "check"):
                        await page.check(target_selector)
                    else:
                        await page.click(target_selector)
                    filled_hints.append(hint)
        except Exception:
            continue

    return filled_hints


def _should_ignore_unresolved_hint(normalized_hint: str) -> bool:
    return any(
        keyword in normalized_hint
        for keyword in (
            "first name",
            "last name",
            "preferred first name",
            "full name",
            "email",
            "phone",
            "linkedin",
            "github",
            "website",
            "portfolio",
            "resume",
            "cover letter",
            "country",
            "location",
        )
    )


async def collect_unresolved_required_questions(
    page: Any,
    profile: ApplicantProfile,
    hint_aliases: dict[str, list[str]] | None = None,
) -> list[str]:
    descriptors = await scan_form_questions(page)
    if not descriptors:
        return []

    unresolved: list[str] = []

    for descriptor in descriptors:
        if not isinstance(descriptor, dict):
            continue

        required = bool(descriptor.get("required"))
        hint = normalize_confirmation_text(str(descriptor.get("hint", "")), limit=160).lower()
        options = descriptor.get("options") if isinstance(descriptor.get("options"), list) else []

        if not required or not hint or _should_ignore_unresolved_hint(hint):
            continue

        answer = infer_answer_for_hint(profile, hint, options, hint_aliases)
        if answer:
            continue

        if hint not in unresolved:
            unresolved.append(hint)

    return unresolved


def extract_lever_card_field_names(error_text: str) -> list[str]:
    matches = re.findall(r"cards\[[^\]]+\]\[field\d+\]", error_text)
    deduped: list[str] = []
    for match in matches:
        if match not in deduped:
            deduped.append(match)
    return deduped


async def fill_lever_card_fields_from_error(
    page: Any,
    profile: ApplicantProfile,
    error_text: str,
    hint_aliases: dict[str, list[str]] | None = None,
) -> list[str]:
    field_names = extract_lever_card_field_names(error_text)
    if not field_names:
        return []

    evaluate = getattr(page, "evaluate", None)
    if not callable(evaluate):
        return []

    try:
        descriptors = await evaluate(
            LEVER_ERROR_FIELD_METADATA_SCRIPT,
            {"fieldNames": field_names},
        )
    except Exception:
        return []

    if not isinstance(descriptors, list):
        return []

    filled_hints: list[str] = []

    for descriptor in descriptors:
        if not isinstance(descriptor, dict):
            continue

        hint = normalize_confirmation_text(str(descriptor.get("hint", "")), limit=160).lower()
        selector = descriptor.get("selector")
        field_type = descriptor.get("type")
        options = descriptor.get("options") if isinstance(descriptor.get("options"), list) else []

        if not hint or not isinstance(selector, str) or not selector:
            continue

        answer = infer_answer_for_hint(profile, hint, options, hint_aliases)
        if not answer:
            continue

        try:
            if not await selector_exists(page, selector):
                continue

            target_selector = await get_preferred_selector(page, selector)
            if field_type in {"text", "textarea", "email", "tel", "number", "date"}:
                await page.fill(target_selector, answer)
                filled_hints.append(hint)
        except Exception:
            continue

    return filled_hints
