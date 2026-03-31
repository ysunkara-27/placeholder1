import asyncio
import unittest

from apply_engine.agents.common import (
    attempt_recovery_for_blocked_family,
    build_common_contact_actions,
    build_recovery_actions,
    classify_blocked_field_family,
    collect_unresolved_required_questions,
    fill_detected_questions_by_hint,
    fill_lever_card_fields_from_error,
    infer_answer_for_hint,
    resolve_combobox_text,
    resolve_blocked_field_family,
    resolve_option_selector,
    resolve_option_value,
    scan_form_questions,
)
from apply_engine.portal_specs import (
    GREENHOUSE_CUSTOM_SELECTORS,
    GREENHOUSE_HINT_ALIASES,
    GREENHOUSE_SELECTORS,
    LEVER_HINT_ALIASES,
    WORKDAY_CUSTOM_SELECTORS,
    WORKDAY_HINT_ALIASES,
    WORKDAY_SELECTORS,
)
from apply_engine.models import ApplicantProfile


def make_profile() -> ApplicantProfile:
    return ApplicantProfile(
        first_name="Test",
        last_name="User",
        email="test@example.com",
        phone="5550000000",
        linkedin="https://linkedin.com/in/test-user",
        website="https://test.dev",
        github="https://github.com/test-user",
        sponsorship_required=False,
        work_authorization="US Citizen",
        start_date="2026-06-01",
        location_preference="San Francisco, CA",
        salary_expectation="$45/hour",
        onsite_preference="Open to onsite",
        weekly_availability_hours="40",
        graduation_window="2027",
        commute_preference="Within 45 minutes",
        school="Stanford University",
        major="Computer Science",
        gpa="3.9",
        graduation="2027-06-15",
        eeo={
            "gender": "Woman",
            "race_ethnicity": "Asian",
            "veteran_status": "I am not a protected veteran",
            "disability_status": "No, I do not have a disability",
        },
        custom_answers={
            "relocation": "yes",
            "heard_about_us": "LinkedIn",
            "technologies": "Python, TypeScript",
        },
    )


class FakeQuestionPage:
    def __init__(self, descriptors: list[dict]) -> None:
        self.descriptors = descriptors
        self.calls: list[tuple[str, str, str]] = []
        self.keyboard = self.FakeKeyboard(self.calls)

    class FakeKeyboard:
        def __init__(self, calls: list[tuple[str, str, str]]) -> None:
            self.calls = calls

        async def press(self, key: str) -> None:
            self.calls.append(("keyboard", key, ""))

    async def evaluate(self, _script: str):
        return self.descriptors

    async def fill(self, selector: str, value: str) -> None:
        self.calls.append(("fill", selector, value))

    async def select_option(self, selector: str, value: str) -> None:
        self.calls.append(("select", selector, value))

    async def click(self, selector: str) -> None:
        self.calls.append(("click", selector, ""))

    async def check(self, selector: str) -> None:
        self.calls.append(("check", selector, ""))


class FakeMetadataQuestionPage(FakeQuestionPage):
    def __init__(self, scanned: list[dict], greenhouse: list[dict] | None = None, lever: list[dict] | None = None) -> None:
        super().__init__(scanned)
        self.greenhouse = greenhouse or []
        self.lever = lever or []

    async def evaluate(self, script: str, *_args):
        if "window.__remixContext" in script:
            return self.greenhouse
        if 'name$="[baseTemplate]"' in script:
            return self.lever
        return self.descriptors


class FakeSelectorLocator:
    def __init__(self, count: int = 1, visible: bool = True) -> None:
        self._count = count
        self._visible = visible

    async def count(self) -> int:
        return self._count

    def nth(self, _index: int):
        return self

    async def is_visible(self) -> bool:
        return self._visible


class FakeSelectorAwareQuestionPage(FakeQuestionPage):
    def __init__(self, descriptors: list[dict], visible_selectors: set[str]) -> None:
        super().__init__(descriptors)
        self.visible_selectors = visible_selectors

    def locator(self, selector: str):
        if selector in self.visible_selectors:
            return FakeSelectorLocator(1, True)
        return FakeSelectorLocator(0, False)


