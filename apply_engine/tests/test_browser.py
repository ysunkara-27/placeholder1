import asyncio
import base64
import unittest

from apply_engine.browser import (
    AuthRequiredError,
    SubmissionBlockedError,
    capture_page_screenshot,
    click_preferred_selector,
    complete_submission_flow,
    describe_application_step,
    execute_actions,
    extract_page_url,
    extract_validation_issues,
    inspect_missing_required_fields,
    looks_like_auth_wall,
    looks_like_confirmation,
    looks_like_confirmation_url,
    looks_like_manual_verification_error,
    looks_like_review_step,
    normalize_confirmation_text,
)
from apply_engine.models import PlannedAction


class FakeLocator:
    def __init__(
        self,
        count: int = 1,
        inner_text: str = "Applied   successfully \n confirmation #123",
        visible: bool = True,
    ) -> None:
        self._count = count
        self._inner_text = inner_text
        self._visible = visible
        self.clicked = False

    async def count(self) -> int:
        return self._count

    async def inner_text(self) -> str:
        return self._inner_text

    def nth(self, _index: int):
        return self

    async def is_visible(self) -> bool:
        return self._visible

    async def click(self) -> None:
        self.clicked = True


class FakePage:
    def __init__(
        self,
        missing_selectors: set[str] | None = None,
        body_texts: list[str] | None = None,
        url: str = "https://jobs.example.com/apply",
        required_issues: list[str] | None = None,
    ) -> None:
        self.calls: list[tuple[str, str, str]] = []
        self.missing_selectors = missing_selectors or set()
        self.body_texts = body_texts or ["Applied   successfully \n confirmation #123"]
        self.body_index = 0
        self.url = url
        self.required_issues = required_issues or []

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

    async def evaluate(self, _script: str, arg: object | None = None):
        if isinstance(arg, dict) and arg.get("selector") == 'select[name="gender"]':
            return [
                {"label": "Female", "value": "female", "index": "1"},
                {"label": "Male", "value": "male", "index": "2"},
            ]
        return []

    async def wait_for_timeout(self, _: int) -> None:
        return None


class FakeKeyboard:
    def __init__(self, calls: list[tuple[str, str, str]]) -> None:
        self.calls = calls

    async def press(self, key: str) -> None:
        self.calls.append(("keyboard", key, ""))


class FakeComboboxLocator(FakeLocator):
    def __init__(self, page: "FakeComboboxPage", selector: str, visible: bool = True) -> None:
        super().__init__(1, visible=visible)
        self.page = page
        self.selector = selector

    async def fill(self, value: str) -> None:
        self.page.calls.append(("fill", self.selector, value))

    async def press_sequentially(self, value: str) -> None:
        self.page.calls.append(("type", self.selector, value))


class FakeComboboxPage(FakePage):
    def __init__(self) -> None:
        super().__init__()
        self.keyboard = FakeKeyboard(self.calls)

    def locator(self, selector: str):
        if selector == "body":
            return FakeLocator(1, self.body_texts[self.body_index])
        if selector in {"#school--0", 'input[id^="school--"]'}:
            return FakeComboboxLocator(self, selector)
        if selector == '#react-select-school--0-option-0, [id^="react-select-school--0-option-"]':
            return FakeLocator(1, visible=True)
        return FakeLocator(1)

    async def evaluate(self, _script: str, arg: object | None = None):
        if isinstance(arg, dict) and arg.get("selector") in {"#school--0", 'input[id^="school--"]'}:
            if "element.id" in _script:
                return "school--0"
            return True
        if isinstance(arg, dict) and arg.get("inputId") == "school--0":
            return [{"selector": "#react-select-school--0-option-0", "label": "Stanford University"}]
        return await super().evaluate(_script, arg)


