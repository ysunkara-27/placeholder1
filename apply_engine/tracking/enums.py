"""
Status and event enums for the application tracking layer.

Two status axes are maintained throughout the apply pipeline:

  ExecutionStatus  — granular internal state used by the worker and service
                     layer.  Never shown directly to users.

  UserFacingStatus — simplified, product-language status surfaced in the
                     dashboard and notifications.

The mapping from execution → user-facing is centralised in
`execution_to_user_status()` below.
"""

from __future__ import annotations

from enum import Enum


# ── Internal execution status ─────────────────────────────────────────────────

class ExecutionStatus(str, Enum):
    """Granular worker-side state for an application run."""

    CREATED               = "CREATED"
    QUEUED                = "QUEUED"
    STARTING              = "STARTING"
    AUTHENTICATING        = "AUTHENTICATING"
    LOADING_FORM          = "LOADING_FORM"
    PARSING_FORM          = "PARSING_FORM"
    FILLING_FIELDS        = "FILLING_FIELDS"
    UPLOADING_FILES       = "UPLOADING_FILES"
    REVIEWING             = "REVIEWING"
    SUBMITTING            = "SUBMITTING"
    VERIFYING_CONFIRMATION = "VERIFYING_CONFIRMATION"
    COMPLETED             = "COMPLETED"
    FAILED                = "FAILED"
    RETRY_SCHEDULED       = "RETRY_SCHEDULED"
    REQUIRES_ACTION       = "REQUIRES_ACTION"


# ── User-facing status ────────────────────────────────────────────────────────

class UserFacingStatus(str, Enum):
    """Simplified status shown in the dashboard and notifications."""

    QUEUED        = "queued"
    APPLYING      = "applying"
    NEEDS_INPUT   = "needs your input"
    SUBMITTED     = "submitted"
    FAILED        = "failed"
    ALREADY_APPLIED = "already applied"


# ── DB-level status (matches Supabase check constraint) ──────────────────────

class DbStatus(str, Enum):
    """Values written to applications.status — must match check constraint."""

    QUEUED                = "queued"
    RUNNING               = "running"
    AWAITING_CONFIRMATION = "awaiting_confirmation"
    CONFIRMED             = "confirmed"
    CANCELLED             = "cancelled"
    CONFIRMATION_TIMEOUT  = "confirmation_timeout"
    REQUIRES_AUTH         = "requires_auth"
    APPLIED               = "applied"
    FAILED                = "failed"


# ── Confirmation types ────────────────────────────────────────────────────────

class ConfirmationType(str, Enum):
    TEXT_SNIPPET        = "text_snippet"
    APPLICATION_ID      = "application_id"
    EMAIL_CONFIRMATION  = "email_confirmation"
    SCREENSHOT          = "screenshot"
    REDIRECT_URL        = "redirect_url"


# ── Action request types ──────────────────────────────────────────────────────

class ActionType(str, Enum):
    QUESTION = "question"
    CAPTCHA  = "captcha"
    AUTH     = "auth"
    REVIEW   = "review"


# ── Event log levels ──────────────────────────────────────────────────────────

class EventLevel(str, Enum):
    INFO         = "info"
    WARN         = "warn"
    ERROR        = "error"
    SUCCESS      = "success"
    CONFIRMATION = "confirmation"


# ── Status mapping ────────────────────────────────────────────────────────────

_EXECUTION_TO_USER: dict[ExecutionStatus, UserFacingStatus] = {
    ExecutionStatus.CREATED:                UserFacingStatus.QUEUED,
    ExecutionStatus.QUEUED:                 UserFacingStatus.QUEUED,
    ExecutionStatus.STARTING:               UserFacingStatus.APPLYING,
    ExecutionStatus.AUTHENTICATING:         UserFacingStatus.APPLYING,
    ExecutionStatus.LOADING_FORM:           UserFacingStatus.APPLYING,
    ExecutionStatus.PARSING_FORM:           UserFacingStatus.APPLYING,
    ExecutionStatus.FILLING_FIELDS:         UserFacingStatus.APPLYING,
    ExecutionStatus.UPLOADING_FILES:        UserFacingStatus.APPLYING,
    ExecutionStatus.REVIEWING:              UserFacingStatus.APPLYING,
    ExecutionStatus.SUBMITTING:             UserFacingStatus.APPLYING,
    ExecutionStatus.VERIFYING_CONFIRMATION: UserFacingStatus.APPLYING,
    ExecutionStatus.COMPLETED:              UserFacingStatus.SUBMITTED,
    ExecutionStatus.FAILED:                 UserFacingStatus.FAILED,
    ExecutionStatus.RETRY_SCHEDULED:        UserFacingStatus.QUEUED,
    ExecutionStatus.REQUIRES_ACTION:        UserFacingStatus.NEEDS_INPUT,
}

_EXECUTION_TO_PROGRESS: dict[ExecutionStatus, int] = {
    ExecutionStatus.CREATED:                0,
    ExecutionStatus.QUEUED:                 5,
    ExecutionStatus.STARTING:              10,
    ExecutionStatus.AUTHENTICATING:        20,
    ExecutionStatus.LOADING_FORM:          30,
    ExecutionStatus.PARSING_FORM:          40,
    ExecutionStatus.FILLING_FIELDS:        55,
    ExecutionStatus.UPLOADING_FILES:       65,
    ExecutionStatus.REVIEWING:             75,
    ExecutionStatus.SUBMITTING:            85,
    ExecutionStatus.VERIFYING_CONFIRMATION: 95,
    ExecutionStatus.COMPLETED:            100,
    ExecutionStatus.FAILED:                 0,
    ExecutionStatus.RETRY_SCHEDULED:        5,
    ExecutionStatus.REQUIRES_ACTION:       75,
}

_EXECUTION_TO_USER_MESSAGE: dict[ExecutionStatus, str] = {
    ExecutionStatus.CREATED:                "Application created — waiting to start",
    ExecutionStatus.QUEUED:                 "In the queue — starting soon",
    ExecutionStatus.STARTING:              "Opening the application form",
    ExecutionStatus.AUTHENTICATING:        "Logging in to the portal",
    ExecutionStatus.LOADING_FORM:          "Loading the application form",
    ExecutionStatus.PARSING_FORM:          "Reading the form fields",
    ExecutionStatus.FILLING_FIELDS:        "Filling in your details",
    ExecutionStatus.UPLOADING_FILES:       "Uploading your resume",
    ExecutionStatus.REVIEWING:             "Reviewing your answers",
    ExecutionStatus.SUBMITTING:            "Submitting your application",
    ExecutionStatus.VERIFYING_CONFIRMATION: "Confirming submission",
    ExecutionStatus.COMPLETED:             "Application submitted successfully",
    ExecutionStatus.FAILED:                "Application failed — see details below",
    ExecutionStatus.RETRY_SCHEDULED:       "Scheduled for retry",
    ExecutionStatus.REQUIRES_ACTION:       "Action required — please respond below",
}


def execution_to_user_status(status: ExecutionStatus) -> UserFacingStatus:
    return _EXECUTION_TO_USER.get(status, UserFacingStatus.APPLYING)


def execution_to_progress(status: ExecutionStatus) -> int:
    return _EXECUTION_TO_PROGRESS.get(status, 50)


def execution_to_user_message(status: ExecutionStatus) -> str:
    return _EXECUTION_TO_USER_MESSAGE.get(status, "Processing")