class CommonAgentHelpersTests(unittest.TestCase):
    def test_classify_blocked_field_family_maps_common_failures(self) -> None:
        self.assertEqual(
            classify_blocked_field_family("work_authorization: Work authorization is required"),
            "authorization",
        )
        self.assertEqual(
            classify_blocked_field_family("review_step: Portfolio URL is required"),
            "contact",
        )
        self.assertEqual(
            classify_blocked_field_family("gender: Please select gender"),
            "eeo",
        )

    def test_resolve_blocked_field_family_uses_runtime_hints_for_generic_errors(self) -> None:
        self.assertEqual(
            resolve_blocked_field_family(
                "review_step: This field is required",
                {
                    "likely_blocked_family": "availability",
                    "historical_blocked_families": ["availability", "eeo"],
                },
            ),
            "availability",
        )

    def test_build_recovery_actions_targets_authorization_family(self) -> None:
        profile = make_profile()

        actions = build_recovery_actions(
            profile,
            "authorization",
            GREENHOUSE_SELECTORS,
            GREENHOUSE_CUSTOM_SELECTORS,
        )

        selectors = {action.selector for action in actions}
        self.assertIn(GREENHOUSE_SELECTORS["work_authorization"], selectors)
        self.assertIn(GREENHOUSE_SELECTORS["authorized_yes"], selectors)
        self.assertIn(GREENHOUSE_SELECTORS["sponsorship_no"], selectors)

    def test_build_recovery_actions_targets_greenhouse_education_family(self) -> None:
        profile = make_profile()

        actions = build_recovery_actions(
            profile,
            "education",
            GREENHOUSE_SELECTORS,
            GREENHOUSE_CUSTOM_SELECTORS,
        )

        selectors = {action.selector for action in actions}
        self.assertIn(GREENHOUSE_CUSTOM_SELECTORS["school"]["fill_selector"], selectors)
        self.assertIn(GREENHOUSE_CUSTOM_SELECTORS["degree"]["fill_selector"], selectors)
        self.assertIn(GREENHOUSE_CUSTOM_SELECTORS["discipline"]["fill_selector"], selectors)
        self.assertIn(GREENHOUSE_CUSTOM_SELECTORS["start_month"]["fill_selector"], selectors)
        self.assertIn(GREENHOUSE_CUSTOM_SELECTORS["start_year"]["fill_selector"], selectors)
        self.assertIn(GREENHOUSE_CUSTOM_SELECTORS["end_month"]["fill_selector"], selectors)
        self.assertIn(GREENHOUSE_CUSTOM_SELECTORS["end_year"]["fill_selector"], selectors)

    def test_build_recovery_actions_targets_workday_availability_and_eeo_families(self) -> None:
        profile = make_profile()

        availability_actions = build_recovery_actions(
            profile,
            "availability",
            WORKDAY_SELECTORS,
            WORKDAY_CUSTOM_SELECTORS,
        )
        availability_selectors = {action.selector for action in availability_actions}
        self.assertIn(WORKDAY_CUSTOM_SELECTORS["onsite_preference"]["select_selector"], availability_selectors)
        self.assertIn(WORKDAY_CUSTOM_SELECTORS["weekly_availability_hours"]["fill_selector"], availability_selectors)
        self.assertIn(WORKDAY_CUSTOM_SELECTORS["commute_preference"]["fill_selector"], availability_selectors)

        eeo_actions = build_recovery_actions(
            profile,
            "eeo",
            WORKDAY_SELECTORS,
            WORKDAY_CUSTOM_SELECTORS,
        )
        eeo_selectors = {action.selector for action in eeo_actions}
        self.assertIn(WORKDAY_CUSTOM_SELECTORS["gender"]["select_selector"], eeo_selectors)
        self.assertIn(WORKDAY_CUSTOM_SELECTORS["race_ethnicity"]["select_selector"], eeo_selectors)

    def test_build_common_contact_actions_seeds_greenhouse_education_fields(self) -> None:
        profile = make_profile()

        actions = build_common_contact_actions(
            profile,
            phone_selector=GREENHOUSE_SELECTORS["phone"],
            linkedin_selector=GREENHOUSE_SELECTORS["linkedin"],
            website_selector=GREENHOUSE_SELECTORS["website"],
            resume_selector=GREENHOUSE_SELECTORS["resume_upload"],
            work_authorization_selector=GREENHOUSE_SELECTORS["work_authorization"],
            start_date_selector=GREENHOUSE_SELECTORS["start_date"],
            location_preference_selector=GREENHOUSE_SELECTORS["location_preference"],
            salary_expectation_selector=GREENHOUSE_SELECTORS["salary_expectation"],
            authorized_yes_selector=GREENHOUSE_SELECTORS["authorized_yes"],
            authorized_no_selector=GREENHOUSE_SELECTORS["authorized_no"],
            sponsorship_yes_selector=GREENHOUSE_SELECTORS["sponsorship_yes"],
            sponsorship_no_selector=GREENHOUSE_SELECTORS["sponsorship_no"],
            custom_selectors=GREENHOUSE_CUSTOM_SELECTORS,
        )

        action_map = {(action.action, action.selector): action.value for action in actions}
        self.assertEqual(
            action_map[("fill", GREENHOUSE_CUSTOM_SELECTORS["school"]["fill_selector"])],
            "Stanford University",
        )
        self.assertEqual(
            action_map[("fill", GREENHOUSE_CUSTOM_SELECTORS["degree"]["fill_selector"])],
            "Bachelor's Degree",
        )
        self.assertEqual(
            action_map[("fill", GREENHOUSE_CUSTOM_SELECTORS["discipline"]["fill_selector"])],
            "Computer Science",
        )
        self.assertEqual(
            action_map[("fill", GREENHOUSE_CUSTOM_SELECTORS["start_month"]["fill_selector"])],
            "08",
        )
        self.assertEqual(
            action_map[("fill", GREENHOUSE_CUSTOM_SELECTORS["start_year"]["fill_selector"])],
            "2023",
        )
        self.assertEqual(
            action_map[("fill", GREENHOUSE_CUSTOM_SELECTORS["end_month"]["fill_selector"])],
            "06",
        )
        self.assertEqual(
            action_map[("fill", GREENHOUSE_CUSTOM_SELECTORS["end_year"]["fill_selector"])],
            "2027",
        )

    def test_attempt_recovery_for_blocked_family_executes_targeted_actions(self) -> None:
        profile = make_profile()
        page = FakeQuestionPage([])

        family = asyncio.run(
            attempt_recovery_for_blocked_family(
                page,
                profile,
                "work_authorization: Work authorization is required",
                selectors=GREENHOUSE_SELECTORS,
                custom_selectors=GREENHOUSE_CUSTOM_SELECTORS,
            )
        )

        self.assertEqual(family, "authorization")
        self.assertEqual(
            page.calls,
            [
                ("select", GREENHOUSE_SELECTORS["work_authorization"], "US Citizen"),
                ("check", GREENHOUSE_SELECTORS["authorized_yes"], ""),
                ("check", GREENHOUSE_SELECTORS["sponsorship_no"], ""),
            ],
        )

    def test_attempt_recovery_for_blocked_family_can_use_hint_aliases_without_selector_match(self) -> None:
        profile = make_profile()
        page = FakeQuestionPage(
            [
                {
                    "type": "select",
                    "selector": 'select[name="work_style"]',
                    "hint": "Office cadence preference",
                    "options": [
                        {"selector": 'select[name="work_style"]', "value": "open_onsite", "label": "Open to onsite"},
                        {"selector": 'select[name="work_style"]', "value": "remote_only", "label": "Remote only"},
                    ],
                }
            ]
        )

        family = asyncio.run(
            attempt_recovery_for_blocked_family(
                page,
                profile,
                "review_step: This field is required",
                selectors={},
                custom_selectors={},
                runtime_hints={"likely_blocked_family": "availability"},
                hint_aliases=GREENHOUSE_HINT_ALIASES,
            )
        )

        self.assertEqual(family, "availability")
        self.assertEqual(
            page.calls,
            [("select", 'select[name="work_style"]', "open_onsite")],
        )

    def test_attempt_recovery_for_custom_block_can_fill_motivation_prompt(self) -> None:
        profile = make_profile()
        page = FakeQuestionPage(
            [
                {
                    "type": "textarea",
                    "selector": 'textarea[name="motivation"]',
                    "hint": "Why are you interested in this role?",
                    "options": [],
                }
            ]
        )

        family = asyncio.run(
            attempt_recovery_for_blocked_family(
                page,
                profile,
                "review_step: This field is required",
                selectors={},
                custom_selectors={},
                runtime_hints={"likely_blocked_family": "custom"},
                hint_aliases=GREENHOUSE_HINT_ALIASES,
            )
        )

        self.assertEqual(family, "custom")
        self.assertEqual(page.calls[0][0], "fill")
        self.assertEqual(page.calls[0][1], 'textarea[name="motivation"]')

    def test_scan_form_questions_merges_lever_metadata_for_card_fields(self) -> None:
        page = FakeMetadataQuestionPage(
            [
                {
                    "type": "textarea",
                    "selector": 'textarea[name="cards[card-1][field0]"]',
                    "hint": "field0",
                    "required": False,
                    "options": [],
                }
            ],
            lever=[
                {
                    "type": "textarea",
                    "selector": 'textarea[name="cards[card-1][field0]"]',
                    "hint": "When will you graduate? (expected month & year)",
                    "required": True,
                    "options": [],
                }
            ],
        )

        descriptors = asyncio.run(scan_form_questions(page))

        self.assertEqual(len(descriptors), 1)
        self.assertEqual(
            descriptors[0]["hint"],
            "When will you graduate? (expected month & year)",
        )
        self.assertTrue(descriptors[0]["required"])

    def test_fill_lever_card_fields_from_error_uses_template_metadata(self) -> None:
        profile = make_profile()
        page = FakeMetadataQuestionPage(
            [],
            lever=[
                {
                    "type": "textarea",
                    "selector": 'textarea[name="cards[card-1][field0]"]',
                    "hint": "When will you graduate? (expected month & year)",
                    "required": True,
                    "options": [],
                },
                {
                    "type": "textarea",
                    "selector": 'textarea[name="cards[card-1][field1]"]',
                    "hint": "When can you start internship?",
                    "required": True,
                    "options": [],
                },
            ],
        )

        filled = asyncio.run(
            fill_lever_card_fields_from_error(
                page,
                profile,
                "cards[card-1][field0] is required; cards[card-1][field1] is required",
                LEVER_HINT_ALIASES,
            )
        )

        self.assertEqual(
            page.calls,
            [
                ("fill", 'textarea[name="cards[card-1][field0]"]', "2027-06-15"),
                ("fill", 'textarea[name="cards[card-1][field1]"]', "2026-06-01"),
            ],
        )
        self.assertEqual(
            filled,
            [
                "when will you graduate? (expected month & year)",
                "when can you start internship?",
            ],
        )

    def test_infer_answer_for_hint_resolves_text_and_eeo_values(self) -> None:
        profile = make_profile()

        self.assertEqual(
            infer_answer_for_hint(profile, "What school do you attend?"),
            "Stanford University",
        )
        self.assertEqual(
            infer_answer_for_hint(profile, "Degree"),
            "Bachelor's Degree",
        )
        self.assertEqual(
            infer_answer_for_hint(profile, "Discipline"),
            "Computer Science",
        )
        self.assertEqual(
            infer_answer_for_hint(profile, "Start Month"),
            "08",
        )
        self.assertEqual(
            infer_answer_for_hint(profile, "End Year"),
            "2027",
        )
        self.assertEqual(
            infer_answer_for_hint(profile, "When can you start internship?"),
            "2026-06-01",
        )
        self.assertEqual(
            infer_answer_for_hint(profile, "Gender"),
            "Woman",
        )
        self.assertEqual(
            infer_answer_for_hint(profile, "Will you now or in the future require sponsorship?"),
            "no",
        )
        self.assertEqual(
            infer_answer_for_hint(
                profile,
                "Are you a U.S. citizen, lawful permanent resident, or otherwise eligible under ITAR?",
            ),
            "yes",
        )
        self.assertEqual(
            infer_answer_for_hint(profile, "Which technologies have you used?"),
            "Python, TypeScript",
        )
        self.assertIn(
            "software engineering",
            infer_answer_for_hint(profile, "Why are you interested in Rendezvous Robotics?") or "",
        )

    def test_infer_answer_for_hint_uses_portal_aliases_for_ambiguous_labels(self) -> None:
        profile = make_profile()

        self.assertEqual(
            infer_answer_for_hint(
                profile,
                "What is your office cadence preference?",
                hint_aliases=GREENHOUSE_HINT_ALIASES,
            ),
            "Open to onsite",
        )
        self.assertEqual(
            infer_answer_for_hint(
                profile,
                "Voluntary disability self identification",
                hint_aliases=LEVER_HINT_ALIASES,
            ),
            "No, I do not have a disability",
        )
        self.assertEqual(
            infer_answer_for_hint(
                profile,
                "Employment eligibility status",
                hint_aliases=WORKDAY_HINT_ALIASES,
            ),
            "US Citizen",
        )

    def test_infer_answer_for_hint_prefers_exact_followup_prompt_answers(self) -> None:
        profile = make_profile()
        profile.custom_answers[
            "please describe your prior experience with orbital robotics simulations"
        ] = "Built a satellite dynamics simulator in Python for a student robotics lab."

        self.assertEqual(
            infer_answer_for_hint(
                profile,
                "Please describe your prior experience with orbital robotics simulations",
            ),
            "Built a satellite dynamics simulator in Python for a student robotics lab.",
        )

    def test_fill_detected_questions_by_hint_handles_text_select_radio_and_checkbox_groups(self) -> None:
        profile = make_profile()
        page = FakeQuestionPage(
            [
                {
                    "type": "text",
                    "selector": 'input[name="school_freeform"]',
                    "hint": "School",
                    "options": [],
                },
                {
                    "type": "select",
                    "selector": 'select[name="gender"]',
                    "hint": "Gender",
                    "options": [
                        {"selector": 'select[name="gender"]', "value": "Woman", "label": "Woman"},
                    ],
                },
                {
                    "type": "select",
                    "selector": 'select[name="onsite_preference"]',
                    "hint": "Preferred work mode",
                    "options": [
                        {"selector": 'select[name="onsite_preference"]', "value": "open_onsite", "label": "Open to onsite"},
                        {"selector": 'select[name="onsite_preference"]', "value": "remote_only", "label": "Remote only"},
                    ],
                },
                {
                    "type": "combobox_select",
                    "selector": '#question_itar',
                    "hint": "Are you a U.S. citizen, lawful permanent resident, or otherwise eligible under ITAR?",
                    "options": [
                        {"selector": '#question_itar', "value": "1", "label": "Yes"},
                        {"selector": '#question_itar', "value": "0", "label": "No"},
                    ],
                },
                {
                    "type": "radio_group",
                    "selector": 'input[name="relocation"]',
                    "hint": "Are you willing to relocate?",
                    "options": [
                        {"selector": '#relocation_yes', "value": "yes", "label": "Yes"},
                        {"selector": '#relocation_no', "value": "no", "label": "No"},
                    ],
                },
                {
                    "type": "checkbox_group",
                    "selector": 'input[name="technologies"]',
                    "hint": "Which technologies have you used?",
                    "options": [
                        {"selector": "#python", "value": "python", "label": "Python"},
                        {"selector": "#typescript", "value": "typescript", "label": "TypeScript"},
                        {"selector": "#go", "value": "go", "label": "Go"},
                    ],
                },
            ]
        )

        filled_hints = asyncio.run(fill_detected_questions_by_hint(page, profile))

        self.assertEqual(
            page.calls,
            [
                ("fill", 'input[name="school_freeform"]', "Stanford University"),
                ("select", 'select[name="gender"]', "Woman"),
                ("select", 'select[name="onsite_preference"]', "open_onsite"),
                ("click", '#question_itar', ""),
                ("fill", '#question_itar', "Yes"),
                ("keyboard", "ArrowDown", ""),
                ("keyboard", "Enter", ""),
                ("keyboard", "Tab", ""),
                ("click", "#relocation_yes", ""),
                ("check", "#python", ""),
                ("check", "#typescript", ""),
            ],
        )
        self.assertEqual(
            filled_hints,
            ["school", "gender", "preferred work mode", "are you a u.s. citizen, lawful permanent resident, or otherwise eligible under itar?", "are you willing to relocate?", "which technologies have you used?"],
        )

    def test_fill_detected_questions_by_hint_uses_portal_aliases(self) -> None:
        profile = make_profile()
        page = FakeQuestionPage(
            [
                {
                    "type": "select",
                    "selector": 'select[name="work_style"]',
                    "hint": "Office cadence preference",
                    "options": [
                        {"selector": 'select[name="work_style"]', "value": "remote_only", "label": "Remote only"},
                        {"selector": 'select[name="work_style"]', "value": "open_onsite", "label": "Open to onsite"},
                    ],
                },
                {
                    "type": "select",
                    "selector": 'select[name="disability_status"]',
                    "hint": "Voluntary disability self identification",
                    "options": [
                        {
                            "selector": 'select[name="disability_status"]',
                            "value": "no_disability",
                            "label": "No, I do not have a disability",
                        },
                    ],
                },
            ]
        )

        filled_hints = asyncio.run(
            fill_detected_questions_by_hint(page, profile, LEVER_HINT_ALIASES)
        )

        self.assertEqual(
            page.calls,
            [
                ("select", 'select[name="work_style"]', "open_onsite"),
                ("select", 'select[name="disability_status"]', "no_disability"),
            ],
        )
        self.assertEqual(
            filled_hints,
            ["office cadence preference", "voluntary disability self identification"],
        )

    def test_fill_detected_questions_by_hint_skips_missing_selector_without_attempting_fill(self) -> None:
        profile = make_profile()
        page = FakeSelectorAwareQuestionPage(
            [
                {
                    "type": "textarea",
                    "selector": 'textarea[name="cards[missing][field0]"]',
                    "hint": "When can you start internship?",
                    "required": True,
                    "options": [],
                },
            ],
            visible_selectors=set(),
        )

        filled_hints = asyncio.run(fill_detected_questions_by_hint(page, profile))

        self.assertEqual(filled_hints, [])
        self.assertEqual(page.calls, [])

    def test_collect_unresolved_required_questions_returns_big_unanswered_prompts(self) -> None:
        profile = make_profile()
        page = FakeQuestionPage(
            [
                {
                    "type": "text",
                    "selector": "#first_name",
                    "hint": "First Name",
                    "required": True,
                    "options": [],
                },
                {
                    "type": "textarea",
                    "selector": "#custom_question",
                    "hint": "Please describe your prior experience with orbital robotics simulations",
                    "required": True,
                    "options": [],
                },
                {
                    "type": "combobox_select",
                    "selector": "#itar_question",
                    "hint": "Are you a U.S. citizen, lawful permanent resident, or otherwise eligible under ITAR?",
                    "required": True,
                    "options": [
                        {"selector": "#itar_question", "value": "1", "label": "Yes"},
                        {"selector": "#itar_question", "value": "0", "label": "No"},
                    ],
                },
            ]
        )

        unresolved = asyncio.run(collect_unresolved_required_questions(page, profile))

        self.assertEqual(
            unresolved,
            ["please describe your prior experience with orbital robotics simulations"],
        )

    def test_option_resolution_handles_availability_and_eeo_synonyms(self) -> None:
        onsite_options = [
            {"selector": "#hybrid", "value": "hybrid_schedule", "label": "Hybrid schedule"},
            {"selector": "#onsite", "value": "on_site_required", "label": "On-site required"},
        ]
        gender_options = [
            {"selector": "#female", "value": "female", "label": "Female"},
        ]
        veteran_options = [
            {"selector": "#veteran_no", "value": "not_protected_veteran", "label": "I am not a protected veteran"},
        ]
        hours_options = [
            {"selector": "#hours_40", "value": "40_hours_weekly", "label": "40 hours weekly"},
        ]

        self.assertEqual(resolve_option_selector("Open to onsite", onsite_options), "#onsite")
        self.assertEqual(resolve_option_value("Open to onsite", onsite_options), "on_site_required")
        self.assertEqual(resolve_option_selector("Woman", gender_options), "#female")
        self.assertEqual(resolve_option_value("Woman", gender_options), "female")
        self.assertEqual(
            resolve_option_selector("I am not a protected veteran", veteran_options),
            "#veteran_no",
        )
        self.assertEqual(resolve_option_selector("40", hours_options), "#hours_40")

    def test_option_resolution_handles_education_synonyms(self) -> None:
        degree_options = [
            {"selector": "#bachelor", "value": "bachelor_of_science", "label": "Bachelor's Degree"},
            {"selector": "#master", "value": "master_of_science", "label": "Master's Degree"},
        ]
        graduation_options = [
            {"selector": "#grad_2027", "value": "class_of_2027", "label": "Class of 2027"},
        ]
        major_options = [
            {"selector": "#cs", "value": "computer_science", "label": "Computer Science"},
        ]
        month_options = [
            {"selector": "#june", "value": "june", "label": "June"},
            {"selector": "#august", "value": "august", "label": "August"},
        ]

        self.assertEqual(resolve_option_selector("BS Computer Science", degree_options), "#bachelor")
        self.assertEqual(resolve_option_value("BS Computer Science", degree_options), "bachelor_of_science")
        self.assertEqual(resolve_option_selector("2027-06-15", graduation_options), "#grad_2027")
        self.assertEqual(resolve_option_selector("Computer Science", major_options), "#cs")
        self.assertEqual(resolve_option_selector("06", month_options), "#june")
        self.assertEqual(resolve_option_value("08", month_options), "august")

    def test_resolve_combobox_text_prefers_option_labels(self) -> None:
        itar_options = [
            {"selector": "#itar_yes", "value": "1", "label": "Yes"},
            {"selector": "#itar_no", "value": "0", "label": "No"},
        ]

        self.assertEqual(resolve_combobox_text("yes", itar_options), "Yes")

    def test_option_resolution_handles_authorization_and_opt_out_synonyms(self) -> None:
        authorization_options = [
            {"selector": "#authorized", "value": "authorized_any_employer", "label": "Authorized to work for any employer"},
            {"selector": "#permanent_resident", "value": "permanent_resident", "label": "Permanent Resident / Green Card"},
        ]
        sponsorship_options = [
            {"selector": "#no_sponsor", "value": "no_sponsorship_required", "label": "No sponsorship required"},
        ]
        opt_out_options = [
            {"selector": "#decline", "value": "prefer_not_to_answer", "label": "Prefer not to answer"},
        ]

        self.assertEqual(resolve_option_selector("US Citizen", authorization_options), "#authorized")
        self.assertEqual(resolve_option_selector("Green Card", authorization_options), "#permanent_resident")
        self.assertEqual(resolve_option_selector("I do not require sponsorship", sponsorship_options), "#no_sponsor")
        self.assertEqual(resolve_option_selector("Prefer not to self-identify", opt_out_options), "#decline")


if __name__ == "__main__":
    unittest.main()
