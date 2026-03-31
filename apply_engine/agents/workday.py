from __future__ import annotations

from apply_engine.agents.base import PortalAgent
from apply_engine.agents.common import (
    attempt_recovery_for_blocked_family,
    build_custom_answer_actions,
    collect_unresolved_required_questions,
    fill_detected_questions_by_hint,
)
from apply_engine.browser import (
    AuthRequiredError,
    ActionExecutionError,
    capture_page_screenshot,
    exception_screenshots,
    execute_actions,
    extract_body_text,
    extract_page_url,
    extract_validation_issues,
    looks_like_auth_wall,
    looks_like_confirmation,
    looks_like_confirmation_url,
    normalize_confirmation_text,
    run_with_chromium,
    selector_exists,
)
from apply_engine.models import ApplyRequest, ApplyResult, CapturedScreenshot, PlannedAction
from apply_engine.portal_specs import (
    WORKDAY_CUSTOM_SELECTORS,
    WORKDAY_HINT_ALIASES,
    WORKDAY_SELECTORS,
)


# Maximum number of "Next" steps before we stop and fail.
# Workday forms typically have 4–6 steps.
MAX_STEPS = 8

# After each step navigation wait for DOM quiescence (ms).
STEP_WAIT_MS = 2000

MAX_STALLED_STEPS = 2


