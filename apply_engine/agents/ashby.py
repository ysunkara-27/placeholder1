from __future__ import annotations

from apply_engine.agents.base import PortalAgent
from apply_engine.browser import (
    AuthRequiredError,
    ActionExecutionError,
    capture_page_screenshot,
    complete_submission_flow,
    exception_screenshots,
    normalize_confirmation_text,
    run_with_chromium,
)
from apply_engine.models import ApplicantProfile, ApplyRequest, ApplyResult, CapturedScreenshot
from apply_engine.portal_specs import ASHBY_SELECTORS


class AshbyAgent(PortalAgent):
    """Deterministic agent for Ashby (jobs.ashbyhq.com) application portals.

    Ashby uses React with data-testid / name attributes. The apply button
    may open a modal or navigate to a new page. Name fields may be split
    (first/last) or combined (full name). We handle both patterns.
    """

    portal_name = "ashby"

    async def apply(self, request: ApplyRequest) -> ApplyResult:
        if request.dry_run:
            return ApplyResult(
                portal="ashby",
                status="unsupported",
                actions=[],
            )

        screenshots: list[CapturedScreenshot] = []

        try:
            async def worker(page: object) -> str:
                return await self._execute(page, request.profile, screenshots)

            confirmation = await run_with_chromium(request.url, worker)
            return ApplyResult(
                portal="ashby",
                status="applied",
                confirmation_snippet=normalize_confirmation_text(confirmation),
                actions=[],
                screenshots=screenshots,
            )
        except AuthRequiredError as exc:
            return ApplyResult(
                portal="ashby",
                status="requires_auth",
                actions=[],
                error=normalize_confirmation_text(str(exc)),
                screenshots=exception_screenshots(exc) or screenshots,
            )
        except ActionExecutionError as exc:
            return ApplyResult(
                portal="ashby",
                status="failed",
                actions=[],
                error=normalize_confirmation_text(str(exc)),
                screenshots=exception_screenshots(exc) or screenshots,
            )
        except Exception as exc:
            return ApplyResult(
                portal="ashby",
                status="failed",
                actions=[],
                error=str(exc)[:200],
                screenshots=exception_screenshots(exc) or screenshots,
            )

    async def _execute(
        self,
        page: object,
        profile: ApplicantProfile,
        screenshots: list[CapturedScreenshot],
    ) -> str:
        # Wait for page to fully load
        if hasattr(page, "wait_for_load_state"):
            await page.wait_for_load_state("networkidle", timeout=20_000)  # type: ignore[attr-defined]

        # Click the Apply button if present (some job detail pages have one)
        apply_btn = await page.query_selector(ASHBY_SELECTORS["apply_button"])  # type: ignore[attr-defined]
        if apply_btn:
            await apply_btn.click()
            if hasattr(page, "wait_for_load_state"):
                await page.wait_for_load_state("networkidle", timeout=10_000)  # type: ignore[attr-defined]

        # Fill name — detect full vs split
        full_name_el = await page.query_selector(ASHBY_SELECTORS["full_name"])  # type: ignore[attr-defined]
        if full_name_el:
            placeholder = (await full_name_el.get_attribute("placeholder") or "").lower()
            if "first" in placeholder:
                await full_name_el.fill(profile.first_name)
                last_el = await page.query_selector(ASHBY_SELECTORS["last_name"])  # type: ignore[attr-defined]
                if last_el:
                    await last_el.fill(profile.last_name)
            else:
                full_name = f"{profile.first_name} {profile.last_name}".strip()
                await full_name_el.fill(full_name)
        else:
            await self._try_fill(page, ASHBY_SELECTORS["first_name"], profile.first_name)
            await self._try_fill(page, ASHBY_SELECTORS["last_name"], profile.last_name)

        await self._try_fill(page, ASHBY_SELECTORS["email"], profile.email)
        await self._try_fill(page, ASHBY_SELECTORS["phone"], profile.phone)
        await self._try_fill(page, ASHBY_SELECTORS["linkedin"], profile.linkedin)
        await self._try_fill(page, ASHBY_SELECTORS["website"], profile.website)
        await self._try_fill(page, ASHBY_SELECTORS["github"], profile.github)

        city = profile.city
        if city and profile.state_region:
            city = f"{city}, {profile.state_region}"
        await self._try_fill(page, ASHBY_SELECTORS["location"], city)

        if profile.resume_pdf_path:
            await self._try_upload(page, ASHBY_SELECTORS["resume_upload"], profile.resume_pdf_path)

        # Fill unfilled custom questions by scanning placeholder/label text
        await self._fill_custom_questions(page, profile)

        shot = await capture_page_screenshot(page, "pre_submit")
        if shot:
            screenshots.append(shot)

        confirmation = await complete_submission_flow(
            page,
            submit_selector=ASHBY_SELECTORS["submit"],
            next_selector=ASHBY_SELECTORS["next"],
            max_steps=6,
        )

        shot = await capture_page_screenshot(page, "post_submit")
        if shot:
            screenshots.append(shot)

        return confirmation

    async def _fill_custom_questions(self, page: object, profile: ApplicantProfile) -> None:
        """Scan remaining unfilled text inputs and fill by placeholder keyword."""
        inputs = await page.query_selector_all("input[type='text'], textarea")  # type: ignore[attr-defined]
        for inp in inputs:
            try:
                val = await inp.input_value()
                if val:
                    continue  # already filled

                placeholder = (await inp.get_attribute("placeholder") or "").lower()
                label_text = await self._get_label_text(page, inp)

                hint = placeholder or label_text

                # Skip fields we already handled via selectors
                if any(kw in hint for kw in ["linkedin", "github", "website", "portfolio", "name", "email", "phone", "location"]):
                    continue

                if any(kw in hint for kw in ["school", "university", "college", "institution"]):
                    await inp.fill(profile.school or profile.custom_answers.get("school", ""))
                elif any(kw in hint for kw in ["major", "field of study", "concentration"]):
                    await inp.fill(profile.major or profile.custom_answers.get("major", ""))
                elif "gpa" in hint:
                    await inp.fill(profile.gpa or profile.custom_answers.get("gpa", ""))
                elif any(kw in hint for kw in ["grad", "graduation", "class year", "expected"]):
                    await inp.fill(profile.graduation or profile.graduation_window or "")
                elif any(kw in hint for kw in ["start date", "available", "earliest"]):
                    await inp.fill(profile.start_date or "")
                elif any(kw in hint for kw in ["salary", "compensation", "pay"]):
                    await inp.fill(profile.salary_expectation or "")
                elif any(kw in hint for kw in ["how did you hear", "referral", "source"]):
                    await inp.fill("Company Website")
                elif any(kw in hint for kw in ["years of experience", "how many years"]):
                    await inp.fill("0-1")
            except Exception:  # noqa: BLE001
                continue

    async def _get_label_text(self, page: object, element: object) -> str:
        """Try to find the label associated with a form element."""
        try:
            el_id = await element.get_attribute("id")
            if el_id:
                label = await page.query_selector(f"label[for='{el_id}']")  # type: ignore[attr-defined]
                if label:
                    text = await label.inner_text()
                    return text.lower().strip()
        except Exception:  # noqa: BLE001
            pass
        return ""

    @staticmethod
    async def _try_fill(page: object, selector: str, value: str) -> None:
        if not value or not selector:
            return
        try:
            el = await page.query_selector(selector)  # type: ignore[attr-defined]
            if el:
                await el.fill(value)
        except Exception:  # noqa: BLE001
            pass

    @staticmethod
    async def _try_upload(page: object, selector: str, path: str) -> None:
        if not path or not selector:
            return
        try:
            el = await page.query_selector(selector)  # type: ignore[attr-defined]
            if el:
                await page.set_input_files(selector, path)  # type: ignore[attr-defined]
        except Exception:  # noqa: BLE001
            pass
