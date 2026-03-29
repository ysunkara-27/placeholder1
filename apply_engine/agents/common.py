from __future__ import annotations

from apply_engine.models import ApplicantProfile, PlannedAction


CUSTOM_ANSWER_KEY_ALIASES = {
    "university": "school",
    "college": "school",
    "school_name": "school",
    "major": "degree",
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
}


def normalize_custom_answer_key(key: str) -> str:
    normalized = key.strip().lower()
    return CUSTOM_ANSWER_KEY_ALIASES.get(normalized, normalized)


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

    actions.extend(build_custom_answer_actions(normalized_custom_answers, custom_selectors))

    return actions
