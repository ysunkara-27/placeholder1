"""
apply_engine/workers/apply_task.py
────────────────────────────────────
Celery task: run_apply_task

Orchestration flow
──────────────────
1. Deserialise arguments + validate application still queued
2. Mark running, emit automation.started
3. Build ApplyRequest from stored request_payload
4. Advance execution_status at each logical phase
5. Call route_application() (existing portal adapter logic)
6. Interpret ApplyResult:
   - "applied"       → create confirmation, mark_completed
   - "requires_auth" → create action_request, mark_requires_action
   - "failed"        → mark_failed + schedule retry if under limit
   - "unsupported"   → mark_failed (permanent)
7. Record apply_run row for audit trail

Error handling
──────────────
Unhandled exceptions inside the task do NOT call mark_failed via the
normal retry path — Celery will retry up to CELERY_MAX_RETRIES times
using its own mechanism before raising.  The on_failure handler then
calls mark_failed(permanent=True) so the record stays clean.
"""

from __future__ import annotations

import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any

from celery import Task  # type: ignore[import]

from apply_engine.workers.celery_app import app as celery_app
from apply_engine.models import ApplicantProfile, ApplyRequest
from apply_engine.schemas import ApplicantProfilePayload
from apply_engine.tracking.db import get_session
from apply_engine.tracking.enums import ExecutionStatus
from apply_engine.tracking.event_log import EventLogService
from apply_engine.tracking.service import ApplicationService
from apply_engine.tracking.confirmation import ConfirmationService

logger = logging.getLogger("apply_engine.worker")


# ── Task definition ───────────────────────────────────────────────────────────

class _ApplyTask(Task):
    """Custom base Task class for failure/success hooks."""

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        application_id_str = args[0] if args else kwargs.get("application_id", "")
        user_id_str        = args[1] if len(args) > 1 else kwargs.get("user_id", "")
        if application_id_str and user_id_str:
            asyncio.run(
                _async_mark_failed(
                    uuid.UUID(application_id_str),
                    f"Unhandled worker error: {exc}",
                    permanent=True,
                )
            )
        logger.error(
            "apply_task.unhandled_failure",
            extra={
                "application_id": application_id_str,
                "task_id": task_id,
                "error": str(exc),
            },
            exc_info=True,
        )


@celery_app.task(
    bind=True,
    base=_ApplyTask,
    name="apply_engine.workers.apply_task.run_apply_task",
    max_retries=3,
    default_retry_delay=60,
    soft_time_limit=600,   # 10 min soft limit
    time_limit=660,        # 11 min hard kill
)
def run_apply_task(
    self: Task,
    application_id: str,
    user_id: str,
    job_url: str,
    request_payload: dict[str, Any],
) -> dict[str, Any]:
    """
    Main apply task.  Bridges Celery's sync task API to the async
    apply engine by running everything in a fresh event loop.
    """
    return asyncio.run(
        _async_run(
            self,
            uuid.UUID(application_id),
            uuid.UUID(user_id),
            job_url,
            request_payload,
        )
    )


# ── Async orchestration ───────────────────────────────────────────────────────

