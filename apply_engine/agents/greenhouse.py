from __future__ import annotations

import asyncio

from apply_engine.agents.common import (
    attempt_recovery_for_blocked_family,
    build_common_contact_actions,
    collect_unresolved_required_questions,
    fill_detected_questions_by_hint,
    infer_answer_for_field_key,
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
    fill_combobox_input,
    normalize_confirmation_text,
    run_with_chromium,
    selector_exists,
    SubmissionBlockedError,
)
from apply_engine.models import ApplyRequest, ApplyResult, CapturedScreenshot, PlannedAction
from apply_engine.portal_specs import (
    GREENHOUSE_CUSTOM_SELECTORS,
    GREENHOUSE_HINT_ALIASES,
    GREENHOUSE_SELECTORS,
)


class GreenhouseAgent(PortalAgent):
    portal_name = "greenhouse"
    submit_selector = GREENHOUSE_SELECTORS["submit"]
    next_selector = GREENHOUSE_SELECTORS["next"]
    execution_timeout_seconds = 390

    async def _read_input_value(self, page: object, selector: str) -> str:
        evaluate = getattr(page, "evaluate", None)
        if not callable(evaluate):
            return ""

        try:
            value = await evaluate(
                """
                ({ selector }) => {
                  const element = document.querySelector(selector);
                  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
                    return "";
                  }
                  return element.value || "";
                }
                """,
                {"selector": selector},
            )
        except Exception:
            return ""

        return str(value or "").strip()

    async def _reinforce_education_fields(self, page: object, profile: object) -> None:
        if not callable(getattr(page, "evaluate", None)):
            return

        education_fields = [
            ("school", "#school--0", "combobox"),
            ("degree", "#degree--0", "combobox"),
            ("discipline", "#discipline--0", "combobox"),
            ("start_month", "#start-month--0", "combobox"),
            ("start_year", "#start-year--0", "text"),
            ("end_month", "#end-month--0", "combobox"),
            ("end_year", "#end-year--0", "text"),
        ]

        for field_key, selector, field_type in education_fields:
            desired_value = infer_answer_for_field_key(profile, field_key)
            if not desired_value:
                continue
            if not await selector_exists(page, selector):
                continue

            current_value = await self._read_input_value(page, selector)
            if current_value.strip():
                continue

            if field_type == "combobox":
                await fill_combobox_input(page, selector, desired_value)
            else:
                await page.fill(selector, desired_value)

    async def _capture_education_debug_state(self, page: object) -> str:
        evaluate = getattr(page, "evaluate", None)
        if not callable(evaluate):
            return ""

        try:
            snapshot = await evaluate(
                """
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
                    const wrapper = input?.closest(".select, .select__container, .field-wrapper, .input-wrapper");
                    const singleValue = wrapper?.querySelector(".select__single-value");
                    const placeholder = wrapper?.querySelector(".select__placeholder");
                    const label = document.querySelector(`label[for="${selector.slice(1)}"]`);

                    return {
                      key,
                      selector,
                      exists: Boolean(input),
                      value: input instanceof HTMLInputElement ? (input.value || "") : "",
                      selected: singleValue instanceof HTMLElement ? (singleValue.textContent || "").trim() : "",
                      placeholder: placeholder instanceof HTMLElement ? (placeholder.textContent || "").trim() : "",
                      label: label instanceof HTMLElement ? (label.textContent || "").trim() : "",
                    };
                  });
                }
                """
            )
        except Exception:
            return ""

        if not isinstance(snapshot, list):
            return ""

        lines: list[str] = []
        for item in snapshot:
            if not isinstance(item, dict):
                continue
            key = str(item.get("key", "")).strip()
            exists = bool(item.get("exists"))
            value = str(item.get("value", "")).strip()
            selected = str(item.get("selected", "")).strip()
            placeholder = str(item.get("placeholder", "")).strip()
            if not key:
                continue
            lines.append(
                f"{key}=exists:{str(exists).lower()},value:{value or '-'},selected:{selected or '-'},placeholder:{placeholder or '-'}"
            )

        return "; ".join(lines)

    def build_actions(self, request: ApplyRequest) -> list[PlannedAction]:
        return [
            PlannedAction("fill", GREENHOUSE_SELECTORS["first_name"], request.profile.first_name),
            PlannedAction("fill", GREENHOUSE_SELECTORS["last_name"], request.profile.last_name),
            PlannedAction("fill", GREENHOUSE_SELECTORS["email"], request.profile.email),
            *build_common_contact_actions(
                request.profile,
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

    async def apply(self, request: ApplyRequest) -> ApplyResult:
        actions = self.build_actions(request)

        if request.dry_run:
            return ApplyResult(
                portal="greenhouse",
                status="unsupported",
                actions=actions,
            )

        try:
            async def worker(page: object) -> tuple[str, list[CapturedScreenshot], list[str], list[str]]:
                return await self.execute(page, request.profile, actions, request.runtime_hints)

            confirmation, screenshots, inferred_answers, unresolved_questions = await asyncio.wait_for(
                run_with_chromium(request.url, worker),
                timeout=self.execution_timeout_seconds,
            )
            recovery_family = getattr(self, "_last_recovery_family", None)
            return ApplyResult(
                portal="greenhouse",
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
                portal="greenhouse",
                status="requires_auth",
                actions=actions,
                error=normalize_confirmation_text(str(exc)),
                screenshots=exception_screenshots(exc),
                unresolved_questions=list(getattr(exc, "_twin_unresolved_questions", [])),
            )
        except ActionExecutionError as exc:
            return ApplyResult(
                portal="greenhouse",
                status="failed",
                actions=actions,
                error=normalize_confirmation_text(str(exc)),
                screenshots=exception_screenshots(exc),
                unresolved_questions=list(getattr(exc, "_twin_unresolved_questions", [])),
            )
        except TimeoutError:
            return ApplyResult(
                portal="greenhouse",
                status="failed",
                actions=actions,
                error=f"Greenhouse execution timed out after {self.execution_timeout_seconds}s",
                unresolved_questions=[],
            )
        except Exception as exc:
            return ApplyResult(
                portal="greenhouse",
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
            await self._reinforce_education_fields(page, profile)
            initial_answers = await fill_detected_questions_by_hint(
                page,
                profile,
                GREENHOUSE_HINT_ALIASES,
            )
            await self._reinforce_education_fields(page, profile)
            for answer in initial_answers:
                if answer not in inferred_answers:
                    inferred_answers.append(answer)
            for hint in await collect_unresolved_required_questions(
                page,
                profile,
                GREENHOUSE_HINT_ALIASES,
            ):
                if hint not in unresolved_questions:
                    unresolved_questions.append(hint)

            async def on_step(step_page: object, step_index: int) -> None:
                await self._reinforce_education_fields(step_page, profile)
                step_answers = await fill_detected_questions_by_hint(
                    step_page,
                    profile,
                    GREENHOUSE_HINT_ALIASES,
                )
                await self._reinforce_education_fields(step_page, profile)
                for answer in step_answers:
                    if answer not in inferred_answers:
                        inferred_answers.append(answer)
                for hint in await collect_unresolved_required_questions(
                    step_page,
                    profile,
                    GREENHOUSE_HINT_ALIASES,
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
                recovered_family = await attempt_recovery_for_blocked_family(
                    page,
                    profile,
                    str(exc),
                    selectors=GREENHOUSE_SELECTORS,
                    custom_selectors=GREENHOUSE_CUSTOM_SELECTORS,
                    runtime_hints=runtime_hints,
                    hint_aliases=GREENHOUSE_HINT_ALIASES,
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
                GREENHOUSE_HINT_ALIASES,
            ):
                if hint not in unresolved_questions:
                    unresolved_questions.append(hint)
            return confirmation, screenshots, inferred_answers, unresolved_questions
        except Exception as exc:
            error_text = normalize_confirmation_text(str(exc))
            if any(token in error_text.lower() for token in ("school", "degree", "discipline")):
                debug_state = await self._capture_education_debug_state(page)
                if debug_state:
                    exc.args = (f"{error_text} | education_debug: {debug_state}",)
            failure = await capture_page_screenshot(page, "failure_state")
            if failure:
                screenshots.append(failure)
            setattr(exc, "_twin_screenshots", screenshots)
            setattr(exc, "_twin_unresolved_questions", unresolved_questions)
            raise
