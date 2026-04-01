"""
Ashby ATS agent — full production implementation.

Ashby forms are React-based SPA applications. They typically:
1. Show an initial "Apply" button or land directly on the form
2. Render all fields on a single scrollable page (or 2–3 steps)
3. Use data-testid attributes + standard HTML form elements
4. Have custom questions rendered after the contact section

This agent uses the same hint-scanning pipeline as Greenhouse/Lever.
"""
from __future__ import annotations

import asyncio

from apply_engine.agents.base import PortalAgent
from apply_engine.agents.common import (
    attempt_recovery_for_blocked_family,
    collect_unresolved_required_questions,
    fill_detected_questions_by_hint,
)
from apply_engine.browser import (
    ActionExecutionError,
    AuthRequiredError,
    SubmissionBlockedError,
    capture_page_screenshot,
    exception_screenshots,
    extract_body_text,
    looks_like_auth_wall,
    looks_like_confirmation,
    normalize_confirmation_text,
    run_with_chromium,
    selector_exists,
)
from apply_engine.models import ApplicantProfile, ApplyRequest, ApplyResult, CapturedScreenshot
from apply_engine.portal_specs import (
    ASHBY_CUSTOM_SELECTORS,
    ASHBY_HINT_ALIASES,
    ASHBY_SELECTORS,
)

MAX_STEPS = 6
STEP_WAIT_MS = 1500


