"""
apply_engine/tracking/event_log.py
────────────────────────────────────
Structured event log service.

All writes are append-only (no updates, no deletes).
Events are also broadcast to the SSE channel if Redis is available.

Standard event types
────────────────────
application.created          application.queued
application.started          application.retry_scheduled
application.completed        application.failed
automation.started           automation.error
form.detected                form.loaded
field.matched                field.unmatched
field.filled                 file.uploaded
question.unresolved          submit.clicked
confirmation.detected        confirmation.absent
action_request.created       action_request.resolved
portal.auth_required         portal.auth_succeeded
portal.unsupported
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from apply_engine.tracking.orm import ApplicationEvent
from apply_engine.tracking.enums import EventLevel

logger = logging.getLogger("apply_engine.event_log")


# ── Redis channel name ────────────────────────────────────────────────────────

def _channel(application_id: str) -> str:
    return f"apply:events:{application_id}"


# ── Optional Redis publish ────────────────────────────────────────────────────

async def _publish_to_redis(channel: str, payload: dict[str, Any]) -> None:
    """Publish event to Redis pub/sub channel for SSE fan-out.
    Silently skips if Redis is not configured."""
    redis_url = os.environ.get("REDIS_URL", "")
    if not redis_url:
        return
    try:
        import redis.asyncio as aioredis  # type: ignore[import]
        async with aioredis.from_url(redis_url, decode_responses=True) as r:
            await r.publish(channel, json.dumps(payload))
    except Exception as exc:  # noqa: BLE001
        logger.debug("Redis publish failed (non-fatal): %s", exc)


# ── EventLogService ───────────────────────────────────────────────────────────

class EventLogService:
    """
    Append structured events to application_events and broadcast to SSE.

    Usage:
        svc = EventLogService(session)
        await svc.emit(
            application_id=app.id,
            user_id=app.user_id,
            event_type="field.matched",
            summary="Matched email → applicant.email",
            data={"field": "email", "value": "alice@example.com"},
        )
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def emit(
        self,
        application_id: uuid.UUID,
        user_id: uuid.UUID,
        event_type: str,
        summary: str,
        *,
        level: str = EventLevel.INFO,
        data: dict[str, Any] | None = None,
        attempt_number: int | None = None,
    ) -> ApplicationEvent:
        ts = datetime.now(timezone.utc)
        event = ApplicationEvent(
            application_id=application_id,
            user_id=user_id,
            attempt_number=attempt_number,
            event_type=event_type,
            level=level,
            summary=summary,
            data=data or {},
            created_at=ts,
        )
        self._session.add(event)
        await self._session.flush()  # get the generated id

        # Structured log line
        logger.info(
            "event",
            extra={
                "application_id": str(application_id),
                "user_id": str(user_id),
                "event_type": event_type,
                "level": level,
                "summary": summary,
                "attempt_number": attempt_number,
                "data": data or {},
                "ts": ts.isoformat(),
            },
        )

        # Non-blocking Redis fan-out for SSE
        await _publish_to_redis(
            _channel(str(application_id)),
            {
                "event": "log",
                "application_id": str(application_id),
                "event_type": event_type,
                "level": level,
                "summary": summary,
                "data": data or {},
                "ts": ts.isoformat(),
            },
        )

        return event

    async def emit_status_change(
        self,
        application_id: uuid.UUID,
        user_id: uuid.UUID,
        new_status: str,
        execution_status: str | None,
        user_message: str | None,
        progress_percent: int,
        *,
        attempt_number: int | None = None,
        data: dict[str, Any] | None = None,
    ) -> None:
        """Broadcast a status-change SSE event without writing to application_events."""
        ts = datetime.now(timezone.utc)

        logger.info(
            "status_change",
            extra={
                "application_id": str(application_id),
                "user_id": str(user_id),
                "status": new_status,
                "execution_status": execution_status,
                "user_message": user_message,
                "progress_percent": progress_percent,
                "ts": ts.isoformat(),
            },
        )

        await _publish_to_redis(
            _channel(str(application_id)),
            {
                "event": "status_update",
                "application_id": str(application_id),
                "status": new_status,
                "execution_status": execution_status,
                "user_message": user_message,
                "progress_percent": progress_percent,
                "requires_action": new_status in ("requires_auth",),
                "confirmation_present": new_status == "applied",
                "ts": ts.isoformat(),
            },
        )

    async def list_events(
        self,
        application_id: uuid.UUID,
        *,
        limit: int = 50,
        offset: int = 0,
        event_types: list[str] | None = None,
        level: str | None = None,
    ) -> tuple[list[ApplicationEvent], int]:
        """
        Return paginated events for an application.
        Returns (events, total_count).
        """
        q = (
            select(ApplicationEvent)
            .where(ApplicationEvent.application_id == application_id)
            .order_by(ApplicationEvent.created_at.asc())
        )
        count_q = (
            select(func.count())
            .select_from(ApplicationEvent)
            .where(ApplicationEvent.application_id == application_id)
        )

        if event_types:
            q = q.where(ApplicationEvent.event_type.in_(event_types))
            count_q = count_q.where(ApplicationEvent.event_type.in_(event_types))

        if level:
            q = q.where(ApplicationEvent.level == level)
            count_q = count_q.where(ApplicationEvent.level == level)

        q = q.limit(limit).offset(offset)

        result = await self._session.execute(q)
        count_result = await self._session.execute(count_q)

        events = list(result.scalars().all())
        total = count_result.scalar_one()
        return events, total

    async def get_latest_event(
        self,
        application_id: uuid.UUID,
        event_type: str | None = None,
    ) -> ApplicationEvent | None:
        q = (
            select(ApplicationEvent)
            .where(ApplicationEvent.application_id == application_id)
            .order_by(ApplicationEvent.created_at.desc())
            .limit(1)
        )
        if event_type:
            q = q.where(ApplicationEvent.event_type == event_type)
        result = await self._session.execute(q)
        return result.scalar_one_or_none()
