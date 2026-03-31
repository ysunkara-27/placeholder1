from __future__ import annotations

from apply_engine.models import ApplyResult
from apply_engine.schemas import (
    ApplyResultPayload,
    CapturedScreenshotPayload,
    PlannedActionPayload,
)


def serialize_apply_result(result: ApplyResult) -> ApplyResultPayload:
    return ApplyResultPayload(
        portal=result.portal,
        status=result.status,
        confirmation_snippet=result.confirmation_snippet,
        actions=[
            PlannedActionPayload(
                action=action.action,
                selector=action.selector,
                value=action.value,
                required=action.required,
            )
            for action in result.actions
        ],
        error=result.error,
        screenshots=[
            CapturedScreenshotPayload(
                label=screenshot.label,
                mime_type=screenshot.mime_type,
                data_base64=screenshot.data_base64,
            )
            for screenshot in result.screenshots
        ],
        inferred_answers=list(result.inferred_answers),
        unresolved_questions=list(result.unresolved_questions),
        recovery_attempted=result.recovery_attempted,
        recovery_family=result.recovery_family,
    )