class AshbyAgent(PortalAgent):
    """Full Ashby ATS implementation with hint-based question scanning."""

    portal_name = "ashby"

    async def apply(self, request: ApplyRequest) -> ApplyResult:
        if request.dry_run:
            actions = self._build_base_actions(request.profile)
            return ApplyResult(
                portal="ashby",
                status="unsupported",
                actions=actions,
            )

        try:
            async def worker(
                page: object,
            ) -> tuple[str, list[CapturedScreenshot], list[str], list[str]]:
                return await self._execute(page, request.profile, request.runtime_hints)

            confirmation, screenshots, inferred_answers, unresolved_questions = await run_with_chromium(
                request.url, worker
            )
            recovery_family = getattr(self, "_last_recovery_family", None)
            return ApplyResult(
                portal="ashby",
                status="applied",
                confirmation_snippet=normalize_confirmation_text(confirmation),
                actions=[],
                screenshots=screenshots,
                inferred_answers=inferred_answers,
                unresolved_questions=unresolved_questions,
                recovery_attempted=recovery_family is not None,
                recovery_family=recovery_family,
            )
        except AuthRequiredError as exc:
            return ApplyResult(
                portal="ashby",
                status="requires_auth",
                actions=[],
                error=normalize_confirmation_text(str(exc)),
                screenshots=exception_screenshots(exc),
                unresolved_questions=list(getattr(exc, "_twin_unresolved_questions", [])),
            )
        except ActionExecutionError as exc:
            return ApplyResult(
                portal="ashby",
                status="failed",
                actions=[],
                error=normalize_confirmation_text(str(exc)),
                screenshots=exception_screenshots(exc),
                unresolved_questions=list(getattr(exc, "_twin_unresolved_questions", [])),
            )
        except Exception as exc:
            return ApplyResult(
                portal="ashby",
                status="failed",
                actions=[],
                error=str(exc)[:400],
                screenshots=exception_screenshots(exc),
                unresolved_questions=list(getattr(exc, "_twin_unresolved_questions", [])),
            )

    def _build_base_actions(self, profile: ApplicantProfile) -> list:
        """Dry-run action list for Ashby."""
        from apply_engine.models import PlannedAction

        selectors = ASHBY_CUSTOM_SELECTORS
        actions = []
        actions.append(
            PlannedAction("fill", selectors["full_name"], f"{profile.first_name} {profile.last_name}")
        )
        actions.append(PlannedAction("fill", selectors["email"], profile.email))
        if profile.phone:
            actions.append(PlannedAction("fill", selectors["phone"], profile.phone, required=False))
        if profile.linkedin_url or profile.linkedin:
            actions.append(
                PlannedAction(
                    "fill",
                    selectors["linkedin_url"],
                    profile.linkedin_url or profile.linkedin,
                    required=False,
                )
            )
        if profile.website_url or profile.website:
            actions.append(
                PlannedAction(
                    "fill",
                    selectors["website_url"],
                    profile.website_url or profile.website,
                    required=False,
                )
            )
        if profile.github_url or profile.github:
            actions.append(
                PlannedAction(
                    "fill",
                    selectors["github_url"],
                    profile.github_url or profile.github,
                    required=False,
                )
            )
        if profile.resume_pdf_path:
            actions.append(
                PlannedAction("upload", selectors["resume"], profile.resume_pdf_path)
            )
        return actions

    async def _execute(
        self,
        page: object,
        profile: ApplicantProfile,
        runtime_hints: dict | None = None,
    ) -> tuple[str, list[CapturedScreenshot], list[str], list[str]]:
        screenshots: list[CapturedScreenshot] = []
        inferred_answers: list[str] = []
        unresolved_questions: list[str] = []
        recovery_family_used: str | None = None

        try:
            # Wait for page to settle
            if hasattr(page, "wait_for_load_state"):
                await page.wait_for_load_state("networkidle", timeout=30_000)  # type: ignore[attr-defined]
            await asyncio.sleep(1)

            # Click Apply button if gated
            for apply_selector in [
                ASHBY_SELECTORS["apply_button"],
                "button:has-text('Apply for this job')",
                "button:has-text('Apply for this position')",
                "[data-testid='apply-button']",
            ]:
                try:
                    el = await page.query_selector(apply_selector)  # type: ignore[attr-defined]
                    if el:
                        await el.click()
                        if hasattr(page, "wait_for_load_state"):
                            await page.wait_for_load_state("networkidle", timeout=10_000)  # type: ignore[attr-defined]
                        await asyncio.sleep(1.5)
                        break
                except Exception:
                    continue

            # Fill base contact fields
            await self._fill_base_fields(page, profile)
            await asyncio.sleep(0.8)

            # Upload resume
            if profile.resume_pdf_path:
                try:
                    await page.set_input_files(  # type: ignore[attr-defined]
                        ASHBY_CUSTOM_SELECTORS["resume"], profile.resume_pdf_path
                    )
                    inferred_answers.append("resume")
                except Exception:
                    # Fallback to legacy selector
                    try:
                        await page.set_input_files(  # type: ignore[attr-defined]
                            ASHBY_SELECTORS["resume_upload"], profile.resume_pdf_path
                        )
                        inferred_answers.append("resume")
                    except Exception:
                        pass

            # Hint-based question scan (custom questions, EEO, work auth)
            filled = await fill_detected_questions_by_hint(page, profile, ASHBY_HINT_ALIASES)
            inferred_answers.extend(filled)
            await asyncio.sleep(0.5)

            # Work authorization explicit selectors as backup
            await self._fill_work_auth(page, profile, inferred_answers)

            # Collect unresolved on initial view
            for hint in await collect_unresolved_required_questions(page, profile, ASHBY_HINT_ALIASES):
                if hint not in unresolved_questions:
                    unresolved_questions.append(hint)

            filled_shot = await capture_page_screenshot(page, "form_filled")
            if filled_shot:
                screenshots.append(filled_shot)

            # Multi-step navigation
            for step in range(MAX_STEPS):
                body_text = await extract_body_text(page)

                if looks_like_confirmation(body_text):
                    return body_text, screenshots, inferred_answers, unresolved_questions

                if looks_like_auth_wall(body_text):
                    raise AuthRequiredError(normalize_confirmation_text(body_text))

                step_shot = await capture_page_screenshot(page, f"step_{step}")
                if step_shot:
                    screenshots.append(step_shot)

                # Try Next / Continue
                next_clicked = await self._try_next(page)
                if not next_clicked:
                    break

                await asyncio.sleep(STEP_WAIT_MS / 1000)

                # Re-scan after navigation
                filled = await fill_detected_questions_by_hint(page, profile, ASHBY_HINT_ALIASES)
                inferred_answers.extend(filled)

                for hint in await collect_unresolved_required_questions(
                    page, profile, ASHBY_HINT_ALIASES
                ):
                    if hint not in unresolved_questions:
                        unresolved_questions.append(hint)

            # Submit
            for submit_selector in [
                "button[type='submit']:has-text('Submit')",
                "button:has-text('Submit application')",
                "button:has-text('Submit Application')",
                "button:has-text('Complete application')",
                "[data-testid='submit-button']",
                ASHBY_SELECTORS["submit"],
            ]:
                try:
                    el = await page.query_selector(submit_selector)  # type: ignore[attr-defined]
                    if el and await el.is_visible():  # type: ignore[attr-defined]
                        await el.click()
                        await asyncio.sleep(3)
                        body_text = await extract_body_text(page)
                        if looks_like_confirmation(body_text):
                            final_shot = await capture_page_screenshot(page, "post_submit")
                            if final_shot:
                                screenshots.append(final_shot)
                            setattr(self, "_last_recovery_family", recovery_family_used)
                            for hint in await collect_unresolved_required_questions(
                                page, profile, ASHBY_HINT_ALIASES
                            ):
                                if hint not in unresolved_questions:
                                    unresolved_questions.append(hint)
                            return body_text, screenshots, inferred_answers, unresolved_questions
                        break
                except Exception:
                    continue

            # Check for blocked state and attempt recovery
            body_text = await extract_body_text(page)
            if looks_like_confirmation(body_text):
                final_shot = await capture_page_screenshot(page, "final_state")
                if final_shot:
                    screenshots.append(final_shot)
                setattr(self, "_last_recovery_family", recovery_family_used)
                return body_text, screenshots, inferred_answers, unresolved_questions

            raise SubmissionBlockedError(
                f"Ashby form did not reach confirmation state. Page: {normalize_confirmation_text(body_text, limit=300)}"
            )

        except SubmissionBlockedError as exc:
            # Attempt recovery via hint scan + re-submit
            blocked_filled = await fill_detected_questions_by_hint(page, profile, ASHBY_HINT_ALIASES)
            if blocked_filled:
                for answer in blocked_filled:
                    if answer not in inferred_answers:
                        inferred_answers.append(answer)
                recovery_family_used = "custom"
                recovery_shot = await capture_page_screenshot(page, "recovery_custom")
                if recovery_shot:
                    screenshots.append(recovery_shot)

                # Retry submit
                try:
                    submit_el = await page.query_selector(ASHBY_SELECTORS["submit"])  # type: ignore[attr-defined]
                    if submit_el:
                        await submit_el.click()
                        await asyncio.sleep(3)
                        body_text = await extract_body_text(page)
                        if looks_like_confirmation(body_text):
                            setattr(self, "_last_recovery_family", recovery_family_used)
                            return body_text, screenshots, inferred_answers, unresolved_questions
                except Exception:
                    pass

            recovered_family = await attempt_recovery_for_blocked_family(
                page,
                profile,
                str(exc),
                selectors=ASHBY_SELECTORS,
                custom_selectors={},
                runtime_hints=runtime_hints,
                hint_aliases=ASHBY_HINT_ALIASES,
            )
            if recovered_family:
                recovery_family_used = recovered_family
                recovery_shot = await capture_page_screenshot(page, f"recovery_{recovered_family}")
                if recovery_shot:
                    screenshots.append(recovery_shot)
                try:
                    submit_el = await page.query_selector(ASHBY_SELECTORS["submit"])  # type: ignore[attr-defined]
                    if submit_el:
                        await submit_el.click()
                        await asyncio.sleep(3)
                        body_text = await extract_body_text(page)
                        if looks_like_confirmation(body_text):
                            setattr(self, "_last_recovery_family", recovery_family_used)
                            return body_text, screenshots, inferred_answers, unresolved_questions
                except Exception:
                    pass

            failure_shot = await capture_page_screenshot(page, "failure_state")
            if failure_shot:
                screenshots.append(failure_shot)
            setattr(exc, "_twin_screenshots", screenshots)
            setattr(exc, "_twin_unresolved_questions", unresolved_questions)
            raise

        except Exception as exc:
            failure_shot = await capture_page_screenshot(page, "failure_state")
            if failure_shot:
                screenshots.append(failure_shot)
            setattr(exc, "_twin_screenshots", screenshots)
            setattr(exc, "_twin_unresolved_questions", unresolved_questions)
            raise

    async def _fill_base_fields(self, page: object, profile: ApplicantProfile) -> None:
        """Fill contact fields — handles combined name vs split name Ashby forms."""
        # Detect split vs combined name
        has_first = False
        try:
            el = await page.query_selector(ASHBY_CUSTOM_SELECTORS["first_name"])  # type: ignore[attr-defined]
            if el and await el.is_visible():  # type: ignore[attr-defined]
                has_first = True
        except Exception:
            pass

        if has_first:
            await self._try_fill(page, ASHBY_CUSTOM_SELECTORS["first_name"], profile.first_name)
            await self._try_fill(page, ASHBY_CUSTOM_SELECTORS["last_name"], profile.last_name)
        else:
            # Fall back to legacy full_name selector or ASHBY_SELECTORS
            full_name_el = await page.query_selector(ASHBY_SELECTORS["full_name"])  # type: ignore[attr-defined]
            if full_name_el:
                placeholder = (await full_name_el.get_attribute("placeholder") or "").lower()
                if "first" in placeholder:
                    await full_name_el.fill(profile.first_name)
                    last_el = await page.query_selector(ASHBY_SELECTORS["last_name"])  # type: ignore[attr-defined]
                    if last_el:
                        await last_el.fill(profile.last_name)
                else:
                    await full_name_el.fill(f"{profile.first_name} {profile.last_name}".strip())
            else:
                await self._try_fill(
                    page,
                    ASHBY_CUSTOM_SELECTORS["full_name"],
                    f"{profile.first_name} {profile.last_name}".strip(),
                )

        await self._try_fill(page, ASHBY_CUSTOM_SELECTORS["email"], profile.email)

        if profile.phone:
            await self._try_fill(page, ASHBY_CUSTOM_SELECTORS["phone"], profile.phone)

        # URLs — prefer *_url fields, fall back to legacy aliases
        linkedin = profile.linkedin_url or profile.linkedin
        if linkedin:
            await self._try_fill(page, ASHBY_CUSTOM_SELECTORS["linkedin_url"], linkedin)

        website = profile.website_url or profile.website
        if website:
            await self._try_fill(page, ASHBY_CUSTOM_SELECTORS["website_url"], website)

        github = profile.github_url or profile.github
        if github:
            await self._try_fill(page, ASHBY_CUSTOM_SELECTORS["github_url"], github)

        # Location
        if profile.city:
            location_str = (
                f"{profile.city}, {profile.state_region}" if profile.state_region else profile.city
            )
            await self._try_fill(page, ASHBY_CUSTOM_SELECTORS["location"], location_str)

    async def _fill_work_auth(
        self, page: object, profile: ApplicantProfile, inferred: list[str]
    ) -> None:
        """Click work auth radio buttons using explicit selectors as fallback."""
        try:
            sel = (
                ASHBY_CUSTOM_SELECTORS["authorized_yes"]
                if profile.authorized_to_work
                else ASHBY_CUSTOM_SELECTORS["authorized_no"]
            )
            el = await page.query_selector(sel)  # type: ignore[attr-defined]
            if el and await el.is_visible():  # type: ignore[attr-defined]
                await el.click()
                if "work_authorization" not in inferred:
                    inferred.append("work_authorization")
        except Exception:
            pass

        try:
            sel = (
                ASHBY_CUSTOM_SELECTORS["sponsorship_no"]
                if not profile.sponsorship_required
                else ASHBY_CUSTOM_SELECTORS["sponsorship_yes"]
            )
            el = await page.query_selector(sel)  # type: ignore[attr-defined]
            if el and await el.is_visible():  # type: ignore[attr-defined]
                await el.click()
                if "sponsorship_required" not in inferred:
                    inferred.append("sponsorship_required")
        except Exception:
            pass

    async def _try_next(self, page: object) -> bool:
        """Try Next / Continue button. Returns True if clicked."""
        for selector in [
            "button:has-text('Next')",
            "button:has-text('Continue')",
            "button:has-text('Save & Continue')",
            "button:has-text('Save and Continue')",
            "[data-testid='next-button']",
            "[data-testid='continue-button']",
            ASHBY_SELECTORS["next"],
        ]:
            try:
                el = await page.query_selector(selector)  # type: ignore[attr-defined]
                if el and await el.is_visible() and await el.is_enabled():  # type: ignore[attr-defined]
                    await el.click()
                    return True
            except Exception:
                continue
        return False

    @staticmethod
    async def _try_fill(page: object, selector: str, value: str) -> None:
        if not value or not selector:
            return
        try:
            el = await page.query_selector(selector)  # type: ignore[attr-defined]
            if el:
                await el.fill(value)
        except Exception:
            pass
