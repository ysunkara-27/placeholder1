"""
apply_engine/tracking/service.py
──────────────────────────────────
ApplicationService — the primary business logic layer.

Responsibilities:
  - Create or retrieve an Application record (idempotent via fingerprint)
  - Advance status through the lifecycle
  - Schedule and track retries (exponential backoff, max_attempts cap)
  - Record action requests from the worker
  - Resolve action requests from the user
  - Provide query methods for the API routes

All writes are transactional via the injected AsyncSession.
The service never calls the portal adapters — that is the worker's job.

Idempotency
──────────────
Every application is keyed by (user_id, fingerprint), where:
    fingerprint = sha256(user_id + ":" + canonical_job_url)

A caller passing the same (user_id, job_url) pair always gets back
the same Application record if it already exists and is not in a
terminal state.  Terminal states (applied, failed after max attempts,
cancelled) allow a new application to be created.
"""

from __future__ import annotations

import hashlib
import logging
import math
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from apply_engine.tracking.enums import (
    DbStatus,
    ExecutionStatus,
    execution_to_progress,
    execution_to_user_message,
    execution_to_user_status,
)
from apply_engine.tracking.event_log import EventLogService
from apply_engine.tracking.orm import (
    ActionRequest,
    Application,
    ApplicationEvent,
)

logger = logging.getLogger("apply_engine.service")

# ── Retry policy ──────────────────────────────────────────────────────────────

_BASE_DELAY_SECONDS  = 60          # 1 minute base
_BACKOFF_MULTIPLIER  = 2.5
_MAX_DELAY_SECONDS   = 3600        # cap at 1 hour

# Statuses from which a retry is allowed
_RETRYABLE_STATUSES = {
    DbStatus.FAILED,
    DbStatus.CONFIRMATION_TIMEOUT,
    DbStatus.REQUIRES_AUTH,
}

# Terminal statuses — a new Application record should be created instead
_TERMINAL_STATUSES = {DbStatus.APPLIED, DbStatus.CANCELLED}


def _fingerprint(user_id: uuid.UUID, job_url: str) -> str:
    raw = f"{user_id}:{job_url.lower().rstrip('/')}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _retry_delay(attempt_count: int) -> timedelta:
    delay = _BASE_DELAY_SECONDS * (_BACKOFF_MULTIPLIER ** (attempt_count - 1))
    delay = min(delay, _MAX_DELAY_SECONDS)
    return timedelta(seconds=math.ceil(delay))


