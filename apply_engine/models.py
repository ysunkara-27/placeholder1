from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

PortalType = Literal["greenhouse", "lever", "workday", "handshake", "vision"]
ActionType = Literal["fill", "click", "select", "upload", "check", "uncheck"]
ApplyStatus = Literal["applied", "requires_auth", "failed", "unsupported"]


@dataclass(slots=True)
class ApplicantProfile:
    first_name: str
    last_name: str
    email: str
    phone: str = ""
    linkedin: str = ""
    website: str = ""
    resume_pdf_path: str = ""
    sponsorship_required: bool = False
    work_authorization: str = ""
    start_date: str = ""
    location_preference: str = ""
    salary_expectation: str = ""
    onsite_preference: str = ""
    weekly_availability_hours: str = ""
    graduation_window: str = ""
    commute_preference: str = ""
    custom_answers: dict[str, str] = field(default_factory=dict)


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


@dataclass(slots=True)
class ApplyResult:
    portal: PortalType
    status: ApplyStatus
    confirmation_snippet: str = ""
    actions: list[PlannedAction] = field(default_factory=list)
    error: str = ""
    screenshots: list[CapturedScreenshot] = field(default_factory=list)
