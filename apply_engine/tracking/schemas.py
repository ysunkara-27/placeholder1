"""
apply_engine/tracking/schemas.py
──────────────────────────────────
Pydantic v2 request and response schemas for the tracking API.

Schema categories:
    Request  — incoming payloads from Next.js or the worker
    Response — outgoing payloads to the frontend
    Internal — passed between service layer and worker

Frontend-friendly fields on every ApplicationResponse:
    application_id, current_status, user_message, progress_percent,
    last_event_at, confirmation_present, requires_action, retry_available
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


# ── Shared base ───────────────────────────────────────────────────────────────

class _Base(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ── Request schemas ───────────────────────────────────────────────────────────

class CreateApplicationRequest(_Base):
    """POST /applications"""

    job_id: uuid.UUID | None = None
    job_url: str = Field(..., description="Application URL — required if job_id is absent")
    request_payload: dict[str, Any] = Field(
        default_factory=dict,
        description="Full profile + hints payload to replay on retry",
    )
    idempotency_key: str | None = Field(
        default=None,
        description="Caller-supplied key for deduplication (defaults to sha256(user_id+job_url))",
    )


class RetryApplicationRequest(_Base):
    """POST /applications/{id}/retry"""

    force: bool = Field(
        default=False,
        description="Retry even if attempt_count >= max_attempts",
    )


class ActionResponseRequest(_Base):
    """POST /applications/{id}/action-response"""

    action_request_id: uuid.UUID
    response: str = Field(..., min_length=1, description="The user's answer")


# ── Event response ────────────────────────────────────────────────────────────

class ApplicationEventResponse(_Base):
    id: uuid.UUID
    application_id: uuid.UUID
    attempt_number: int | None
    event_type: str
    level: str
    summary: str
    data: dict[str, Any]
    created_at: datetime


# ── Confirmation response ─────────────────────────────────────────────────────

class ApplicationConfirmationResponse(_Base):
    id: uuid.UUID
    application_id: uuid.UUID
    attempt_number: int
    confirmation_type: str
    detected_text: str | None
    external_application_id: str | None
    evidence_url: str | None
    evidence_screenshot_path: str | None
    confidence_score: float
    detected_at: datetime


# ── Action request response ───────────────────────────────────────────────────

class ActionRequestResponse(_Base):
    id: uuid.UUID
    application_id: uuid.UUID
    action_type: str
    prompt: str
    context: dict[str, Any]
    status: str
    response: str | None
    created_at: datetime
    expires_at: datetime


# ── Main application response ─────────────────────────────────────────────────

class ApplicationResponse(_Base):
    """
    Frontend-facing summary of an application.
    All fields needed to render the dashboard card.
    """

    # Identity
    application_id: uuid.UUID = Field(alias="id")
    user_id: uuid.UUID
    job_id: uuid.UUID | None

    # Status (dual-axis)
    current_status: str = Field(alias="status")
    execution_status: str | None
    user_message: str | None = Field(alias="latest_user_message")

    # Progress
    progress_percent: int = 0

    # Timestamps
    created_at: datetime
    queued_at: datetime
    started_at: datetime | None
    completed_at: datetime | None
    last_event_at: datetime | None = None

    # Derived booleans — computed from related objects
    confirmation_present: bool = False
    requires_action: bool = False
    retry_available: bool = False

    # Counts
    attempt_count: int
    max_attempts: int

    # Last error for failed applications
    last_error: str | None


class ApplicationDetailResponse(ApplicationResponse):
    """Extended response including related records."""

    recent_events: list[ApplicationEventResponse] = Field(default_factory=list)
    confirmation: ApplicationConfirmationResponse | None = None
    pending_action_requests: list[ActionRequestResponse] = Field(default_factory=list)


# ── Paginated event list ──────────────────────────────────────────────────────

class EventListResponse(_Base):
    application_id: uuid.UUID
    events: list[ApplicationEventResponse]
    total: int
    has_more: bool
    next_cursor: str | None


# ── SSE / WebSocket payloads ──────────────────────────────────────────────────

class StatusUpdateEvent(_Base):
    """Emitted over SSE whenever application status changes."""

    event: str = "status_update"
    application_id: str
    status: str
    execution_status: str | None
    user_message: str | None
    progress_percent: int
    requires_action: bool
    confirmation_present: bool
    ts: str  # ISO 8601


class LogStreamEvent(_Base):
    """Emitted over SSE for each new event log entry."""

    event: str = "log"
    application_id: str
    event_type: str
    level: str
    summary: str
    data: dict[str, Any]
    ts: str


class ConfirmationReadyEvent(_Base):
    """Emitted over SSE when the engine is waiting for user confirmation."""

    event: str = "confirmation_ready"
    application_id: str
    screenshot_b64: str | None
    ts: str


# ── User application listing ──────────────────────────────────────────────────

class UserApplicationsResponse(_Base):
    user_id: uuid.UUID
    applications: list[ApplicationResponse]
    total: int


# ── Internal: worker submission payload ──────────────────────────────────────

class WorkerSubmitPayload(_Base):
    """Passed from service to Celery worker."""

    application_id: str
    user_id: str
    job_url: str
    attempt_number: int
    request_payload: dict[str, Any]
    supabase_url: str
    supabase_key: str
