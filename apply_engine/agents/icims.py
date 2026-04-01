"""
iCIMS ATS agent — supports both Classic and Talent Cloud (modern) forms.

iCIMS is used by thousands of large enterprises. Two form architectures:
- Classic: Multi-step wizard, iframe-based, traditional HTML (most common)
- Talent Cloud: React SPA with data-field-id attributes (newer deployments)

The agent auto-detects which version it's dealing with and applies the
appropriate strategy. Both use the same hint-scanning pipeline.
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
)
from apply_engine.models import ApplicantProfile, ApplyRequest, ApplyResult, CapturedScreenshot
from apply_engine.portal_specs import ICIMS_HINT_ALIASES, ICIMS_SELECTORS

MAX_STEPS = 10
STEP_WAIT_MS = 2000


class IcimsAgent(PortalAgent):
    """iCIMS ATS agent — Classic + Talent Cloud support."""

    portal_name = "icims"

    async def apply(self, request: ApplyRequest) -> ApplyResult:
        if request.dry_run:
            return ApplyResult(
                portal="icims",
                status="unsupported",
                actions=self._build_base_actions(request.profile, is_modern=False),
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
                portal="icims",
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
                portal="icims",
                status="requires_auth",
                actions=[],
                error=normalize_confirmation_text(str(exc)),
                screenshots=exception_screenshots(exc),
                unresolved_questions=list(getattr(exc, "_twin_unresolved_questions", [])),
            )
        except ActionExecutionError as exc:
            return ApplyResult(
                portal="icims",
                status="failed",
                actions=[],
                error=normalize_confirmation_text(str(exc)),
                screenshots=exception_screenshots(exc),
                unresolved_questions=list(getattr(exc, "_twin_unresolved_questions", [])),
            )
        except Exception as exc:
            return ApplyResult(
                portal="icims",
                status="failed",
                actions=[],
                error=str(exc)[:400],
                screenshots=exception_screenshots(exc),
                unresolved_questions=list(getattr(exc, "_twin_unresolved_questions", [])),
            )

    def _build_base_actions(self, profile: ApplicantProfile, is_modern: bool) -> list:
        from apply_engine.models import PlannedAction

        s = ICIMS_SELECTORS
        first_sel = s["first_name_modern"] if is_modern else s["first_name"]
        last_sel = s["last_name_modern"] if is_modern else s["last_name"]
        email_sel = s["email_modern"] if is_modern else s["email"]
        phone_sel = s["phone_modern"] if is_modern else s["phone"]
        actions = [
            PlannedAction("fill", first_sel, profile.first_name),
            PlannedAction("fill", last_sel, profile.last_name),
            PlannedAction("fill", email_sel, profile.email),
        ]
        if profile.phone:
            actions.append(PlannedAction("fill", phone_sel, profile.phone, required=False))
        if profile.resume_pdf_path:
            actions.append(PlannedAction("upload", s["resume_upload"], profile.resume_pdf_path))
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
            if hasattr(page, "wait_for_load_state"):
                await page.wait_for_load_state("networkidle", timeout=40_000)  # type: ignore[attr-defined]
            await asyncio.sleep(2)

            # Detect architecture
            is_modern = await self._detect_modern(page)

            # Click Apply / Apply Now if gated
            await self._click_apply_button(page)

            for step_num in range(MAX_STEPS):
                await asyncio.sleep(STEP_WAIT_MS / 1000)

                body_text = await extract_body_text(page)

                if looks_like_confirmation(body_text):
                    final_shot = await capture_page_screenshot(page, "final_state")
                    if final_shot:
                        screenshots.append(final_shot)
                    setattr(self, "_last_recovery_family", recovery_family_used)
                    return body_text, screenshots, inferred_answers, unresolved_questions

                if looks_like_auth_wall(body_text):
                    raise AuthRequiredError(normalize_confirmation_text(body_text))

                step_shot = await capture_page_screenshot(page, f"step_{step_num}")
                if step_shot:
                    screenshots.append(step_shot)

                # Handle iframes (Classic iCIMS wraps form in iframe)
                active_page = await self._get_active_frame(page) or page

                # Fill contact fields on first step
                if step_num == 0:
                    filled_base = await self._fill_base_fields(active_page, profile, is_modern)
                    inferred_answers.extend(filled_base)

                    # Upload resume
                    if profile.resume_pdf_path:
                        try:
                            await active_page.set_input_files(  # type: ignore[attr-defined]
                                ICIMS_SELECTORS["resume_upload"], profile.resume_pdf_path
                            )
                            inferred_answers.append("resume")
                        except Exception:
                            pass

                    # Cover letter
                    cl_text = profile.custom_answers.get("cover_letter", "")
                    if cl_text:
                        await self._safe_fill(active_page, ICIMS_SELECTORS["cover_letter"], cl_text)

                # Work auth
                await self._fill_work_auth(active_page, profile, inferred_answers)

                # Hint-based scanning for remaining questions
                filled = await fill_detected_questions_by_hint(active_page, profile, ICIMS_HINT_ALIASES)
                inferred_answers.extend(filled)

                # Collect unresolved
                for hint in await collect_unresolved_required_questions(
                    active_page, profile, ICIMS_HINT_ALIASES
                ):
                    if hint not in unresolved_questions:
                        unresolved_questions.append(hint)

                # Try to advance to next step
                advanced = await self._advance(active_page)
                if not advanced:
                    # Try submit
                    submitted = await self._try_submit(active_page)
                    if submitted:
                        await asyncio.sleep(3)
                        body_text = await extract_body_text(page)
                        if looks_like_confirmation(body_text):
                            final_shot = await capture_page_screenshot(page, "final_state")
                            if final_shot:
                                screenshots.append(final_shot)
                            setattr(self, "_last_recovery_family", recovery_family_used)
                            return body_text, screenshots, inferred_answers, unresolved_questions
                    break

            raise SubmissionBlockedError(
                "iCIMS form did not reach confirmation after all steps."
            )

        except SubmissionBlockedError as exc:
            # Attempt recovery
            recovered_family = await attempt_recovery_for_blocked_family(
                page,
                profile,
                str(exc),
                selectors=ICIMS_SELECTORS,
                custom_selectors={},
                runtime_hints=runtime_hints,
                hint_aliases=ICIMS_HINT_ALIASES,
            )
            if recovered_family:
                recovery_family_used = recovered_family
                recovery_shot = await capture_page_screenshot(page, f"recovery_{recovered_family}")
                if recovery_shot:
                    screenshots.append(recovery_shot)

                submitted = await self._try_submit(page)
                if submitted:
                    await asyncio.sleep(3)
                    body_text = await extract_body_text(page)
                    if looks_like_confirmation(body_text):
                        setattr(self, "_last_recovery_family", recovery_family_used)
                        return body_text, screenshots, inferred_answers, unresolved_questions

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

    async def _detect_modern(self, page: object) -> bool:
        """Detect if this is a Talent Cloud (modern React) iCIMS form."""
        try:
            return await page.evaluate(  # type: ignore[attr-defined]
                "() => !!document.querySelector('[data-field-id], .iCIMS-TalentCloud, [class*=\"talentCloud\"]')"
            )
        except Exception:
            return False

    async def _get_active_frame(self, page: object):
        """iCIMS Classic embeds the form in an iframe. Return the frame if present."""
        try:
            frames = page.frames  # type: ignore[attr-defined]
            for frame in frames:
                if frame == page.main_frame:  # type: ignore[attr-defined]
                    continue
                try:
                    url = frame.url
                    if "icims" in url.lower():
                        return frame
                except Exception:
                    continue
        except Exception:
            pass
        return None

    async def _fill_base_fields(
        self, page: object, profile: ApplicantProfile, is_modern: bool
    ) -> list[str]:
        filled = []
        s = ICIMS_SELECTORS

        first_sel = s["first_name_modern"] if is_modern else s["first_name"]
        last_sel = s["last_name_modern"] if is_modern else s["last_name"]
        email_sel = s["email_modern"] if is_modern else s["email"]
        phone_sel = s["phone_modern"] if is_modern else s["phone"]

        await self._safe_fill(page, first_sel, profile.first_name)
        await self._safe_fill(page, last_sel, profile.last_name)
        await self._safe_fill(page, email_sel, profile.email)
        filled.extend(["first_name", "last_name", "email"])

        if profile.phone:
            await self._safe_fill(page, phone_sel, profile.phone)
            filled.append("phone")

        linkedin = profile.linkedin_url or profile.linkedin
        if linkedin:
            await self._safe_fill(page, s["linkedin_url"], linkedin)
            filled.append("linkedin")

        website = profile.website_url or profile.website
        if website:
            await self._safe_fill(page, s["website_url"], website)
            filled.append("website")

        return filled

    async def _fill_work_auth(
        self, page: object, profile: ApplicantProfile, inferred: list[str]
    ) -> None:
        s = ICIMS_SELECTORS
        try:
            sel = s["authorized_yes"] if profile.authorized_to_work else s["authorized_no"]
            el = await page.query_selector(sel)  # type: ignore[attr-defined]
            if el and await el.is_visible():  # type: ignore[attr-defined]
                await el.click()
                if "work_authorization" not in inferred:
                    inferred.append("work_authorization")
        except Exception:
            pass
        try:
            sel = s["sponsorship_no"] if not profile.sponsorship_required else s["sponsorship_yes"]
            el = await page.query_selector(sel)  # type: ignore[attr-defined]
            if el and await el.is_visible():  # type: ignore[attr-defined]
                await el.click()
                if "sponsorship_required" not in inferred:
                    inferred.append("sponsorship_required")
        except Exception:
            pass

    async def _click_apply_button(self, page: object) -> None:
        for sel in [
            "a:has-text('Apply Now')",
            "button:has-text('Apply Now')",
            "a:has-text('Apply for this Job')",
            "button:has-text('Apply')",
            ".iCIMS_ApplyButton",
            "[class*='applyButton']",
        ]:
            try:
                el = await page.query_selector(sel)  # type: ignore[attr-defined]
                if el and await el.is_visible():  # type: ignore[attr-defined]
                    await el.click()
                    await asyncio.sleep(2)
                    return
            except Exception:
                continue

    async def _advance(self, page: object) -> bool:
        for sel in [
            "button:has-text('Next')",
            "button:has-text('Continue')",
            "input[type='submit'][value*='Next']",
            "input[type='submit'][value*='Continue']",
            ".iCIMS_NextBtn",
            "[id*='nextBtn']",
            "[class*='nextButton']",
        ]:
            try:
                el = await page.query_selector(sel)  # type: ignore[attr-defined]
                if el and await el.is_visible() and await el.is_enabled():  # type: ignore[attr-defined]
                    await el.click()
                    return True
            except Exception:
                continue
        return False

    async def _try_submit(self, page: object) -> bool:
        for sel in [
            "button:has-text('Submit')",
            "input[type='submit'][value*='Submit']",
            "button[type='submit']",
            ".iCIMS_SubmitBtn",
            "[id*='submitBtn']",
            "[class*='submitButton']",
        ]:
            try:
                el = await page.query_selector(sel)  # type: ignore[attr-defined]
                if el and await el.is_visible() and await el.is_enabled():  # type: ignore[attr-defined]
                    await el.click()
                    return True
            except Exception:
                continue
        return False

    async def _safe_fill(self, page: object, selector: str, value: str) -> None:
        if not value or not selector:
            return
        try:
            el = await page.query_selector(selector)  # type: ignore[attr-defined]
            if el:
                await el.fill(value)
        except Exception:
            pass
