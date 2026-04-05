from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Literal

if TYPE_CHECKING:
    from apply_engine.event_emitter import SupabaseEventEmitter

PortalType = Literal["greenhouse", "lever", "workday", "ashby", "icims", "handshake", "vision"]
ActionType = Literal["fill", "click", "select", "upload", "check", "uncheck"]
ApplyStatus = Literal["applied", "requires_auth", "failed", "unsupported"]
BlockedFieldFamily = Literal[
    "contact",
    "resume",
    "authorization",
    "education",
    "availability",
    "eeo",
    "custom",
    "unknown",
]


@dataclass(slots=True)
class ApplicantProfile:
    first_name: str
    last_name: str
    email: str
    phone: str = ""
    linkedin_url: str = ""
    website_url: str = ""
    github_url: str = ""
    linkedin: str = ""
    website: str = ""
    resume_pdf_path: str = ""
    authorized_to_work: bool = False
    earliest_start_date: str = ""
    sponsorship_required: bool = False
    work_authorization: str = ""
    start_date: str = ""
    location_preference: str = ""
    location_preferences: list[str] = field(default_factory=list)
    job_location_options: list[str] = field(default_factory=list)
    salary_expectation: str = ""
    onsite_preference: str = ""
    weekly_availability_hours: str = ""
    graduation_window: str = ""
    commute_preference: str = ""
    city: str = ""
    state_region: str = ""
    country: str = "United States"
    github: str = ""
    school: str = ""
    major: str = ""
    gpa: str = ""
    graduation: str = ""
    visa_type: str = ""
    eeo: dict[str, str] = field(default_factory=dict)
    resume_text: str = ""
    custom_answers: dict[str, str] = field(default_factory=dict)
    portal_accounts: dict[str, dict[str, str]] = field(default_factory=dict)


@dataclass(slots=True)
class PlannedAction:
    action: ActionType
    selector: str
    value: str = ""
    required: bool = True


@dataclass(slots=True)
class CapturedScreenshot:
    label: str
    mime_type: str = "image/png"
    data_base64: str = ""


@dataclass(slots=True)
class ApplyRequest:
    url: str
    profile: ApplicantProfile
    dry_run: bool = False
    runtime_hints: dict[str, object] = field(default_factory=dict)
    application_id: str = ""
    emitter: Any = None  # SupabaseEventEmitter | None


@dataclass(slots=True)
class ApplyResult:
    portal: PortalType
    status: ApplyStatus
    confirmation_snippet: str = ""
    actions: list[PlannedAction] = field(default_factory=list)
    error: str = ""
    screenshots: list[CapturedScreenshot] = field(default_factory=list)
    inferred_answers: list[str] = field(default_factory=list)
    unresolved_questions: list[str] = field(default_factory=list)
    recovery_attempted: bool = False
    recovery_family: BlockedFieldFamily | None = None