class WorkdayAgent(PortalAgent):
    """Deterministic agent for Workday (myworkdayjobs.com) application portals.

    Workday uses `data-automation-id` attributes as stable selector anchors.
    The form is multi-step with a single bottom-nav "Next" button that becomes
    "Submit" on the final review step. We advance through steps until we detect
    a confirmation page or hit the step limit.
    """

    portal_name = "workday"

    def build_actions(self, request: ApplyRequest) -> list[PlannedAction]:
        """Build the flat action list for the first page of the Workday form.

        Workday forms are multi-step. We build actions for the fields that
        appear on the first step (personal info + contact). Subsequent steps
        are navigated in execute() by pressing Next and re-checking page state.
        """
        profile = request.profile
        actions: list[PlannedAction] = []

        # ── Personal Info ──────────────────────────────────────────────────────
        actions.append(PlannedAction("fill", WORKDAY_SELECTORS["first_name"], profile.first_name))
        actions.append(PlannedAction("fill", WORKDAY_SELECTORS["last_name"], profile.last_name))
        actions.append(PlannedAction("fill", WORKDAY_SELECTORS["email"], profile.email, required=False))

        if profile.phone:
            actions.append(
                PlannedAction("fill", WORKDAY_SELECTORS["phone"], profile.phone, required=False)
            )

        # ── Resume ────────────────────────────────────────────────────────────
        if profile.resume_pdf_path:
            actions.append(
                PlannedAction("upload", WORKDAY_SELECTORS["resume_upload"], profile.resume_pdf_path)
            )

        # ── Work Authorization ────────────────────────────────────────────────
        if profile.work_authorization:
            actions.append(
                PlannedAction(
                    "select",
                    WORKDAY_SELECTORS["work_authorization"],
                    profile.work_authorization,
                    required=False,
                )
            )

        # ── Sponsorship ───────────────────────────────────────────────────────
        sponsorship_selector = (
            WORKDAY_SELECTORS["sponsorship_yes"]
            if profile.sponsorship_required
            else WORKDAY_SELECTORS["sponsorship_no"]
        )
        actions.append(PlannedAction("check", sponsorship_selector, required=False))

        # ── Custom / Education Answers ────────────────────────────────────────
        combined_answers = dict(profile.custom_answers)

        if profile.onsite_preference:
            combined_answers.setdefault("onsite_preference", profile.onsite_preference)

        actions.extend(build_custom_answer_actions(combined_answers, WORKDAY_CUSTOM_SELECTORS))

        return actions

    async def apply(self, request: ApplyRequest) -> ApplyResult:
        actions = self.build_actions(request)

        if request.dry_run:
            return ApplyResult(
                portal="workday",
                status="unsupported",
                actions=actions,
            )

        try:
            async def worker(page: object) -> tuple[str, list[CapturedScreenshot], list[str], list[str]]:
                return await self.execute(page, request.profile, actions, request.runtime_hints)

            confirmation, screenshots, inferred_answers, unresolved_questions = await run_with_chromium(request.url, worker)
            recovery_family = getattr(self, "_last_recovery_family", None)
            return ApplyResult(
                portal="workday",
                status="applied",
                confirmation_snippet=normalize_confirmation_text(confirmation),
                actions=actions,
                screenshots=screenshots,
                inferred_answers=inferred_answers,
                unresolved_questions=unresolved_questions,
                recovery_attempted=recovery_family is not None,
                recovery_family=recovery_family,
            )
        except AuthRequiredError as exc:
            return ApplyResult(
                portal="workday",
                status="requires_auth",
                actions=actions,
                error=normalize_confirmation_text(str(exc)),
                screenshots=exception_screenshots(exc),
                unresolved_questions=list(getattr(exc, "_twin_unresolved_questions", [])),
            )
        except ActionExecutionError as exc:
            return ApplyResult(
                portal="workday",
                status="failed",
                actions=actions,
                error=normalize_confirmation_text(str(exc)),
                screenshots=exception_screenshots(exc),
                unresolved_questions=list(getattr(exc, "_twin_unresolved_questions", [])),
            )
        except Exception as exc:
            return ApplyResult(
                portal="workday",
                status="failed",
                actions=actions,
                error=str(exc)[:200],
                screenshots=exception_screenshots(exc),
                unresolved_questions=list(getattr(exc, "_twin_unresolved_questions", [])),
            )

    async def execute(
        self,
        page: object,
        profile: object,
        actions: list[PlannedAction],
        runtime_hints: dict[str, object] | None = None,
    ) -> tuple[str, list[CapturedScreenshot], list[str], list[str]]:
        """Multi-step Workday execution.

        1. Fill all actions on the current page (soft-fail on missing selectors).
        2. Take a screenshot of the filled state.
        3. Click Next repeatedly until confirmation or step limit.
        4. Take a final screenshot.
        """
        screenshots: list[CapturedScreenshot] = []
        inferred_answers: list[str] = []
        unresolved_questions: list[str] = []
        recovery_family_used: str | None = None

        try:
            # Fill first page — most fields are on step 1 ("My Information")
            await execute_actions(page, actions)
            initial_answers = await fill_detected_questions_by_hint(
                page,
                profile,
                WORKDAY_HINT_ALIASES,
            )
            for answer in initial_answers:
                if answer not in inferred_answers:
                    inferred_answers.append(answer)
            for hint in await collect_unresolved_required_questions(
                page,
                profile,
                WORKDAY_HINT_ALIASES,
            ):
                if hint not in unresolved_questions:
                    unresolved_questions.append(hint)

            filled = await capture_page_screenshot(page, "form_filled")
            if filled:
                screenshots.append(filled)

            # Multi-step navigation
            confirmation = await self._advance_to_confirmation(
                page,
                profile,
                screenshots,
                inferred_answers,
                unresolved_questions,
                runtime_hints,
            )
            recovery_family_used = getattr(page, "_twin_recovery_family", recovery_family_used)

            final = await capture_page_screenshot(page, "final_state")
            if final:
                screenshots.append(final)

            setattr(self, "_last_recovery_family", recovery_family_used)
            for hint in await collect_unresolved_required_questions(
                page,
                profile,
                WORKDAY_HINT_ALIASES,
            ):
                if hint not in unresolved_questions:
                    unresolved_questions.append(hint)
            return confirmation, screenshots, inferred_answers, unresolved_questions

        except Exception as exc:
            failure = await capture_page_screenshot(page, "failure_state")
            if failure:
                screenshots.append(failure)
            setattr(exc, "_twin_screenshots", screenshots)
            setattr(exc, "_twin_unresolved_questions", unresolved_questions)
            raise

    async def _advance_to_confirmation(
        self,
        page: object,
        profile: object,
        screenshots: list[CapturedScreenshot],
        inferred_answers: list[str],
        unresolved_questions: list[str],
        runtime_hints: dict[str, object] | None = None,
    ) -> str:
        """Press Next until confirmation page, auth wall, or step limit.

        Workday's bottom-nav button label changes ("Next" → "Submit") but the
        data-automation-id stays the same. We detect confirmation by URL or body
        text and stop.
        """
        next_selector = WORKDAY_SELECTORS["next"]
        previous_signature: str | None = None
        stalled_steps = 0

        for step in range(MAX_STEPS):
            # Allow the SPA to settle after navigation
            if hasattr(page, "wait_for_timeout"):
                await page.wait_for_timeout(STEP_WAIT_MS)  # type: ignore[attr-defined]

            step_answers = await fill_detected_questions_by_hint(
                page,
                profile,
                WORKDAY_HINT_ALIASES,
            )
            for answer in step_answers:
                if answer not in inferred_answers:
                    inferred_answers.append(answer)
            for hint in await collect_unresolved_required_questions(
                page,
                profile,
                WORKDAY_HINT_ALIASES,
            ):
                if hint not in unresolved_questions:
                    unresolved_questions.append(hint)

            body_text = await extract_body_text(page)
            page_url = extract_page_url(page)
            step_label = self._extract_step_label(body_text)
            signature = f"{step_label}|{normalize_confirmation_text(body_text, limit=280)}|{page_url}"

            if looks_like_confirmation(body_text) or looks_like_confirmation_url(page_url):
                return body_text

            if looks_like_auth_wall(body_text):
                raise AuthRequiredError(normalize_confirmation_text(body_text))

            step_shot = await capture_page_screenshot(page, f"step_{step}_{step_label}")
            if step_shot:
                screenshots.append(step_shot)

            validation_issues = extract_validation_issues(body_text)
            if validation_issues:
                recovered_family = await attempt_recovery_for_blocked_family(
                    page,
                    profile,
                    f"{step_label}: " + "; ".join(validation_issues[:3]),
                    selectors=WORKDAY_SELECTORS,
                    custom_selectors=WORKDAY_CUSTOM_SELECTORS,
                    runtime_hints=runtime_hints,
                    hint_aliases=WORKDAY_HINT_ALIASES,
                )
                if recovered_family:
                    setattr(page, "_twin_recovery_family", recovered_family)
                    recovery = await capture_page_screenshot(
                        page,
                        f"recovery_{recovered_family}_{step_label}",
                    )
                    if recovery:
                        screenshots.append(recovery)
                    continue
                raise ActionExecutionError(
                    f"{step_label.replace('_', ' ')}: " + "; ".join(validation_issues[:3])
                )

            if not await selector_exists(page, next_selector):
                # No next button — either stuck or confirmed without recognizable text
                return body_text

            if previous_signature == signature:
                stalled_steps += 1
            else:
                stalled_steps = 0
                previous_signature = signature

            if stalled_steps >= MAX_STALLED_STEPS:
                raise ActionExecutionError(
                    f"Workday navigation stalled on {step_label.replace('_', ' ')}"
                )

            await page.click(next_selector)  # type: ignore[attr-defined]

        # Exhausted step budget — return whatever is on screen
        return await extract_body_text(page)

    @staticmethod
    def _extract_step_label(body_text: str) -> str:
        normalized = normalize_confirmation_text(body_text, limit=240)
        lines = [line.strip() for line in body_text.splitlines() if line.strip()]
        candidates = lines[:6] or [normalized]

        for candidate in candidates:
          lowered = candidate.lower()
          if any(
              keyword in lowered
              for keyword in (
                  "my information",
                  "experience",
                  "application questions",
                  "voluntary disclosures",
                  "review",
                  "submit",
              )
          ):
              return WorkdayAgent._slugify_label(candidate)

        return WorkdayAgent._slugify_label(candidates[0] if candidates else "workday_step")

    @staticmethod
    def _slugify_label(value: str) -> str:
        normalized = "".join(
            character.lower() if character.isalnum() else "_"
            for character in value.strip()
        )
        while "__" in normalized:
            normalized = normalized.replace("__", "_")
        return normalized.strip("_") or "workday_step"
