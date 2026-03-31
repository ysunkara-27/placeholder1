from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from apply_engine.agents.common import build_common_contact_actions
from apply_engine.agents.greenhouse import GreenhouseAgent
from apply_engine.browser import execute_actions, run_with_chromium
from apply_engine.models import ApplicantProfile, PlannedAction
from apply_engine.portal_specs import GREENHOUSE_CUSTOM_SELECTORS, GREENHOUSE_SELECTORS


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
            "degree": "Bachelor's Degree",
            "discipline": "Computer Science",
        },
    )


def build_actions(profile: ApplicantProfile) -> list[PlannedAction]:
    return [
        PlannedAction("fill", GREENHOUSE_SELECTORS["first_name"], profile.first_name),
        PlannedAction("fill", GREENHOUSE_SELECTORS["last_name"], profile.last_name),
        PlannedAction("fill", GREENHOUSE_SELECTORS["email"], profile.email),
        *build_common_contact_actions(
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
        ),
    ]


SNAPSHOT_SCRIPT = """
() => {
  const selectors = [
    ["school", "#school--0"],
    ["degree", "#degree--0"],
    ["discipline", "#discipline--0"],
    ["start_month", "#start-month--0"],
    ["start_year", "#start-year--0"],
    ["end_month", "#end-month--0"],
    ["end_year", "#end-year--0"],
  ];

  return selectors.map(([key, selector]) => {
    const input = document.querySelector(selector);
    const wrapper = input?.closest(".select, .select__container, .select-shell, .field-wrapper, .input-wrapper");
    const singleValue = wrapper?.querySelector(".select__single-value");
    const placeholder = wrapper?.querySelector(".select__placeholder");
    const hiddenRequiredInput = wrapper?.querySelector('input[aria-hidden="true"]');
    return {
      key,
      exists: Boolean(input),
      value: input instanceof HTMLInputElement ? (input.value || "") : "",
      selected: singleValue instanceof HTMLElement ? (singleValue.textContent || "").trim() : "",
      placeholder: placeholder instanceof HTMLElement ? (placeholder.textContent || "").trim() : "",
      hiddenRequiredValue:
        hiddenRequiredInput instanceof HTMLInputElement ? (hiddenRequiredInput.value || "") : "",
      expanded: input instanceof HTMLElement ? input.getAttribute("aria-expanded") : "",
      describedBy: input instanceof HTMLElement ? input.getAttribute("aria-describedby") : "",
    };
  });
}
"""


async def worker(page: object) -> tuple[list[dict[str, str]], list[tuple[str, str, str]]]:
    profile = make_profile()
    agent = GreenhouseAgent()
    actions = build_actions(profile)
    await execute_actions(page, actions)
    await agent._reinforce_education_fields(page, profile)
    await agent._sync_required_combobox_inputs(
        page,
        ["#school--0", "#degree--0", "#discipline--0", "#start-month--0", "#end-month--0"],
    )
    snapshot = await page.evaluate(SNAPSHOT_SCRIPT)
    return snapshot, [(action.action, action.selector, action.value) for action in actions]


async def main() -> None:
    url = "https://job-boards.greenhouse.io/scaleai/jobs/4677519005"
    snapshot, actions = await run_with_chromium(url, worker)
    print(json.dumps({"snapshot": snapshot, "actions": actions}, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