class BrowserTests(unittest.TestCase):
    def test_execute_actions_prefers_visible_fill_selector(self) -> None:
        class VisibleChoicePage(FakePage):
            def __init__(self) -> None:
                super().__init__()
                self.locators = {
                    'input[name="school"]': FakeLocator(1, visible=False),
                    'input[id^="school--"]': FakeLocator(1, visible=True),
                }

            def locator(self, selector: str) -> FakeLocator:
                if selector == "body":
                    return FakeLocator(1, self.body_texts[self.body_index])
                if selector == 'input[name="school"], input[id^="school--"]':
                    return FakeLocator(1)
                return self.locators.get(selector, FakeLocator(0))

        page = VisibleChoicePage()
        actions = [
            PlannedAction(
                "fill",
                'input[name="school"], input[id^="school--"]',
                "Stanford University",
            )
        ]

        asyncio.run(execute_actions(page, actions))

        self.assertEqual(
            page.calls,
            [("fill", 'input[id^="school--"]', "Stanford University")],
        )

    def test_execute_actions_uses_combobox_flow_for_combobox_inputs(self) -> None:
        page = FakeComboboxPage()
        actions = [PlannedAction("fill", 'input[id^="school--"]', "Stanford University")]

        asyncio.run(execute_actions(page, actions))

        self.assertEqual(
            page.calls,
            [
                ("click", 'input[id^="school--"]', ""),
                ("fill", 'input[id^="school--"]', ""),
                ("type", 'input[id^="school--"]', "Stanford University"),
                ("click", "#react-select-school--0-option-0", ""),
                ("keyboard", "Tab", ""),
            ],
        )

    def test_click_preferred_selector_uses_visible_candidate(self) -> None:
        class VisibleChoicePage(FakePage):
            def __init__(self) -> None:
                super().__init__()
                self.locators = {
                    'button[data-qa="btn-submit"]': FakeLocator(1, visible=True),
                    'button[type="submit"]': FakeLocator(1, visible=False),
                }

            def locator(self, selector: str) -> FakeLocator:
                if selector == "body":
                    return FakeLocator(1, self.body_texts[self.body_index])
                return self.locators.get(selector, FakeLocator(0))

        page = VisibleChoicePage()

        asyncio.run(
            click_preferred_selector(
                page,
                'button[data-qa="btn-submit"], button[type="submit"]',
            )
        )

        self.assertEqual(page.calls, [("click", 'button[data-qa="btn-submit"]', "")])

    def test_click_preferred_selector_raises_auth_required_for_captcha_intercept(self) -> None:
        class CaptchaInterceptPage(FakePage):
            async def click(self, selector: str) -> None:
                raise RuntimeError(
                    'Page.click: Timeout 30000ms exceeded. <iframe title="Widget containing checkbox for hCaptcha security challenge"> subtree intercepts pointer events'
                )

        page = CaptchaInterceptPage()

        with self.assertRaises(AuthRequiredError):
            asyncio.run(click_preferred_selector(page, 'button[type="submit"]'))

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

    def test_execute_actions_resolves_select_option_from_dom(self) -> None:
        class SelectFallbackPage(FakePage):
            async def select_option(self, selector: str, value: str) -> None:
                if selector == 'select[name="gender"]' and value == "Woman":
                    raise RuntimeError(
                        "Page.select_option: Timeout 30000ms exceeded. did not find some options"
                    )
                await super().select_option(selector, value)

        page = SelectFallbackPage()
        actions = [PlannedAction("select", 'select[name="gender"]', "Woman")]

        asyncio.run(execute_actions(page, actions))

        self.assertEqual(
            page.calls,
            [("select", 'select[name="gender"]', "female")],
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

    def test_detects_manual_verification_error_text(self) -> None:
        self.assertTrue(
            looks_like_manual_verification_error(
                'Page.click: Timeout 30000ms exceeded. <iframe title="Widget containing checkbox for hCaptcha security challenge"> subtree intercepts pointer events'
            )
        )
        self.assertFalse(looks_like_manual_verification_error("Review your application details"))

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

    def test_describes_application_step_from_common_labels(self) -> None:
        self.assertEqual(
            describe_application_step("Additional Questions\nTell us more about your background", step_index=1),
            "additional_questions",
        )
        self.assertEqual(
            describe_application_step("Random unlabeled content", step_index=2),
            "random_unlabeled_content",
        )

    def test_extracts_validation_issues(self) -> None:
        issues = extract_validation_issues(
            "Please enter a valid email\nPortfolio URL is required\nThanks for reviewing"
        )

        self.assertEqual(
            issues,
            ["Please enter a valid email", "Portfolio URL is required"],
        )

    def test_inspect_missing_required_fields_uses_page_preset_when_available(self) -> None:
        page = FakePage(required_issues=["Portfolio URL is required", "Phone is required"])

        issues = asyncio.run(inspect_missing_required_fields(page))

        self.assertEqual(issues, ["Portfolio URL is required", "Phone is required"])

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

        with self.assertRaisesRegex(SubmissionBlockedError, "please_enter_a_valid_email"):
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

    def test_complete_submission_flow_raises_when_dom_required_fields_missing(self) -> None:
        page = FakePage(
            missing_selectors={'button:has-text("Next")'},
            body_texts=["Review your application details"],
            required_issues=["Portfolio URL is required", "Phone is required"],
        )

        with self.assertRaises(SubmissionBlockedError):
            asyncio.run(
                complete_submission_flow(
                    page,
                    submit_selector='button[type="submit"]',
                    next_selector='button:has-text("Next")',
                )
            )

    def test_complete_submission_flow_invokes_step_callback_each_iteration(self) -> None:
        page = FakePage(
            body_texts=[
                "Step 1 of application",
                "Review your application details",
                "Thank you for applying to Twin",
            ]
        )
        seen_steps: list[int] = []

        async def on_step(_page, step_index: int) -> None:
            seen_steps.append(step_index)

        result = asyncio.run(
            complete_submission_flow(
                page,
                submit_selector='button[type="submit"]',
                next_selector='button:has-text("Next")',
                on_step=on_step,
            )
        )

        self.assertEqual(result, "Thank you for applying to Twin")
        self.assertEqual(seen_steps, [0, 1])

    def test_complete_submission_flow_retries_step_callback_before_required_failure(self) -> None:
        page = FakePage(
            missing_selectors={'button:has-text("Next")'},
            body_texts=[
                "Review your application details",
                "Thank you for applying to Twin",
            ],
            required_issues=["Portfolio URL is required"],
        )
        calls = {"count": 0}

        async def on_step(retry_page, _step_index: int) -> None:
            calls["count"] += 1
            if calls["count"] == 2:
                retry_page.required_issues = []

        result = asyncio.run(
            complete_submission_flow(
                page,
                submit_selector='button[type="submit"]',
                next_selector='button:has-text("Next")',
                on_step=on_step,
            )
        )

        self.assertEqual(result, "Thank you for applying to Twin")
        self.assertEqual(page.calls, [("click", 'button[type="submit"]', "")])
        self.assertEqual(calls["count"], 2)

    def test_complete_submission_flow_raises_when_application_stalls(self) -> None:
        page = FakePage(
            missing_selectors={'button:has-text("Next")', 'button[type="submit"]'},
            body_texts=["Still on the same page"],
        )

        with self.assertRaisesRegex(SubmissionBlockedError, "Application flow stalled on still_on_the_same_page"):
            asyncio.run(
                complete_submission_flow(
                    page,
                    submit_selector='button[type="submit"]',
                    next_selector='button:has-text("Next")',
                )
            )

    def test_complete_submission_flow_raises_when_step_callback_times_out(self) -> None:
        page = FakePage(
            body_texts=[
                "Step 1 of application",
                "Review your application details",
            ]
        )

        async def slow_on_step(_page, _step_index: int) -> None:
            await asyncio.sleep(0.05)

        with self.assertRaisesRegex(SubmissionBlockedError, "step_0: timed out during step_fill"):
            asyncio.run(
                complete_submission_flow(
                    page,
                    submit_selector='button[type="submit"]',
                    next_selector='button:has-text("Next")',
                    on_step=slow_on_step,
                    step_timeout_seconds=0.01,
                )
            )


if __name__ == "__main__":
    unittest.main()
