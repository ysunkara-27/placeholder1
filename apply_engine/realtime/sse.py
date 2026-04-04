"""
apply_engine/realtime/sse.py
─────────────────────────────
SSE broadcaster: publishes structured events to Redis and lets the
/applications/{id}/stream endpoint fan them out to connected clients.

Publishing (from anywhere in the worker or service layer):

    broadcaster = SSEBroadcaster()
    await broadcaster.publish(application_id, StatusUpdateEvent(...))
    await broadcaster.publish(application_id, LogStreamEvent(...))

This module is also used by EventLogService to broadcast events
without the caller needing to know about Redis.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

logger = logging.getLogger("apply_engine.realtime.sse")


def _channel(application_id: str) -> str:
    return f"apply:events:{application_id}"


class SSEBroadcaster:
    """
    Publishes event payloads to the Redis pub/sub channel for an application.
    No-ops cleanly when Redis is not configured.
    """

    def __init__(self, redis_url: str | None = None) -> None:
        self._redis_url = redis_url or os.environ.get("REDIS_URL", "")

    async def publish(self, application_id: str, payload: dict[str, Any] | Any) -> None:
        if not self._redis_url:
            return

        if hasattr(payload, "model_dump"):
            data = json.dumps(payload.model_dump())
        elif isinstance(payload, dict):
            data = json.dumps(payload)
        else:
            data = str(payload)

        channel = _channel(application_id)
        try:
            import redis.asyncio as aioredis  # type: ignore[import]
            async with aioredis.from_url(self._redis_url, decode_responses=True) as r:
                await r.publish(channel, data)
        except Exception as exc:  # noqa: BLE001
            logger.debug("Redis publish failed (non-fatal): %s", exc)

    async def publish_status(
        self,
        application_id: str,
        status: str,
        execution_status: str | None,
        user_message: str | None,
        progress_percent: int,
        *,
        requires_action: bool = False,
        confirmation_present: bool = False,
        ts: str | None = None,
    ) -> None:
        from datetime import datetime, timezone
        await self.publish(
            application_id,
            {
                "event": "status_update",
                "application_id": application_id,
                "status": status,
                "execution_status": execution_status,
                "user_message": user_message,
                "progress_percent": progress_percent,
                "requires_action": requires_action,
                "confirmation_present": confirmation_present,
                "ts": ts or datetime.now(timezone.utc).isoformat(),
            },
        )

    async def publish_log(
        self,
        application_id: str,
        event_type: str,
        level: str,
        summary: str,
        data: dict[str, Any] | None = None,
        ts: str | None = None,
    ) -> None:
        from datetime import datetime, timezone
        await self.publish(
            application_id,
            {
                "event": "log",
                "application_id": application_id,
                "event_type": event_type,
                "level": level,
                "summary": summary,
                "data": data or {},
                "ts": ts or datetime.now(timezone.utc).isoformat(),
            },
        )