async def _async_run(
    task: Task,
    application_id: uuid.UUID,
    user_id: uuid.UUID,
    job_url: str,
    request_payload: dict[str, Any],
) -> dict[str, Any]:
    worker_id = f"celery-{task.request.id or 'local'}"

    async with get_session() as session:
        svc       = ApplicationService(session)
        events    = EventLogService(session)
        conf_svc  = ConfirmationService(session)

        app = await svc.get(application_id)
        if app is None:
            raise ValueError(f"Application {application_id} not found")

        if app.status not in ("queued", "failed"):
            logger.info(
                "Skipping already-running application %s (status=%s)",
                application_id, app.status,
            )
            return {"skipped": True, "status": app.status}

        attempt_number = (app.attempt_count or 0) + 1

        # ── 1. Mark running ───────────────────────────────────────────────
        app = await svc.mark_running(application_id, worker_id)

        # Record an apply_run for audit trail
        run_id = await _create_apply_run(session, app, job_url, request_payload)

        try:
            # ── 2. Build ApplyRequest ─────────────────────────────────────
            await svc.advance_execution(application_id, ExecutionStatus.LOADING_FORM)
            profile = _build_profile(request_payload)

            # Wire up the SupabaseEventEmitter for real-time log streaming
            # and the user confirmation gate
            from apply_engine.event_emitter import SupabaseEventEmitter, set_emitter, reset_emitter

            supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
            supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

            emitter = None
            if supabase_url and supabase_key:
                emitter = SupabaseEventEmitter(
                    application_id=str(application_id),
                    supabase_url=supabase_url,
                    supabase_key=supabase_key,
                )

            apply_request = ApplyRequest(
                url=job_url,
                profile=profile,
                dry_run=False,
                runtime_hints=request_payload.get("runtime_hints", {}),
                application_id=str(application_id),
                emitter=emitter,
            )

            # ── 3. Run the portal automation ──────────────────────────────
            await svc.advance_execution(application_id, ExecutionStatus.PARSING_FORM)

            token = set_emitter(emitter)
            try:
                from apply_engine.registry import route_application
                from apply_engine.main import _resolve_resume_path

                await svc.advance_execution(application_id, ExecutionStatus.FILLING_FIELDS)
                apply_request.profile.resume_pdf_path = _resolve_resume_path(
                    apply_request.profile.resume_pdf_path
                )

                await svc.advance_execution(application_id, ExecutionStatus.SUBMITTING)
                result = await route_application(apply_request)
            finally:
                reset_emitter(token)

            # ── 4. Interpret result ────────────────────────────────────────

            if result.status == "applied":
                await svc.advance_execution(
                    application_id, ExecutionStatus.VERIFYING_CONFIRMATION
                )
                # Persist structured confirmation
                conf = await conf_svc.create(
                    application_id=application_id,
                    user_id=user_id,
                    attempt_number=attempt_number,
                    confirmation_snippet=result.confirmation_snippet,
                )

                # Emit confirmation event
                await events.emit(
                    application_id=application_id,
                    user_id=user_id,
                    event_type="confirmation.detected",
                    summary=f"Confirmation captured ({conf.confirmation_type}, confidence {conf.confidence_score:.0%})",
                    level="success",
                    attempt_number=attempt_number,
                    data={
                        "confirmation_type": conf.confirmation_type,
                        "confidence_score": conf.confidence_score,
                        "external_application_id": conf.external_application_id,
                        "detected_text_preview": (result.confirmation_snippet or "")[:120],
                    },
                )

                await _update_apply_run(session, run_id, "applied", result)
                await svc.mark_completed(
                    application_id,
                    confirmation_text=result.confirmation_snippet,
                    run_id=run_id,
                )
                return {"status": "applied", "confirmation_type": conf.confirmation_type}

            elif result.status == "requires_auth":
                unresolved = result.unresolved_questions or []
                prompt = (
                    unresolved[0] if unresolved
                    else "The portal requires authentication. Please check your saved credentials."
                )
                await events.emit(
                    application_id=application_id,
                    user_id=user_id,
                    event_type="portal.auth_required",
                    summary="Authentication required",
                    level="warn",
                    attempt_number=attempt_number,
                    data={"portal": result.portal, "unresolved": unresolved},
                )
                await _update_apply_run(session, run_id, "requires_auth", result)
                await svc.mark_requires_action(
                    application_id,
                    action_type="auth",
                    prompt=prompt,
                    context={
                        "portal": result.portal,
                        "unresolved_questions": unresolved,
                        "recovery_family": result.recovery_family,
                    },
                )
                return {"status": "requires_auth"}

            elif result.status == "unsupported":
                await events.emit(
                    application_id=application_id,
                    user_id=user_id,
                    event_type="portal.unsupported",
                    summary=f"Portal not supported: {result.portal}",
                    level="error",
                    attempt_number=attempt_number,
                    data={"portal": result.portal, "url": job_url},
                )
                await _update_apply_run(session, run_id, "unsupported", result)
                await svc.mark_failed(
                    application_id,
                    f"Portal {result.portal!r} is not supported",
                    permanent=True,
                    run_id=run_id,
                )
                return {"status": "unsupported"}

            else:  # failed
                error = result.error or "Apply engine returned failed status"
                await events.emit(
                    application_id=application_id,
                    user_id=user_id,
                    event_type="automation.error",
                    summary=f"Apply attempt failed: {error[:120]}",
                    level="error",
                    attempt_number=attempt_number,
                    data={
                        "error": error,
                        "portal": result.portal,
                        "unresolved_questions": result.unresolved_questions,
                    },
                )
                await _update_apply_run(session, run_id, "failed", result)
                await svc.mark_failed(application_id, error, run_id=run_id)
                return {"status": "failed", "error": error}

        except Exception as exc:
            error_msg = f"{type(exc).__name__}: {exc}"
            logger.error(
                "apply_task.exception",
                extra={"application_id": str(application_id), "error": error_msg},
                exc_info=True,
            )
            try:
                await events.emit(
                    application_id=application_id,
                    user_id=user_id,
                    event_type="automation.error",
                    summary=f"Unhandled error: {error_msg[:120]}",
                    level="error",
                    attempt_number=attempt_number,
                    data={"error": error_msg},
                )
                await svc.mark_failed(application_id, error_msg)
            except Exception:
                pass
            raise


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_profile(request_payload: dict[str, Any]) -> ApplicantProfile:
    """Build an ApplicantProfile from the stored request_payload."""
    profile_dict = request_payload.get("profile", {})
    parsed = ApplicantProfilePayload.from_dict(profile_dict)
    return ApplicantProfile(**parsed.to_dict())


async def _create_apply_run(
    session: Any,
    app: Any,
    job_url: str,
    request_payload: dict[str, Any],
) -> uuid.UUID:
    from sqlalchemy import insert
    from apply_engine.tracking.orm import ApplyRun

    run = ApplyRun(
        user_id=app.user_id,
        job_id=app.job_id,
        application_id=app.id,
        mode="submit",
        url=job_url,
        status="running",
        request_payload=request_payload,
        result_payload={},
    )
    session.add(run)
    await session.flush()
    return run.id


async def _update_apply_run(
    session: Any,
    run_id: uuid.UUID,
    status: str,
    result: Any,
) -> None:
    from sqlalchemy import select
    from apply_engine.tracking.orm import ApplyRun
    from apply_engine.serialize import serialize_apply_result

    r = await session.get(ApplyRun, run_id)
    if r is None:
        return
    r.status = status
    r.result_payload = serialize_apply_result(result).to_dict()
    if status == "failed" and result.error:
        r.error = result.error


async def _async_mark_failed(
    application_id: uuid.UUID,
    error: str,
    permanent: bool = False,
) -> None:
    async with get_session() as session:
        svc = ApplicationService(session)
        try:
            await svc.mark_failed(application_id, error, permanent=permanent)
        except Exception:
            pass
