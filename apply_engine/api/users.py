"""
apply_engine/api/users.py
──────────────────────────
Routes for listing a user's applications.

Routes:
    GET /users/{user_id}/applications
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Header, HTTPException, Query

from apply_engine.tracking.db import get_session
from apply_engine.tracking.enums import execution_to_progress, ExecutionStatus
from apply_engine.tracking.schemas import ApplicationResponse, UserApplicationsResponse
from apply_engine.tracking.service import ApplicationService

router = APIRouter(prefix="/users", tags=["users"])


def _require_user_id(x_user_id: str | None) -> uuid.UUID:
    if not x_user_id:
        raise HTTPException(status_code=401, detail="X-User-Id header required")
    try:
        return uuid.UUID(x_user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="X-User-Id must be a valid UUID")


@router.get("/{user_id}/applications", response_model=UserApplicationsResponse)
async def list_user_applications(
    user_id: uuid.UUID,
    x_user_id: str | None = Header(default=None),
    status: str | None = Query(default=None, description="Filter by status"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    caller = _require_user_id(x_user_id)
    if caller != user_id:
        raise HTTPException(status_code=403, detail="Cannot access another user's applications")

    async with get_session() as session:
        svc = ApplicationService(session)
        apps, total = await svc.list_for_user(
            user_id, status=status, limit=limit, offset=offset
        )

        responses = []
        for app in apps:
            exec_status = (
                ExecutionStatus(app.execution_status) if app.execution_status else None
            )
            progress = execution_to_progress(exec_status) if exec_status else 0
            responses.append(
                ApplicationResponse.model_validate({
                    "id": app.id,
                    "user_id": app.user_id,
                    "job_id": app.job_id,
                    "status": app.status,
                    "execution_status": app.execution_status,
                    "latest_user_message": app.latest_user_message,
                    "progress_percent": progress,
                    "created_at": app.created_at,
                    "queued_at": app.queued_at,
                    "started_at": app.started_at,
                    "completed_at": app.completed_at,
                    "last_event_at": None,
                    "confirmation_present": False,
                    "requires_action": app.status == "requires_auth",
                    "retry_available": app.status in ("failed", "confirmation_timeout", "requires_auth")
                        and (app.attempt_count or 0) < (app.max_attempts or 3),
                    "attempt_count": app.attempt_count or 0,
                    "max_attempts": app.max_attempts or 3,
                    "last_error": app.last_error,
                })
            )

    return UserApplicationsResponse(
        user_id=user_id,
        applications=responses,
        total=total,
    )
