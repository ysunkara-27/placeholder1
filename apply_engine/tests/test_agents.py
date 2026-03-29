import asyncio
import unittest
from unittest.mock import patch

from apply_engine.agents.greenhouse import GreenhouseAgent
from apply_engine.agents.lever import LeverAgent
from apply_engine.models import ApplicantProfile, ApplyRequest
from apply_engine.portal_specs import (
    GREENHOUSE_CUSTOM_SELECTORS,
    GREENHOUSE_SELECTORS,
    LEVER_CUSTOM_SELECTORS,
    LEVER_SELECTORS,
)


def make_request(url: str) -> ApplyRequest:
    return ApplyRequest(
        url=url,
        profile=ApplicantProfile(
            first_name="Test",
            last_name="User",
            email="test@example.com",
            phone="5550000000",
            linkedin="https://linkedin.com/in/test-user",
            resume_pdf_path="/tmp/resume.pdf",
            work_authorization="US Citizen",
            start_date="2026-06-01",
            location_preference="San Francisco, CA",
            salary_expectation="$45/hour",
            onsite_preference="Open to onsite",
            weekly_availability_hours="40",
            graduation_window="2027",
            commute_preference="Within 45 minutes",
            sponsorship_required=False,
            custom_answers={
                "school": "Stanford University",
                "degree": "BS Computer Science",
                "graduation_date": "2027-06-15",
                "gpa": "3.9",
                "relocation": "yes",
                "heard_about_us": "LinkedIn",
            },
        ),
        dry_run=True,
    )


