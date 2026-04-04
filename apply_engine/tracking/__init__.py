"""
apply_engine/tracking
─────────────────────
Production tracking layer for job application execution.

Exports the three primary services used by API routes and workers:
    ApplicationService   – lifecycle management (create, queue, retry, respond)
    EventLogService      – structured event emission and querying
    ConfirmationService  – confirmation evidence storage and parsing

Imports are deferred so the module can be imported safely even when
SQLAlchemy / asyncpg are not installed (e.g. during test discovery
or linting in environments without the full requirements).
"""

from __future__ import annotations


def __getattr__(name: str):  # noqa: ANN001
    if name == "ApplicationService":
        from apply_engine.tracking.service import ApplicationService
        return ApplicationService
    if name == "EventLogService":
        from apply_engine.tracking.event_log import EventLogService
        return EventLogService
    if name == "ConfirmationService":
        from apply_engine.tracking.confirmation import ConfirmationService
        return ConfirmationService
    raise AttributeError(f"module 'apply_engine.tracking' has no attribute {name!r}")


__all__ = [
    "ApplicationService",
    "EventLogService",
    "ConfirmationService",
]
