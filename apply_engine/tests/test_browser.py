import asyncio
import base64
import unittest

from apply_engine.browser import (
    AuthRequiredError,
    SubmissionBlockedError,
    capture_page_screenshot,
    complete_submission_flow,
    execute_actions,
    extract_page_url,
    extract_validation_issues,
    looks_like_auth_wall,
    looks_like_confirmation,
    looks_like_confirmation_url,
    looks_like_review_step,
    normalize_confirmation_text,
)
from apply_engine.models import PlannedAction


class FakeLocator:
    def __init__(self, count: int = 1, inner_text: str = "Applied   successfully \n confirmation #123") -> None:
        self._count = count
        self._inner_text = inner_text

    async def count(self) -> int:
        return self._count

    async def inner_text(self) -> str:
        return self._inner_text


class FakePage:
    def __init__(
        self,
        missing_selectors: set[str] | None = None,
        body_texts: list[str] | None = None,
        url: str = "https://jobs.example.com/apply",
    ) -> None:
        self.calls: list[tuple[str, str, str]] = []
        self.missing_selectors = missing_selectors or set()
        self.body_texts = body_texts or ["Applied   successfully \n confirmation #123"]
        self.body_index = 0
        self.url = url

    async def fill(self, selector: str, value: str) -> None:
        self.calls.append(("fill", selector, value))

    async def set_input_files(self, selector: str, value: str) -> None:
        self.calls.append(("upload", selector, value))

    async def select_option(self, selector: str, value: str) -> None:
        self.calls.append(("select", selector, value))

    async def click(self, selector: str) -> None:
        self.calls.append(("click", selector, ""))
        if self.body_index < len(self.body_texts) - 1:
            self.body_index += 1

    async def check(self, selector: str) -> None:
        self.calls.append(("check", selector, ""))

    async def uncheck(self, selector: str) -> None:
        self.calls.append(("uncheck", selector, ""))

    async def screenshot(self, **_: object) -> bytes:
        return b"fake-png"

    def locator(self, selector: str) -> FakeLocator:
        if selector == "body":
            return FakeLocator(1, self.body_texts[self.body_index])
        return FakeLocator(0 if selector in self.missing_selectors else 1)

    async def wait_for_timeout(self, _: int) -> None:
        return None