class AgentPlanningTests(unittest.TestCase):
    def test_greenhouse_builds_expected_actions(self) -> None:
        agent = GreenhouseAgent()
        actions = agent.build_actions(
            make_request("https://job-boards.greenhouse.io/scaleai/jobs/4606014005")
        )

        self.assertEqual(actions[0].selector, GREENHOUSE_SELECTORS["first_name"])
        self.assertEqual(actions[1].selector, GREENHOUSE_SELECTORS["last_name"])
        self.assertTrue(any(action.action == "upload" for action in actions))
        self.assertTrue(
            any(action.selector == GREENHOUSE_SELECTORS["linkedin"] for action in actions)
        )
        self.assertTrue(
            any(
                action.action == "fill"
                and action.selector == GREENHOUSE_SELECTORS["start_date"]
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "fill"
                and action.selector == GREENHOUSE_SELECTORS["location_preference"]
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "fill"
                and action.selector == GREENHOUSE_SELECTORS["salary_expectation"]
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "select"
                and action.selector == GREENHOUSE_SELECTORS["work_authorization"]
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "check"
                and action.selector == GREENHOUSE_SELECTORS["authorized_yes"]
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "check"
                and action.selector == GREENHOUSE_SELECTORS["sponsorship_no"]
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "fill"
                and action.selector == GREENHOUSE_CUSTOM_SELECTORS["school"]["fill_selector"]
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "fill"
                and action.selector == GREENHOUSE_CUSTOM_SELECTORS["degree"]["fill_selector"]
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "check"
                and action.selector == GREENHOUSE_CUSTOM_SELECTORS["relocation"]["yes_selector"]
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "select"
                and action.selector == GREENHOUSE_CUSTOM_SELECTORS["heard_about_us"]["select_selector"]
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "select"
                and action.selector == GREENHOUSE_CUSTOM_SELECTORS["onsite_preference"]["select_selector"]
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "fill"
                and action.selector
                == GREENHOUSE_CUSTOM_SELECTORS["weekly_availability_hours"]["fill_selector"]
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "fill"
                and action.selector
                == GREENHOUSE_CUSTOM_SELECTORS["graduation_window"]["fill_selector"]
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "fill"
                and action.selector
                == GREENHOUSE_CUSTOM_SELECTORS["commute_preference"]["fill_selector"]
                for action in actions
            )
        )

    def test_lever_builds_expected_actions(self) -> None:
        agent = LeverAgent()
        actions = agent.build_actions(
            make_request("https://jobs.lever.co/weride/8f84c602-8a79-43f6-b662-74a92ef761f5")
        )

        self.assertEqual(actions[0].selector, LEVER_SELECTORS["name"])
        self.assertEqual(actions[1].selector, LEVER_SELECTORS["email"])
        self.assertTrue(any(action.action == "upload" for action in actions))
        self.assertTrue(
            any(
                action.action == "fill"
                and action.selector == LEVER_SELECTORS["start_date"]
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "fill"
                and action.selector == LEVER_SELECTORS["location_preference"]
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "fill"
                and action.selector == LEVER_SELECTORS["salary_expectation"]
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "select"
                and action.selector == LEVER_SELECTORS["work_authorization"]
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "check"
                and action.selector == LEVER_SELECTORS["authorized_yes"]
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "check"
                and action.selector == LEVER_SELECTORS["sponsorship_no"]
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "fill"
                and action.selector == LEVER_CUSTOM_SELECTORS["school"]["fill_selector"]
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "fill"
                and action.selector == LEVER_CUSTOM_SELECTORS["degree"]["fill_selector"]
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "check"
                and action.selector == LEVER_CUSTOM_SELECTORS["relocation"]["yes_selector"]
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "select"
                and action.selector == LEVER_CUSTOM_SELECTORS["heard_about_us"]["select_selector"]
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "select"
                and action.selector == LEVER_CUSTOM_SELECTORS["onsite_preference"]["select_selector"]
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "fill"
                and action.selector
                == LEVER_CUSTOM_SELECTORS["weekly_availability_hours"]["fill_selector"]
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "fill"
                and action.selector
                == LEVER_CUSTOM_SELECTORS["graduation_window"]["fill_selector"]
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "fill"
                and action.selector
                == LEVER_CUSTOM_SELECTORS["commute_preference"]["fill_selector"]
                for action in actions
            )
        )

    def test_greenhouse_normalizes_custom_answer_aliases(self) -> None:
        agent = GreenhouseAgent()
        request = make_request("https://job-boards.greenhouse.io/scaleai/jobs/4606014005")
        request.profile.custom_answers = {
            "university": "Stanford University",
            "major": "Computer Science",
            "graduation": "2027-06-15",
            "relocate": "yes",
            "source": "LinkedIn",
            "onsite": "Open to onsite",
            "weekly_hours": "40",
            "grad_window": "2027",
            "commute": "Within 45 minutes",
        }

        actions = agent.build_actions(request)

        self.assertTrue(
            any(
                action.action == "fill"
                and action.selector == GREENHOUSE_CUSTOM_SELECTORS["school"]["fill_selector"]
                and action.value == "Stanford University"
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "fill"
                and action.selector == GREENHOUSE_CUSTOM_SELECTORS["degree"]["fill_selector"]
                and action.value == "Computer Science"
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "check"
                and action.selector == GREENHOUSE_CUSTOM_SELECTORS["relocation"]["yes_selector"]
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "select"
                and action.selector == GREENHOUSE_CUSTOM_SELECTORS["heard_about_us"]["select_selector"]
                and action.value == "LinkedIn"
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "select"
                and action.selector == GREENHOUSE_CUSTOM_SELECTORS["onsite_preference"]["select_selector"]
                and action.value == "Open to onsite"
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "fill"
                and action.selector
                == GREENHOUSE_CUSTOM_SELECTORS["weekly_availability_hours"]["fill_selector"]
                and action.value == "40"
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "fill"
                and action.selector
                == GREENHOUSE_CUSTOM_SELECTORS["graduation_window"]["fill_selector"]
                and action.value == "2027"
                for action in actions
            )
        )
        self.assertTrue(
            any(
                action.action == "fill"
                and action.selector
                == GREENHOUSE_CUSTOM_SELECTORS["commute_preference"]["fill_selector"]
                and action.value == "Within 45 minutes"
                for action in actions
            )
        )

    def test_greenhouse_execute_submits_after_actions(self) -> None:
        class FakeLocator:
            def __init__(
                self,
                inner_text: str = "Applied successfully",
                count: int = 1,
            ) -> None:
                self._inner_text = inner_text
                self._count = count

            async def count(self) -> int:
                return self._count

            async def inner_text(self) -> str:
                return self._inner_text

        class FakePage:
            def __init__(self, *, missing_selectors: set[str] | None = None) -> None:
                self.calls: list[tuple[str, str, str]] = []
                self.missing_selectors = missing_selectors or set()
                self.body_texts = [
                    "Review your application details",
                    "Applied successfully",
                ]
                self.body_index = 0

            async def fill(self, selector: str, value: str) -> None:
                self.calls.append(("fill", selector, value))

            async def set_input_files(self, selector: str, value: str) -> None:
                self.calls.append(("upload", selector, value))

            async def click(self, selector: str) -> None:
                self.calls.append(("click", selector, ""))
                if self.body_index < len(self.body_texts) - 1:
                    self.body_index += 1

            async def select_option(self, selector: str, value: str) -> None:
                self.calls.append(("select", selector, value))

            async def check(self, selector: str) -> None:
                self.calls.append(("check", selector, ""))

            async def wait_for_timeout(self, _: int) -> None:
                return None

            def locator(self, selector: str) -> FakeLocator:
                if selector == "body":
                    return FakeLocator(self.body_texts[self.body_index])
                return FakeLocator(count=0 if selector in self.missing_selectors else 1)

        agent = GreenhouseAgent()
        request = make_request("https://job-boards.greenhouse.io/scaleai/jobs/4606014005")
        actions = agent.build_actions(request)
        page = FakePage(missing_selectors={agent.next_selector})

        confirmation, screenshots = asyncio.run(agent.execute(page, actions))

        self.assertEqual(confirmation, "Applied successfully")
        self.assertEqual(screenshots, [])
        self.assertEqual(page.calls[-1], ("click", agent.submit_selector, ""))

    def test_greenhouse_apply_returns_applied_when_runner_succeeds(self) -> None:
        agent = GreenhouseAgent()
        request = ApplyRequest(
            url="https://job-boards.greenhouse.io/scaleai/jobs/4606014005",
            profile=make_request("https://job-boards.greenhouse.io/scaleai/jobs/4606014005").profile,
            dry_run=False,
        )

        async def fake_runner(_: str, worker):
            class FakeLocator:
                async def inner_text(self) -> str:
                    return "  Application submitted successfully   confirmation #ABC123  "

            class FakePage:
                async def fill(self, selector: str, value: str) -> None:
                    return None

                async def set_input_files(self, selector: str, value: str) -> None:
                    return None

                async def select_option(self, selector: str, value: str) -> None:
                    return None

                async def check(self, selector: str) -> None:
                    return None

                async def click(self, selector: str) -> None:
                    return None

                async def wait_for_timeout(self, timeout: int) -> None:
                    return None

                async def screenshot(self, **_: object) -> bytes:
                    return b"greenhouse-success"

                def locator(self, selector: str) -> FakeLocator:
                    return FakeLocator()

            return await worker(FakePage())

        with patch("apply_engine.agents.greenhouse.run_with_chromium", fake_runner):
            result = asyncio.run(agent.apply(request))

        self.assertEqual(result.status, "applied")
        self.assertEqual(
            result.confirmation_snippet,
            "Application submitted successfully confirmation #ABC123",
        )
        self.assertEqual(len(result.screenshots), 2)
        self.assertEqual(result.screenshots[0].label, "form_filled")
        self.assertEqual(result.screenshots[1].label, "final_state")

    def test_greenhouse_apply_returns_requires_auth_when_runner_needs_login(self) -> None:
        agent = GreenhouseAgent()
        request = ApplyRequest(
            url="https://job-boards.greenhouse.io/scaleai/jobs/4606014005",
            profile=make_request("https://job-boards.greenhouse.io/scaleai/jobs/4606014005").profile,
            dry_run=False,
        )

        async def fake_runner(_: str, worker):
            class FakeLocator:
                def __init__(
                    self,
                    *,
                    inner_text: str = "Sign in to continue your application",
                    count: int = 1,
                ) -> None:
                    self._inner_text = inner_text
                    self._count = count

                async def count(self) -> int:
                    return self._count

                async def inner_text(self) -> str:
                    return self._inner_text

            class FakePage:
                async def fill(self, selector: str, value: str) -> None:
                    return None

                async def set_input_files(self, selector: str, value: str) -> None:
                    return None

                async def select_option(self, selector: str, value: str) -> None:
                    return None

                async def check(self, selector: str) -> None:
                    return None

                async def click(self, selector: str) -> None:
                    return None

                async def wait_for_timeout(self, timeout: int) -> None:
                    return None

                async def screenshot(self, **_: object) -> bytes:
                    return b"greenhouse-auth"

                def locator(self, selector: str) -> FakeLocator:
                    if selector == "body":
                        return FakeLocator()
                    return FakeLocator(count=1, inner_text="")

            return await worker(FakePage())

        with patch("apply_engine.agents.greenhouse.run_with_chromium", fake_runner):
            result = asyncio.run(agent.apply(request))

        self.assertEqual(result.status, "requires_auth")
        self.assertIn("Sign in to continue your application", result.error)
        self.assertEqual(len(result.screenshots), 2)
        self.assertEqual(result.screenshots[0].label, "form_filled")
        self.assertEqual(result.screenshots[1].label, "failure_state")

    def test_lever_execute_submits_after_actions(self) -> None:
        class FakeLocator:
            def __init__(
                self,
                inner_text: str = "Applied successfully",
                count: int = 1,
            ) -> None:
                self._inner_text = inner_text
                self._count = count

            async def count(self) -> int:
                return self._count

            async def inner_text(self) -> str:
                return self._inner_text

        class FakePage:
            def __init__(self, *, missing_selectors: set[str] | None = None) -> None:
                self.calls: list[tuple[str, str, str]] = []
                self.missing_selectors = missing_selectors or set()
                self.body_texts = [
                    "Review your application details",
                    "Applied successfully",
                ]
                self.body_index = 0

            async def fill(self, selector: str, value: str) -> None:
                self.calls.append(("fill", selector, value))

            async def set_input_files(self, selector: str, value: str) -> None:
                self.calls.append(("upload", selector, value))

            async def click(self, selector: str) -> None:
                self.calls.append(("click", selector, ""))
                if self.body_index < len(self.body_texts) - 1:
                    self.body_index += 1

            async def select_option(self, selector: str, value: str) -> None:
                self.calls.append(("select", selector, value))

            async def check(self, selector: str) -> None:
                self.calls.append(("check", selector, ""))

            async def wait_for_timeout(self, _: int) -> None:
                return None

            def locator(self, selector: str) -> FakeLocator:
                if selector == "body":
                    return FakeLocator(self.body_texts[self.body_index])
                return FakeLocator(count=0 if selector in self.missing_selectors else 1)

        agent = LeverAgent()
        request = make_request("https://jobs.lever.co/weride/8f84c602-8a79-43f6-b662-74a92ef761f5")
        actions = agent.build_actions(request)
        page = FakePage(missing_selectors={agent.next_selector})

        confirmation, screenshots = asyncio.run(agent.execute(page, actions))

        self.assertEqual(confirmation, "Applied successfully")
        self.assertEqual(screenshots, [])
        self.assertEqual(page.calls[-1], ("click", agent.submit_selector, ""))

    def test_lever_apply_returns_applied_when_runner_succeeds(self) -> None:
        agent = LeverAgent()
        request = ApplyRequest(
            url="https://jobs.lever.co/weride/8f84c602-8a79-43f6-b662-74a92ef761f5",
            profile=make_request("https://jobs.lever.co/weride/8f84c602-8a79-43f6-b662-74a92ef761f5").profile,
            dry_run=False,
        )

        async def fake_runner(_: str, worker):
            class FakeLocator:
                async def inner_text(self) -> str:
                    return "  Lever application submitted successfully   confirmation #XYZ789  "

            class FakePage:
                async def fill(self, selector: str, value: str) -> None:
                    return None

                async def set_input_files(self, selector: str, value: str) -> None:
                    return None

                async def select_option(self, selector: str, value: str) -> None:
                    return None

                async def check(self, selector: str) -> None:
                    return None

                async def click(self, selector: str) -> None:
                    return None

                async def wait_for_timeout(self, timeout: int) -> None:
                    return None

                async def screenshot(self, **_: object) -> bytes:
                    return b"lever-success"

                def locator(self, selector: str) -> FakeLocator:
                    return FakeLocator()

            return await worker(FakePage())

        with patch("apply_engine.agents.lever.run_with_chromium", fake_runner):
            result = asyncio.run(agent.apply(request))

        self.assertEqual(result.status, "applied")
        self.assertEqual(
            result.confirmation_snippet,
            "Lever application submitted successfully confirmation #XYZ789",
        )
        self.assertEqual(len(result.screenshots), 2)
        self.assertEqual(result.screenshots[0].label, "form_filled")
        self.assertEqual(result.screenshots[1].label, "final_state")