class ApplicationService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._events  = EventLogService(session)

    # ── Creation ──────────────────────────────────────────────────────────────

    async def create_or_get(
        self,
        user_id: uuid.UUID,
        *,
        job_id: uuid.UUID | None = None,
        job_url: str,
        request_payload: dict[str, Any],
        max_attempts: int = 3,
        idempotency_key: str | None = None,
    ) -> tuple[Application, bool]:
        """
        Return (application, created).

        If an in-progress or queued application with the same fingerprint
        already exists, return it with created=False.
        If a terminal application exists, create a new one.
        """
        fp = idempotency_key or _fingerprint(user_id, job_url)

        existing = await self._get_by_fingerprint(user_id, fp)
        if existing is not None and existing.status not in {
            s.value for s in _TERMINAL_STATUSES
        }:
            return existing, False

        app = Application(
            user_id=user_id,
            job_id=job_id,
            status=DbStatus.QUEUED.value,
            execution_status=ExecutionStatus.CREATED.value,
            latest_user_message=execution_to_user_message(ExecutionStatus.CREATED),
            attempt_count=0,
            max_attempts=max_attempts,
            request_payload=request_payload,
            request_fingerprint=fp,
            queued_at=datetime.now(timezone.utc),
            log_events=[],
        )
        self._session.add(app)
        await self._session.flush()  # populate id

        await self._events.emit(
            application_id=app.id,
            user_id=user_id,
            event_type="application.created",
            summary="Application created and queued",
            level="info",
            data={"job_url": job_url, "fingerprint": fp},
        )

        logger.info(
            "application.created",
            extra={"application_id": str(app.id), "user_id": str(user_id), "job_url": job_url},
        )
        return app, True

    # ── Status transitions ────────────────────────────────────────────────────

    async def mark_running(
        self,
        application_id: uuid.UUID,
        worker_id: str,
    ) -> Application:
        app = await self._require(application_id)
        app.status = DbStatus.RUNNING.value
        app.execution_status = ExecutionStatus.STARTING.value
        app.latest_user_message = execution_to_user_message(ExecutionStatus.STARTING)
        app.started_at = datetime.now(timezone.utc)
        app.worker_id = worker_id
        app.attempt_count = (app.attempt_count or 0) + 1
        app.last_error = None

        await self._events.emit(
            application_id=application_id,
            user_id=app.user_id,
            event_type="automation.started",
            summary=f"Worker {worker_id} started attempt {app.attempt_count}",
            level="info",
            attempt_number=app.attempt_count,
            data={"worker_id": worker_id, "attempt": app.attempt_count},
        )
        await self._broadcast_status(app)
        return app

    async def advance_execution(
        self,
        application_id: uuid.UUID,
        execution_status: ExecutionStatus,
        *,
        extra_data: dict[str, Any] | None = None,
    ) -> Application:
        """Update execution_status and broadcast SSE without writing an event row."""
        app = await self._require(application_id)
        app.execution_status = execution_status.value
        app.latest_user_message = execution_to_user_message(execution_status)
        await self._broadcast_status(app, extra_data=extra_data)
        return app

    async def mark_completed(
        self,
        application_id: uuid.UUID,
        *,
        confirmation_text: str = "",
        run_id: uuid.UUID | None = None,
    ) -> Application:
        app = await self._require(application_id)
        now = datetime.now(timezone.utc)
        app.status = DbStatus.APPLIED.value
        app.execution_status = ExecutionStatus.COMPLETED.value
        app.latest_user_message = execution_to_user_message(ExecutionStatus.COMPLETED)
        app.confirmation_text = confirmation_text or None
        app.completed_at = now
        app.applied_at = now
        if run_id:
            app.last_run_id = run_id

        await self._events.emit(
            application_id=application_id,
            user_id=app.user_id,
            event_type="application.completed",
            summary="Application submitted successfully",
            level="success",
            attempt_number=app.attempt_count,
            data={"confirmation_text": confirmation_text},
        )
        await self._broadcast_status(app)
        return app

    async def mark_failed(
        self,
        application_id: uuid.UUID,
        error: str,
        *,
        permanent: bool = False,
        run_id: uuid.UUID | None = None,
    ) -> Application:
        app = await self._require(application_id)
        app.last_error = error
        if run_id:
            app.last_run_id = run_id

        can_retry = (
            not permanent
            and (app.attempt_count or 0) < (app.max_attempts or 3)
        )

        if can_retry:
            delay = _retry_delay(app.attempt_count or 1)
            app.status = DbStatus.FAILED.value
            app.execution_status = ExecutionStatus.RETRY_SCHEDULED.value
            app.latest_user_message = f"Failed — retrying in {int(delay.total_seconds() // 60)} min"
            app.retry_after = datetime.now(timezone.utc) + delay

            await self._events.emit(
                application_id=application_id,
                user_id=app.user_id,
                event_type="application.retry_scheduled",
                summary=f"Attempt {app.attempt_count} failed — retry scheduled",
                level="warn",
                attempt_number=app.attempt_count,
                data={
                    "error": error,
                    "retry_in_seconds": int(delay.total_seconds()),
                    "next_attempt": (app.attempt_count or 0) + 1,
                },
            )
        else:
            app.status = DbStatus.FAILED.value
            app.execution_status = ExecutionStatus.FAILED.value
            app.latest_user_message = execution_to_user_message(ExecutionStatus.FAILED)
            app.completed_at = datetime.now(timezone.utc)

            await self._events.emit(
                application_id=application_id,
                user_id=app.user_id,
                event_type="application.failed",
                summary=f"Application failed permanently after {app.attempt_count} attempt(s)",
                level="error",
                attempt_number=app.attempt_count,
                data={"error": error, "permanent": True},
            )

        await self._broadcast_status(app)
        return app

    async def mark_requires_action(
        self,
        application_id: uuid.UUID,
        action_type: str,
        prompt: str,
        *,
        context: dict[str, Any] | None = None,
        expires_hours: int = 24,
    ) -> ActionRequest:
        app = await self._require(application_id)
        app.status = DbStatus.REQUIRES_AUTH.value  # closest existing status
        app.execution_status = ExecutionStatus.REQUIRES_ACTION.value
        app.latest_user_message = execution_to_user_message(ExecutionStatus.REQUIRES_ACTION)

        action = ActionRequest(
            application_id=application_id,
            user_id=app.user_id,
            attempt_number=app.attempt_count or 1,
            action_type=action_type,
            prompt=prompt,
            context=context or {},
            status="pending",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=expires_hours),
        )
        self._session.add(action)
        await self._session.flush()

        await self._events.emit(
            application_id=application_id,
            user_id=app.user_id,
            event_type="action_request.created",
            summary=f"Action required ({action_type}): {prompt[:80]}",
            level="warn",
            attempt_number=app.attempt_count,
            data={"action_request_id": str(action.id), "action_type": action_type, "prompt": prompt},
        )
        await self._broadcast_status(app)
        return action

    # ── Retry ─────────────────────────────────────────────────────────────────

    async def schedule_retry(
        self,
        application_id: uuid.UUID,
        *,
        force: bool = False,
    ) -> Application:
        """
        Re-queue an application for another attempt.
        Raises ValueError if not retryable and force=False.
        """
        app = await self._require(application_id)

        if not force and app.status not in {s.value for s in _RETRYABLE_STATUSES}:
            raise ValueError(
                f"Application {application_id} cannot be retried "
                f"(current status: {app.status})"
            )

        if not force and (app.attempt_count or 0) >= (app.max_attempts or 3):
            raise ValueError(
                f"Application {application_id} has reached max_attempts ({app.max_attempts}). "
                "Pass force=True to override."
            )

        app.status = DbStatus.QUEUED.value
        app.execution_status = ExecutionStatus.QUEUED.value
        app.latest_user_message = execution_to_user_message(ExecutionStatus.QUEUED)
        app.retry_after = None
        app.last_error = None

        await self._events.emit(
            application_id=application_id,
            user_id=app.user_id,
            event_type="application.queued",
            summary=f"Application re-queued for attempt {(app.attempt_count or 0) + 1}",
            level="info",
            data={"triggered_by": "user_retry"},
        )
        await self._broadcast_status(app)
        return app

    # ── Action response ───────────────────────────────────────────────────────

    async def respond_to_action(
        self,
        application_id: uuid.UUID,
        action_request_id: uuid.UUID,
        response: str,
    ) -> ActionRequest:
        result = await self._session.execute(
            select(ActionRequest).where(
                and_(
                    ActionRequest.id == action_request_id,
                    ActionRequest.application_id == application_id,
                    ActionRequest.status == "pending",
                )
            )
        )
        action = result.scalar_one_or_none()
        if action is None:
            raise ValueError(
                f"ActionRequest {action_request_id} not found or already responded"
            )

        action.response = response
        action.status = "responded"
        action.responded_at = datetime.now(timezone.utc)

        app = await self._require(application_id)
        await self._events.emit(
            application_id=application_id,
            user_id=app.user_id,
            event_type="action_request.resolved",
            summary=f"User responded to {action.action_type} request",
            level="info",
            attempt_number=action.attempt_number,
            data={"action_request_id": str(action_request_id), "action_type": action.action_type},
        )
        return action

    # ── Queries ───────────────────────────────────────────────────────────────

    async def get(self, application_id: uuid.UUID) -> Application | None:
        result = await self._session.execute(
            select(Application).where(Application.id == application_id)
        )
        return result.scalar_one_or_none()

    async def list_for_user(
        self,
        user_id: uuid.UUID,
        *,
        status: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[Application], int]:
        q = select(Application).where(Application.user_id == user_id)
        count_q = (
            select(func.count())
            .select_from(Application)
            .where(Application.user_id == user_id)
        )

        if status:
            q = q.where(Application.status == status)
            count_q = count_q.where(Application.status == status)

        q = q.order_by(Application.created_at.desc()).limit(limit).offset(offset)

        result = await self._session.execute(q)
        count_result = await self._session.execute(count_q)
        return list(result.scalars().all()), count_result.scalar_one()

    async def list_pending_actions(
        self,
        application_id: uuid.UUID,
    ) -> list[ActionRequest]:
        result = await self._session.execute(
            select(ActionRequest).where(
                and_(
                    ActionRequest.application_id == application_id,
                    ActionRequest.status == "pending",
                )
            ).order_by(ActionRequest.created_at.desc())
        )
        return list(result.scalars().all())

    # ── Helpers ───────────────────────────────────────────────────────────────

    async def _require(self, application_id: uuid.UUID) -> Application:
        app = await self.get(application_id)
        if app is None:
            raise ValueError(f"Application {application_id} not found")
        return app

    async def _get_by_fingerprint(
        self, user_id: uuid.UUID, fingerprint: str
    ) -> Application | None:
        result = await self._session.execute(
            select(Application).where(
                and_(
                    Application.user_id == user_id,
                    Application.request_fingerprint == fingerprint,
                )
            ).order_by(Application.created_at.desc()).limit(1)
        )
        return result.scalar_one_or_none()

    async def _broadcast_status(
        self,
        app: Application,
        *,
        extra_data: dict[str, Any] | None = None,
    ) -> None:
        exec_status = ExecutionStatus(app.execution_status) if app.execution_status else None
        progress = execution_to_progress(exec_status) if exec_status else 0
        await self._events.emit_status_change(
            application_id=app.id,
            user_id=app.user_id,
            new_status=app.status,
            execution_status=app.execution_status,
            user_message=app.latest_user_message,
            progress_percent=progress,
            attempt_number=app.attempt_count,
            data=extra_data,
        )
