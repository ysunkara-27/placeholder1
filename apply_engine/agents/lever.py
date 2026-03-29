from __future__ import annotations

from apply_engine.agents.common import build_common_contact_actions
from apply_engine.agents.base import PortalAgent
from apply_engine.browser import (
    AuthRequiredError,
    ActionExecutionError,
    capture_page_screenshot,
    complete_submission_flow,
    exception_screenshots,
    execute_actions,
    normalize_confirmation_text,
    run_with_chromium,
)
from apply_engine.models import ApplyRequest, ApplyResult, CapturedScreenshot, PlannedAction
from apply_engine.portal_specs import LEVER_CUSTOM_SELECTORS, LEVER_SELECTORS


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
            async def worker(page: object) -> str:
                return await self.execute(page, actions)

            confirmation, screenshots = await run_with_chromium(request.url, worker)
            return ApplyResult(
                portal="lever",
                status="applied",
                confirmation_snippet=normalize_confirmation_text(confirmation),
                actions=actions,
                screenshots=screenshots,
            )
        except AuthRequiredError as exc:
            return ApplyResult(
                portal="lever",
                status="requires_auth",
                actions=actions,
                error=normalize_confirmation_text(str(exc)),
                screenshots=exception_screenshots(exc),
            )
        except ActionExecutionError as exc:
            return ApplyResult(
                portal="lever",
                status="failed",
                actions=actions,
                error=normalize_confirmation_text(str(exc)),
                screenshots=exception_screenshots(exc),
            )
        except Exception as exc:
            return ApplyResult(
                portal="lever",
                status="failed",
                actions=actions,
                error=str(exc),
                screenshots=exception_screenshots(exc),
            )

    async def execute(
        self,
        page: object,
        actions: list[PlannedAction],
    ) -> tuple[str, list[CapturedScreenshot]]:
        screenshots: list[CapturedScreenshot] = []

        try:
            await execute_actions(page, actions)

            filled = await capture_page_screenshot(page, "form_filled")
            if filled:
                screenshots.append(filled)

            confirmation = await complete_submission_flow(
                page,
                submit_selector=self.submit_selector,
                next_selector=self.next_selector,
            )

            final = await capture_page_screenshot(page, "final_state")
            if final:
                screenshots.append(final)

            return confirmation, screenshots
        except Exception as exc:
            failure = await capture_page_screenshot(page, "failure_state")
            if failure:
                screenshots.append(failure)
            setattr(exc, "_twin_screenshots", screenshots)
            raise
