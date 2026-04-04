"""
apply_engine/api/applications.py
──────────────────────────────────
FastAPI router for application lifecycle management.

Routes:
    POST   /applications                        — create or get
    GET    /applications/{id}                   — detail view
    GET    /applications/{id}/events            — paginated event log
    GET    /applications/{id}/confirmation      — confirmation evidence
    POST   /applications/{id}/retry             — re-queue failed application
    POST   /applications/{id}/action-response   — respond to action request
    GET    /applications/{id}/stream            — SSE real-time stream

Authentication:
    All routes require X-User-Id header (UUID).
    In production, replace with proper JWT middleware.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from typing import AsyncIterator

from fastapi import APIRouter, Header, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from apply_engine.tracking.db import get_session
from apply_engine.tracking.enums import execution_to_progress, ExecutionStatus
from apply_engine.tracking.orm import Application
from apply_engine.tracking.schemas import (
    ActionRequestResponse,
    ActionResponseRequest,
    ApplicationConfirmationResponse,
    ApplicationDetailResponse,
    ApplicationEventResponse,
    ApplicationResponse,
    CreateApplicationRequest,
    EventListResponse,
    RetryApplicationRequest,
)
from apply_engine.tracking.service import ApplicationService
from apply_engine.tracking.event_log import EventLogService
from apply_engine.tracking.confirmation import ConfirmationService

logger = logging.getLogger("apply_engine.api.applications")

router = APIRouter(prefix="/applications", tags=["applications"])


# ── Auth helper ───────────────────────────────────────────────────────────────

def _require_user_id(x_user_id: str | None) -> uuid.UUID:
    if not x_user_id:
        raise HTTPException(status_code=401, detail="X-User-Id header required")
    try:
        return uuid.UUID(x_user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="X-User-Id must be a valid UUID")


# ── Response builders ─────────────────────────────────────────────────────────

def _build_response(app: Application) -> dict:
    exec_status = (
        ExecutionStatus(app.execution_status) if app.execution_status else None
    )
    progress = execution_to_progress(exec_status) if exec_status else 0

    return {
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
        "last_event_at": None,  # populated in detail route
        "confirmation_present": app.confirmation is not None if hasattr(app, "confirmation") else False,
        "requires_action": app.status == "requires_auth",
        "retry_available": app.status in ("failed", "confirmation_timeout", "requires_auth")
            and (app.attempt_count or 0) < (app.max_attempts or 3),
        "attempt_count": app.attempt_count or 0,
        "max_attempts": app.max_attempts or 3,
        "last_error": app.last_error,
    }


# ── POST /applications ────────────────────────────────────────────────────────

@router.post("", response_model=ApplicationResponse, status_code=201)
async def create_application(
    body: CreateApplicationRequest,
    x_user_id: str | None = Header(default=None),
):
    user_id = _require_user_id(x_user_id)

    if not body.job_url and body.job_id is None:
        raise HTTPException(status_code=400, detail="job_url or job_id is required")

    job_url = body.job_url or ""

    async with get_session() as session:
        svc = ApplicationService(session)
        app, created = await svc.create_or_get(
            user_id,
            job_id=body.job_id,
            job_url=job_url,
            request_payload=body.request_payload,
            idempotency_key=body.idempotency_key,
        )

        if created:
            # Enqueue the Celery task (import lazily to allow running without Redis)
            _enqueue(str(app.id), str(user_id), job_url, app.request_payload)

        data = _build_response(app)

    status_code = 201 if created else 200
    return ApplicationResponse.model_validate(data)


# ── GET /applications/{id} ────────────────────────────────────────────────────

@router.get("/{application_id}", response_model=ApplicationDetailResponse)
async def get_application(
    application_id: uuid.UUID,
    x_user_id: str | None = Header(default=None),
):
    user_id = _require_user_id(x_user_id)

    async with get_session() as session:
        svc    = ApplicationService(session)
        events_svc = EventLogService(session)
        conf_svc   = ConfirmationService(session)

        app = await svc.get(application_id)
        if app is None or app.user_id != user_id:
            raise HTTPException(status_code=404, detail="Application not found")

        # Fetch recent events (last 10 for summary)
        recent_raw, _ = await events_svc.list_events(application_id, limit=10, offset=0)
        recent = [
            ApplicationEventResponse.model_validate(e.__dict__)
            for e in recent_raw
        ]

        last_event_at = recent[-1].created_at if recent else None

        # Confirmation
        conf_orm = await conf_svc.get(application_id)
        conf = ApplicationConfirmationResponse.model_validate(conf_orm.__dict__) if conf_orm else None

        # Pending actions
        pending_actions_orm = await svc.list_pending_actions(application_id)
        pending_actions = [
            ActionRequestResponse.model_validate(a.__dict__) for a in pending_actions_orm
        ]

        base = _build_response(app)
        base["last_event_at"] = last_event_at
        base["confirmation_present"] = conf is not None
        base["requires_action"] = bool(pending_actions)

    detail = ApplicationDetailResponse.model_validate(base)
    detail.recent_events = recent
    detail.confirmation = conf
    detail.pending_action_requests = pending_actions
    return detail


# ── GET /applications/{id}/events ─────────────────────────────────────────────

@router.get("/{application_id}/events", response_model=EventListResponse)
async def list_events(
    application_id: uuid.UUID,
    x_user_id: str | None = Header(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    level: str | None = Query(default=None),
):
    user_id = _require_user_id(x_user_id)

    async with get_session() as session:
        svc = ApplicationService(session)
        app = await svc.get(application_id)
        if app is None or app.user_id != user_id:
            raise HTTPException(status_code=404, detail="Application not found")

        events_svc = EventLogService(session)
        events_orm, total = await events_svc.list_events(
            application_id, limit=limit, offset=offset, level=level
        )
        events = [ApplicationEventResponse.model_validate(e.__dict__) for e in events_orm]

    return EventListResponse(
        application_id=application_id,
        events=events,
        total=total,
        has_more=(offset + limit) < total,
        next_cursor=str(offset + limit) if (offset + limit) < total else None,
    )


# ── GET /applications/{id}/confirmation ──────────────────────────────────────

@router.get("/{application_id}/confirmation", response_model=ApplicationConfirmationResponse)
async def get_confirmation(
    application_id: uuid.UUID,
    x_user_id: str | None = Header(default=None),
):
    user_id = _require_user_id(x_user_id)

    async with get_session() as session:
        svc = ApplicationService(session)
        app = await svc.get(application_id)
        if app is None or app.user_id != user_id:
            raise HTTPException(status_code=404, detail="Application not found")

        conf_svc = ConfirmationService(session)
        conf = await conf_svc.get(application_id)
        if conf is None:
            raise HTTPException(status_code=404, detail="No confirmation record for this application")

    return ApplicationConfirmationResponse.model_validate(conf.__dict__)


# ── POST /applications/{id}/retry ─────────────────────────────────────────────

@router.post("/{application_id}/retry", response_model=ApplicationResponse)
async def retry_application(
    application_id: uuid.UUID,
    body: RetryApplicationRequest,
    x_user_id: str | None = Header(default=None),
):
    user_id = _require_user_id(x_user_id)

    async with get_session() as session:
        svc = ApplicationService(session)
        app = await svc.get(application_id)
        if app is None or app.user_id != user_id:
            raise HTTPException(status_code=404, detail="Application not found")

        try:
            app = await svc.schedule_retry(application_id, force=body.force)
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc))

        _enqueue(str(app.id), str(user_id), _extract_job_url(app), app.request_payload)
        data = _build_response(app)

    return ApplicationResponse.model_validate(data)


# ── POST /applications/{id}/action-response ───────────────────────────────────

@router.post("/{application_id}/action-response", response_model=ActionRequestResponse)
async def respond_to_action(
    application_id: uuid.UUID,
    body: ActionResponseRequest,
    x_user_id: str | None = Header(default=None),
):
    user_id = _require_user_id(x_user_id)

    async with get_session() as session:
        svc = ApplicationService(session)
        app = await svc.get(application_id)
        if app is None or app.user_id != user_id:
            raise HTTPException(status_code=404, detail="Application not found")

        try:
            action = await svc.respond_to_action(
                application_id, body.action_request_id, body.response
            )
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc))

    return ActionRequestResponse.model_validate(action.__dict__)


# ── GET /applications/{id}/stream  (SSE) ─────────────────────────────────────

@router.get("/{application_id}/stream")
async def stream_application(
    application_id: uuid.UUID,
    request: Request,
    x_user_id: str | None = Header(default=None),
):
    """
    Server-Sent Events endpoint.
    Streams status_update and log events until the application reaches
    a terminal state or the client disconnects.

    If Redis is configured (REDIS_URL), uses pub/sub for real-time delivery.
    Otherwise, falls back to polling the database every 2 seconds.
    """
    user_id = _require_user_id(x_user_id)

    # Verify ownership
    async with get_session() as session:
        svc = ApplicationService(session)
        app = await svc.get(application_id)
        if app is None or app.user_id != user_id:
            raise HTTPException(status_code=404, detail="Application not found")

    redis_url = os.environ.get("REDIS_URL", "")
    if redis_url:
        generator = _redis_stream(str(application_id), request, redis_url)
    else:
        generator = _poll_stream(application_id, request)

    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


async def _redis_stream(
    application_id: str,
    request: Request,
    redis_url: str,
) -> AsyncIterator[str]:
    try:
        import redis.asyncio as aioredis  # type: ignore[import]
    except ImportError:
        async for chunk in _poll_stream(uuid.UUID(application_id), request):
            yield chunk
        return

    channel = f"apply:events:{application_id}"
    async with aioredis.from_url(redis_url, decode_responses=True) as r:
        async with r.pubsub() as pubsub:
            await pubsub.subscribe(channel)
            try:
                while True:
                    if await request.is_disconnected():
                        break
                    msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                    if msg and msg.get("type") == "message":
                        data = msg.get("data", "")
                        yield f"data: {data}\n\n"
                        try:
                            parsed = json.loads(data)
                            status = parsed.get("status", "")
                            if status in ("applied", "failed", "cancelled"):
                                yield "data: {\"event\":\"done\"}\n\n"
                                break
                        except Exception:
                            pass
            finally:
                await pubsub.unsubscribe(channel)


async def _poll_stream(
    application_id: uuid.UUID,
    request: Request,
) -> AsyncIterator[str]:
    """Fallback SSE via DB polling (2 s interval)."""
    last_event_id: uuid.UUID | None = None
    terminal = {"applied", "failed", "cancelled", "confirmation_timeout"}

    while True:
        if await request.is_disconnected():
            break

        async with get_session() as session:
            events_svc = EventLogService(session)
            svc = ApplicationService(session)

            # Emit new events since last seen
            q_events, _ = await events_svc.list_events(application_id, limit=50)
            new_events = [e for e in q_events if last_event_id is None or e.created_at > (
                next((x.created_at for x in q_events if x.id == last_event_id), None) or e.created_at
            )]
            for ev in new_events:
                payload = json.dumps({
                    "event": "log",
                    "event_type": ev.event_type,
                    "level": ev.level,
                    "summary": ev.summary,
                    "data": ev.data,
                    "ts": ev.created_at.isoformat(),
                })
                yield f"data: {payload}\n\n"
                last_event_id = ev.id

            app = await svc.get(application_id)
            if app and app.status in terminal:
                yield "data: {\"event\":\"done\"}\n\n"
                break

        await asyncio.sleep(2)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _extract_job_url(app: Application) -> str:
    payload = app.request_payload or {}
    return str(payload.get("url", ""))


def _enqueue(
    application_id: str,
    user_id: str,
    job_url: str,
    request_payload: dict,
) -> None:
    """Enqueue a Celery apply task. Silently skips if Celery is not available."""
    try:
        from apply_engine.workers.apply_task import run_apply_task  # type: ignore
        run_apply_task.apply_async(
            args=[application_id, user_id, job_url, request_payload],
            task_id=f"apply-{application_id}",
        )
        logger.info("Enqueued apply task for application %s", application_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not enqueue Celery task (workers not running?): %s", exc)
