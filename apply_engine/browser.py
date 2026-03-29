from __future__ import annotations

import base64
import re
from typing import Any, Callable, Awaitable

from apply_engine.models import CapturedScreenshot, PlannedAction


class ActionExecutionError(RuntimeError):
    pass


class AuthRequiredError(ActionExecutionError):
    pass


class SubmissionBlockedError(ActionExecutionError):
    pass


def exception_screenshots(exc: BaseException) -> list[CapturedScreenshot]:
    screenshots = getattr(exc, "_twin_screenshots", None)
    return screenshots if isinstance(screenshots, list) else []


async def selector_exists(page: Any, selector: str) -> bool:
    if hasattr(page, "locator"):
        locator = page.locator(selector)
        count = getattr(locator, "count", None)
        if callable(count):
            return await count() > 0
    return True


async def execute_actions(page: Any, actions: list[PlannedAction]) -> None:
    for action in actions:
        exists = await selector_exists(page, action.selector)

        if not exists:
            if action.required:
                raise ActionExecutionError(f"Required selector not found: {action.selector}")
            continue

        if action.action == "fill":
            await page.fill(action.selector, action.value)
        elif action.action == "upload":
            await page.set_input_files(action.selector, action.value)
        elif action.action == "select":
            await page.select_option(action.selector, action.value)
        elif action.action == "click":
            await page.click(action.selector)
        elif action.action == "check":
            if hasattr(page, "check"):
                await page.check(action.selector)
            else:
                await page.click(action.selector)
        elif action.action == "uncheck":
            if hasattr(page, "uncheck"):
                await page.uncheck(action.selector)
            else:
                await page.click(action.selector)


async def capture_page_screenshot(
    page: Any,
    label: str,
    *,
    full_page: bool = True,
) -> CapturedScreenshot | None:
    screenshot = getattr(page, "screenshot", None)
    if not callable(screenshot):
        return None

    data = await screenshot(type="png", full_page=full_page)
    if not isinstance(data, (bytes, bytearray)):
        return None

    return CapturedScreenshot(
        label=label,
        mime_type="image/png",
        data_base64=base64.b64encode(bytes(data)).decode("ascii"),
    )


def normalize_confirmation_text(text: str, *, limit: int = 200) -> str:
    normalized = " ".join(text.split())
    return normalized[:limit]


async def extract_body_text(page: Any) -> str:
    return await page.locator("body").inner_text()


def extract_page_url(page: Any) -> str:
    url = getattr(page, "url", "")
    if callable(url):
        try:
            value = url()
        except TypeError:
            return ""
        return value if isinstance(value, str) else ""
    return url if isinstance(url, str) else ""


def looks_like_confirmation_url(url: str) -> bool:
    normalized = url.strip().lower()
    patterns = [
        r"/thanks\b",
        r"/thank-you\b",
        r"/confirmation\b",
        r"/submitted\b",
        r"/success\b",
        r"application_submitted",
    ]
    return any(re.search(pattern, normalized) for pattern in patterns)


def looks_like_confirmation(text: str) -> bool:
    normalized = normalize_confirmation_text(text, limit=10_000).lower()
    patterns = [
        r"\bapplication submitted\b",
        r"\bapplied successfully\b",
        r"\bthank you for applying\b",
        r"\bthanks for applying\b",
        r"\bsubmission received\b",
        r"\bconfirmation\b",
    ]
    return any(re.search(pattern, normalized) for pattern in patterns)


def looks_like_auth_wall(text: str) -> bool:
    normalized = normalize_confirmation_text(text, limit=10_000).lower()
    patterns = [
        r"\bsign in\b",
        r"\blog in\b",
        r"\bcreate an account\b",
        r"\bcontinue with google\b",
        r"\buse your account\b",
    ]
    return any(re.search(pattern, normalized) for pattern in patterns)


def looks_like_review_step(text: str) -> bool:
    normalized = normalize_confirmation_text(text, limit=10_000).lower()
    patterns = [
        r"\breview your application\b",
        r"\bfinal review\b",
        r"\breview your details\b",
        r"\bsubmit your application\b",
    ]
    return any(re.search(pattern, normalized) for pattern in patterns)


def extract_validation_issues(text: str) -> list[str]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    patterns = [
        r"\brequired\b",
        r"\binvalid\b",
        r"\bplease enter\b",
        r"\bplease select\b",
        r"\bplease provide\b",
        r"\bcomplete this field\b",
        r"\bmissing\b",
        r"\berror\b",
    ]
    issues: list[str] = []

    for line in lines:
        normalized = line.lower()
        if any(re.search(pattern, normalized) for pattern in patterns):
            issues.append(normalize_confirmation_text(line, limit=160))

    return issues


async def complete_submission_flow(
    page: Any,
    *,
    submit_selector: str,
    next_selector: str | None = None,
    max_steps: int = 4,
    max_next_steps: int = 2,
) -> str:
    next_steps_taken = 0
    submit_attempted = False

    for _ in range(max_steps):
        body_text = await extract_body_text(page)
        if looks_like_confirmation(body_text):
            return body_text
        if looks_like_confirmation_url(extract_page_url(page)):
            return body_text
        if looks_like_auth_wall(body_text):
            raise AuthRequiredError(normalize_confirmation_text(body_text))

        validation_issues = extract_validation_issues(body_text)
        if submit_attempted and validation_issues:
            raise SubmissionBlockedError("; ".join(validation_issues[:3]))

        if (
            not looks_like_review_step(body_text)
            and next_selector
            and next_steps_taken < max_next_steps
            and await selector_exists(page, next_selector)
        ):
            await page.click(next_selector)
            await page.wait_for_timeout(1200)
            next_steps_taken += 1
            continue

        if await selector_exists(page, submit_selector):
            await page.click(submit_selector)
            await page.wait_for_timeout(2000)
            submit_attempted = True
            body_text = await extract_body_text(page)
            if looks_like_confirmation(body_text):
                return body_text
            if looks_like_confirmation_url(extract_page_url(page)):
                return body_text
            continue

        if validation_issues:
            raise SubmissionBlockedError("; ".join(validation_issues[:3]))
        return body_text

    final_body_text = await extract_body_text(page)
    if looks_like_confirmation_url(extract_page_url(page)):
        return final_body_text
    if looks_like_auth_wall(final_body_text):
        raise AuthRequiredError(normalize_confirmation_text(final_body_text))

    final_issues = extract_validation_issues(final_body_text)
    if final_issues:
        raise SubmissionBlockedError("; ".join(final_issues[:3]))

    return final_body_text


async def run_with_chromium(
    url: str,
    worker: Callable[[Any], Awaitable[str]],
) -> str:
    try:
        from playwright.async_api import async_playwright
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError(
            "playwright is not installed. Install apply_engine/requirements.txt and run `playwright install chromium`."
        ) from exc

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        page = await browser.new_page()
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
            confirmation = await worker(page)
            return confirmation
        finally:
            await browser.close()
