from __future__ import annotations

from apply_engine.agents.common import (
    attempt_recovery_for_blocked_family,
    build_common_contact_actions,
    collect_unresolved_required_questions,
    fill_detected_questions_by_hint,
    fill_lever_card_fields_from_error,
)
from apply_engine.agents.base import PortalAgent
from apply_engine.browser import (
    AuthRequiredError,
    ActionExecutionError,
    capture_page_screenshot,
    complete_submission_flow,
    describe_application_step,
    exception_screenshots,
    execute_actions,
    extract_body_text,
    normalize_confirmation_text,
    run_with_chromium,
    SubmissionBlockedError,
)
from apply_engine.models import ApplyRequest, ApplyResult, CapturedScreenshot, PlannedAction
from apply_engine.portal_specs import (
    LEVER_CUSTOM_SELECTORS,
    LEVER_HINT_ALIASES,
    LEVER_SELECTORS,
)


class LeverAgent(PortalAgent):
    portal_name = "lever"
    submit_selector = LEVER_SELECTORS["submit"]
    next_selector = LEVER_SELECTORS["next"]

    def build_actions(self, request: ApplyRequest) -> list[PlannedAction]:
        return [
            PlannedAction(
                "fill",
                LEVER_SELECTORS["name"],
                f"{request.profile.first_name} {request.profile.last_name}".strip(),
            ),
            PlannedAction("fill", LEVER_SELECTORS["email"], request.profile.email),
            *build_common_contact_actions(
                request.profile,
                phone_selector=LEVER_SELECTORS["phone"],
                linkedin_selector=LEVER_SELECTORS["linkedin"],
                website_selector=LEVER_SELECTORS["website"],
                resume_selector=LEVER_SELECTORS["resume_upload"],
                work_authorization_selector=LEVER_SELECTORS["work_authorization"],
                start_date_selector=LEVER_SELECTORS["start_date"],
                location_preference_selector=LEVER_SELECTORS["location_preference"],
                salary_expectation_selector=LEVER_SELECTORS["salary_expectation"],
                authorized_yes_selector=LEVER_SELECTORS["authorized_yes"],
                authorized_no_selector=LEVER_SELECTORS["authorized_no"],
                sponsorship_yes_selector=LEVER_SELECTORS["sponsorship_yes"],
                sponsorship_no_selector=LEVER_SELECTORS["sponsorship_no"],
                custom_selectors=LEVER_CUSTOM_SELECTORS,
            ),
        ]

    async def apply(self, request: ApplyRequest) -> ApplyResult:
        actions = self.build_actions(request)

        if request.dry_run:
            return ApplyResult(
                portal="lever",
                status="unsupported",
                actions=actions,
            )

        try:
            async def worker(page: object) -> tuple[str, list[CapturedScreenshot], list[str], list[str]]:
                return await self.execute(page, request.profile, actions, request.runtime_hints)

            confirmation, screenshots, inferred_answers, unresolved_questions = await run_with_chromium(request.url, worker)
            recovery_family = getattr(self, "_last_recovery_family", None)
            return ApplyResult(
                portal="lever",
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
                portal="lever",
                status="requires_auth",
                actions=actions,
                error=normalize_confirmation_text(str(exc)),
                screenshots=exception_screenshots(exc),
                unresolved_questions=list(getattr(exc, "_twin_unresolved_questions", [])),
            )
        except ActionExecutionError as exc:
            return ApplyResult(
                portal="lever",
                status="failed",
                actions=actions,
                error=normalize_confirmation_text(str(exc)),
                screenshots=exception_screenshots(exc),
                unresolved_questions=list(getattr(exc, "_twin_unresolved_questions", [])),
            )
        except Exception as exc:
            return ApplyResult(
                portal="lever",
                status="failed",
                actions=actions,
                error=str(exc),
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
        screenshots: list[CapturedScreenshot] = []
        inferred_answers: list[str] = []
        unresolved_questions: list[str] = []
        seen_step_labels: set[str] = set()
        recovery_family_used: str | None = None

        try:
            await execute_actions(page, actions)
            initial_answers = await fill_detected_questions_by_hint(
                page,
                profile,
                LEVER_HINT_ALIASES,
            )
            for answer in initial_answers:
                if answer not in inferred_answers:
                    inferred_answers.append(answer)
            for hint in await collect_unresolved_required_questions(
                page,
                profile,
                LEVER_HINT_ALIASES,
            ):
                if hint not in unresolved_questions:
                    unresolved_questions.append(hint)

            async def on_step(step_page: object, step_index: int) -> None:
                step_answers = await fill_detected_questions_by_hint(
                    step_page,
                    profile,
                    LEVER_HINT_ALIASES,
                )
                for answer in step_answers:
                    if answer not in inferred_answers:
                        inferred_answers.append(answer)
                for hint in await collect_unresolved_required_questions(
                    step_page,
                    profile,
                    LEVER_HINT_ALIASES,
                ):
                    if hint not in unresolved_questions:
                        unresolved_questions.append(hint)
                body_text = await extract_body_text(step_page)
                step_label = describe_application_step(body_text, step_index=step_index)
                screenshot_label = f"step_{step_index}_{step_label}"
                if screenshot_label in seen_step_labels:
                    return
                step_capture = await capture_page_screenshot(step_page, screenshot_label)
                if step_capture:
                    screenshots.append(step_capture)
                    seen_step_labels.add(screenshot_label)

            filled = await capture_page_screenshot(page, "form_filled")
            if filled:
                screenshots.append(filled)

            try:
                confirmation = await complete_submission_flow(
                    page,
                    submit_selector=self.submit_selector,
                    next_selector=self.next_selector,
                    on_step=on_step,
                )
            except SubmissionBlockedError as exc:
                card_recoveries = await fill_lever_card_fields_from_error(
                    page,
                    profile,
                    str(exc),
                    LEVER_HINT_ALIASES,
                )
                if card_recoveries:
                    for answer in card_recoveries:
                        if answer not in inferred_answers:
                            inferred_answers.append(answer)
                    recovery_family_used = "custom"
                    recovery = await capture_page_screenshot(page, "recovery_custom_cards")
                    if recovery:
                        screenshots.append(recovery)

                    confirmation = await complete_submission_flow(
                        page,
                        submit_selector=self.submit_selector,
                        next_selector=self.next_selector,
                        on_step=on_step,
                    )
                else:
                    recovered_family = await attempt_recovery_for_blocked_family(
                        page,
                        profile,
                        str(exc),
                        selectors=LEVER_SELECTORS,
                        custom_selectors=LEVER_CUSTOM_SELECTORS,
                        runtime_hints=runtime_hints,
                        hint_aliases=LEVER_HINT_ALIASES,
                    )
                    if not recovered_family:
                        raise

                    recovery_family_used = recovered_family
                    recovery = await capture_page_screenshot(page, f"recovery_{recovered_family}")
                    if recovery:
                        screenshots.append(recovery)

                    confirmation = await complete_submission_flow(
                        page,
                        submit_selector=self.submit_selector,
                        next_selector=self.next_selector,
                        on_step=on_step,
                    )

            final = await capture_page_screenshot(page, "final_state")
            if final:
                screenshots.append(final)

            setattr(self, "_last_recovery_family", recovery_family_used)
            for hint in await collect_unresolved_required_questions(
                page,
                profile,
                LEVER_HINT_ALIASES,
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