class BrowserTests(unittest.TestCase):
    def test_execute_actions_runs_in_order(self) -> None:
        page = FakePage()
        actions = [
            PlannedAction("fill", "input[name=email]", "test@example.com"),
            PlannedAction("upload", "input[type=file]", "/tmp/resume.pdf"),
            PlannedAction("select", "select[name=country]", "US"),
            PlannedAction("check", 'input[name="authorized"][value="yes"]'),
            PlannedAction("uncheck", 'input[name="marketing_opt_in"]'),
            PlannedAction("click", "button[type=submit]"),
        ]

        asyncio.run(execute_actions(page, actions))

        self.assertEqual(
            page.calls,
            [
                ("fill", "input[name=email]", "test@example.com"),
                ("upload", "input[type=file]", "/tmp/resume.pdf"),
                ("select", "select[name=country]", "US"),
                ("check", 'input[name="authorized"][value="yes"]', ""),
                ("uncheck", 'input[name="marketing_opt_in"]', ""),
                ("click", "button[type=submit]", ""),
            ],
        )

    def test_normalizes_confirmation_text(self) -> None:
        self.assertEqual(
            normalize_confirmation_text("Applied   successfully \n confirmation #123"),
            "Applied successfully confirmation #123",
        )

    def test_detects_confirmation_text(self) -> None:
        self.assertTrue(looks_like_confirmation("Thanks for applying to Twin"))
        self.assertFalse(looks_like_confirmation("Review your application details"))

    def test_detects_auth_wall_text(self) -> None:
        self.assertTrue(looks_like_auth_wall("Please sign in to continue your application"))
        self.assertFalse(looks_like_auth_wall("Review your application details"))

    def test_detects_confirmation_url(self) -> None:
        self.assertTrue(looks_like_confirmation_url("https://jobs.example.com/thank-you"))
        self.assertFalse(looks_like_confirmation_url("https://jobs.example.com/apply"))

    def test_extracts_page_url(self) -> None:
        page = FakePage(url="https://jobs.example.com/confirmation")
        self.assertEqual(extract_page_url(page), "https://jobs.example.com/confirmation")

    def test_capture_page_screenshot_encodes_png_bytes(self) -> None:
        page = FakePage()

        screenshot = asyncio.run(capture_page_screenshot(page, "form_filled"))

        self.assertIsNotNone(screenshot)
        assert screenshot is not None
        self.assertEqual(screenshot.label, "form_filled")
        self.assertEqual(screenshot.mime_type, "image/png")
        self.assertEqual(
            screenshot.data_base64,
            base64.b64encode(b"fake-png").decode("ascii"),
        )

    def test_detects_review_step_text(self) -> None:
        self.assertTrue(looks_like_review_step("Final review before you submit your application"))
        self.assertFalse(looks_like_review_step("Step 1 of application"))

    def test_extracts_validation_issues(self) -> None:
        issues = extract_validation_issues(
            "Please enter a valid email\nPortfolio URL is required\nThanks for reviewing"
        )

        self.assertEqual(
            issues,
            ["Please enter a valid email", "Portfolio URL is required"],
        )

    def test_optional_actions_skip_missing_selectors(self) -> None:
        page = FakePage(missing_selectors={"input[name=linkedin]"})
        actions = [
            PlannedAction("fill", "input[name=email]", "test@example.com"),
            PlannedAction("fill", "input[name=linkedin]", "https://linkedin.com/in/test", required=False),
        ]

        asyncio.run(execute_actions(page, actions))

        self.assertEqual(
          page.calls,
          [("fill", "input[name=email]", "test@example.com")],
        )

    def test_required_actions_raise_on_missing_selector(self) -> None:
        page = FakePage(missing_selectors={"input[name=email]"})
        actions = [PlannedAction("fill", "input[name=email]", "test@example.com")]

        with self.assertRaises(Exception):
            asyncio.run(execute_actions(page, actions))

    def test_complete_submission_flow_clicks_next_then_submit(self) -> None:
        page = FakePage(
            body_texts=[
                "Step 1 of application",
                "Review your application details",
                "Thank you for applying to Twin",
            ]
        )

        result = asyncio.run(
            complete_submission_flow(
                page,
                submit_selector='button[type="submit"]',
                next_selector='button:has-text("Next")',
            )
        )

        self.assertEqual(
            page.calls,
            [
                ("click", 'button:has-text("Next")', ""),
                ("click", 'button[type="submit"]', ""),
            ],
        )
        self.assertEqual(result, "Thank you for applying to Twin")

    def test_complete_submission_flow_returns_after_submit_confirmation(self) -> None:
        page = FakePage(
            missing_selectors={'button:has-text("Next")'},
            body_texts=[
                "Final review page",
                "Application submitted successfully confirmation #ABC123",
            ],
        )

        result = asyncio.run(
            complete_submission_flow(
                page,
                submit_selector='button[type="submit"]',
                next_selector='button:has-text("Next")',
            )
        )

        self.assertEqual(page.calls, [("click", 'button[type="submit"]', "")])
        self.assertEqual(
            result,
            "Application submitted successfully confirmation #ABC123",
        )

    def test_complete_submission_flow_prefers_submit_on_review_step(self) -> None:
        page = FakePage(
            body_texts=[
                "Review your application details",
                "Thanks for applying to Twin",
            ],
        )

        result = asyncio.run(
            complete_submission_flow(
                page,
                submit_selector='button[type="submit"]',
                next_selector='button:has-text("Next")',
            )
        )

        self.assertEqual(page.calls, [("click", 'button[type="submit"]', "")])
        self.assertEqual(result, "Thanks for applying to Twin")

    def test_complete_submission_flow_raises_auth_required(self) -> None:
        page = FakePage(body_texts=["Sign in to continue your application"])

        with self.assertRaises(AuthRequiredError):
            asyncio.run(
                complete_submission_flow(
                    page,
                    submit_selector='button[type="submit"]',
                    next_selector='button:has-text("Next")',
                )
            )

    def test_complete_submission_flow_raises_when_validation_blocks_submit(self) -> None:
        page = FakePage(
            missing_selectors={'button:has-text("Next")'},
            body_texts=[
                "Final review page",
                "Please enter a valid email\nPhone is required",
            ],
        )

        with self.assertRaises(SubmissionBlockedError):
            asyncio.run(
                complete_submission_flow(
                    page,
                    submit_selector='button[type="submit"]',
                    next_selector='button:has-text("Next")',
                )
            )

    def test_complete_submission_flow_returns_when_url_changes_to_confirmation(self) -> None:
        class RedirectingPage(FakePage):
            async def click(self, selector: str) -> None:
                await super().click(selector)
                self.url = "https://jobs.example.com/application/confirmation"

        page = RedirectingPage(
            missing_selectors={'button:has-text("Next")'},
            body_texts=[
                "Submitting your application",
                "We are processing your submission",
            ],
        )

        result = asyncio.run(
            complete_submission_flow(
                page,
                submit_selector='button[type="submit"]',
                next_selector='button:has-text("Next")',
            )
        )

        self.assertEqual(page.calls, [("click", 'button[type="submit"]', "")])
        self.assertEqual(result, "We are processing your submission")


if __name__ == "__main__":
    unittest.main()