class WorkdayAgentTests(unittest.TestCase):
    def test_workday_builds_expected_actions(self) -> None:
        from apply_engine.agents.workday import WorkdayAgent
        from apply_engine.portal_specs import WORKDAY_SELECTORS, WORKDAY_CUSTOM_SELECTORS

        agent = WorkdayAgent()
        request = make_request("https://company.myworkdayjobs.com/en-US/careers/job/New-York/Engineer_JR-12345")
        actions = agent.build_actions(request)

        self.assertTrue(any(
            a.action == "fill" and a.selector == WORKDAY_SELECTORS["first_name"] and a.value == "Test"
            for a in actions
        ))
        self.assertTrue(any(
            a.action == "fill" and a.selector == WORKDAY_SELECTORS["last_name"] and a.value == "User"
            for a in actions
        ))
        self.assertTrue(any(a.action == "upload" for a in actions))
        self.assertTrue(any(
            a.action == "check" and a.selector == WORKDAY_SELECTORS["sponsorship_no"]
            for a in actions
        ))
        self.assertTrue(any(
            a.action == "fill" and a.selector == WORKDAY_CUSTOM_SELECTORS["school"]["fill_selector"]
            for a in actions
        ))

    def test_workday_dry_run_returns_unsupported(self) -> None:
        from apply_engine.agents.workday import WorkdayAgent

        agent = WorkdayAgent()
        request = make_request("https://company.myworkdayjobs.com/en-US/careers/job/NYC/Eng_JR-999")
        result = asyncio.run(agent.apply(request))

        self.assertEqual(result.portal, "workday")
        self.assertEqual(result.status, "unsupported")
        self.assertGreater(len(result.actions), 0)

    def test_workday_apply_returns_applied_on_confirmation(self) -> None:
        from apply_engine.agents.workday import WorkdayAgent

        agent = WorkdayAgent()
        request = ApplyRequest(
            url="https://company.myworkdayjobs.com/en-US/careers/job/NYC/Eng_JR-1",
            profile=make_request("https://company.myworkdayjobs.com/en-US/careers/job/NYC/Eng_JR-1").profile,
            dry_run=False,
        )

        async def fake_runner(_: str, worker):
            step = {"count": 0}

            class FakeLocator:
                def __init__(self, *, text: str = "", count: int = 1) -> None:
                    self._text = text
                    self._count = count

                async def count(self) -> int:
                    return self._count

                async def inner_text(self) -> str:
                    return self._text

            class FakePage:
                async def fill(self, selector: str, value: str) -> None:
                    return None

                async def set_input_files(self, selector: str, value: str) -> None:
                    return None

                async def select_option(self, selector: str, value: str) -> None:
                    return None

                async def check(self, selector: str) -> None:
                    return None

                async def click(self, selector: str) -> None:
                    step["count"] += 1

                async def wait_for_timeout(self, timeout: int) -> None:
                    return None

                async def screenshot(self, **_: object) -> bytes:
                    return b"workday-screenshot"

                @property
                def url(self) -> str:
                    # Return confirmation URL after first click
                    if step["count"] >= 1:
                        return "https://company.myworkdayjobs.com/en-US/careers/job/thankYou"
                    return "https://company.myworkdayjobs.com/en-US/careers/job/NYC/Eng_JR-1"

                def locator(self, selector: str) -> FakeLocator:
                    if selector == "body":
                        if step["count"] >= 1:
                            return FakeLocator(text="Thank you for applying to this role.")
                        return FakeLocator(text="My Information - Step 1")
                    return FakeLocator(count=1)

            return await worker(FakePage())

        with patch("apply_engine.agents.workday.run_with_chromium", fake_runner):
            result = asyncio.run(agent.apply(request))

        self.assertEqual(result.portal, "workday")
        self.assertEqual(result.status, "applied")
        self.assertIn("Thank you", result.confirmation_snippet)

    def test_workday_apply_returns_requires_auth_on_login_wall(self) -> None:
        from apply_engine.agents.workday import WorkdayAgent

        agent = WorkdayAgent()
        request = ApplyRequest(
            url="https://company.myworkdayjobs.com/en-US/careers/job/NYC/Eng_JR-2",
            profile=make_request("https://company.myworkdayjobs.com/en-US/careers/job/NYC/Eng_JR-2").profile,
            dry_run=False,
        )

        async def fake_runner(_: str, worker):
            class FakeLocator:
                def __init__(self, *, text: str = "", count: int = 1) -> None:
                    self._text = text
                    self._count = count

                async def count(self) -> int:
                    return self._count

                async def inner_text(self) -> str:
                    return self._text

            class FakePage:
                async def fill(self, selector: str, value: str) -> None:
                    return None

                async def set_input_files(self, selector: str, value: str) -> None:
                    return None

                async def select_option(self, selector: str, value: str) -> None:
                    return None

                async def check(self, selector: str) -> None:
                    return None

                async def click(self, selector: str) -> None:
                    return None

                async def wait_for_timeout(self, timeout: int) -> None:
                    return None

                async def screenshot(self, **_: object) -> bytes:
                    return b"workday-auth"

                @property
                def url(self) -> str:
                    return "https://company.myworkdayjobs.com/login"

                def locator(self, selector: str) -> FakeLocator:
                    return FakeLocator(
                        text="Sign in to continue your application. Log in or create an account.",
                        count=1,
                    )

            return await worker(FakePage())

        with patch("apply_engine.agents.workday.run_with_chromium", fake_runner):
            result = asyncio.run(agent.apply(request))

        self.assertEqual(result.portal, "workday")
        self.assertEqual(result.status, "requires_auth")

    def test_workday_sponsorship_yes_when_required(self) -> None:
        from apply_engine.agents.workday import WorkdayAgent
        from apply_engine.portal_specs import WORKDAY_SELECTORS

        agent = WorkdayAgent()
        request = make_request("https://company.myworkdayjobs.com/en-US/careers/job/NYC/Eng_JR-3")
        request.profile.sponsorship_required = True
        actions = agent.build_actions(request)

        self.assertTrue(any(
            a.action == "check" and a.selector == WORKDAY_SELECTORS["sponsorship_yes"]
            for a in actions
        ))
        self.assertFalse(any(
            a.action == "check" and a.selector == WORKDAY_SELECTORS["sponsorship_no"]
            for a in actions
        ))


if __name__ == "__main__":
    unittest.main()
