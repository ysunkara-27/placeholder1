from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from apply_engine.models import ActionType, ApplyStatus, PortalType


class SchemaValidationError(ValueError):
    pass


def _expect_dict(value: Any, field_name: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise SchemaValidationError(f"{field_name} must be an object")
    return value


def _expect_str(value: Any, field_name: str, *, default: str | None = None) -> str:
    if value is None and default is not None:
        return default
    if not isinstance(value, str):
        raise SchemaValidationError(f"{field_name} must be a string")
    return value.strip()


def _expect_bool(value: Any, field_name: str, *, default: bool | None = None) -> bool:
    if value is None and default is not None:
        return default
    if not isinstance(value, bool):
        raise SchemaValidationError(f"{field_name} must be a boolean")
    return value


def _expect_str_dict(
    value: Any,
    field_name: str,
    *,
    default: dict[str, str] | None = None,
) -> dict[str, str]:
    if value is None and default is not None:
        return default
    if not isinstance(value, dict):
        raise SchemaValidationError(f"{field_name} must be an object")

    parsed: dict[str, str] = {}
    for key, item in value.items():
        if not isinstance(key, str) or not isinstance(item, str):
            raise SchemaValidationError(f"{field_name} must only contain string keys and values")
        parsed[key.strip()] = item.strip()

    return parsed


@dataclass(slots=True)
class ApplicantProfilePayload:
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
    custom_answers: dict[str, str] | None = None

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "ApplicantProfilePayload":
      allowed = {
          "first_name",
          "last_name",
          "email",
          "phone",
          "linkedin",
          "website",
          "resume_pdf_path",
          "sponsorship_required",
          "work_authorization",
          "start_date",
          "location_preference",
          "salary_expectation",
          "onsite_preference",
          "weekly_availability_hours",
          "graduation_window",
          "commute_preference",
          "custom_answers",
      }
      extra = set(payload.keys()) - allowed
      if extra:
          raise SchemaValidationError(f"Unexpected profile fields: {sorted(extra)}")

      return cls(
          first_name=_expect_str(payload.get("first_name"), "profile.first_name"),
          last_name=_expect_str(payload.get("last_name"), "profile.last_name"),
          email=_expect_str(payload.get("email"), "profile.email"),
          phone=_expect_str(payload.get("phone"), "profile.phone", default=""),
          linkedin=_expect_str(payload.get("linkedin"), "profile.linkedin", default=""),
          website=_expect_str(payload.get("website"), "profile.website", default=""),
          resume_pdf_path=_expect_str(
              payload.get("resume_pdf_path"),
              "profile.resume_pdf_path",
              default="",
          ),
          sponsorship_required=_expect_bool(
              payload.get("sponsorship_required"),
              "profile.sponsorship_required",
              default=False,
          ),
          work_authorization=_expect_str(
              payload.get("work_authorization"),
              "profile.work_authorization",
              default="",
          ),
          start_date=_expect_str(
              payload.get("start_date"),
              "profile.start_date",
              default="",
          ),
          location_preference=_expect_str(
              payload.get("location_preference"),
              "profile.location_preference",
              default="",
          ),
          salary_expectation=_expect_str(
              payload.get("salary_expectation"),
              "profile.salary_expectation",
              default="",
          ),
          onsite_preference=_expect_str(
              payload.get("onsite_preference"),
              "profile.onsite_preference",
              default="",
          ),
          weekly_availability_hours=_expect_str(
              payload.get("weekly_availability_hours"),
              "profile.weekly_availability_hours",
              default="",
          ),
          graduation_window=_expect_str(
              payload.get("graduation_window"),
              "profile.graduation_window",
              default="",
          ),
          commute_preference=_expect_str(
              payload.get("commute_preference"),
              "profile.commute_preference",
              default="",
          ),
          custom_answers=_expect_str_dict(
              payload.get("custom_answers"),
              "profile.custom_answers",
              default={},
          ),
      )

    def to_dict(self) -> dict[str, Any]:
        return {
            "first_name": self.first_name,
            "last_name": self.last_name,
            "email": self.email,
            "phone": self.phone,
            "linkedin": self.linkedin,
            "website": self.website,
            "resume_pdf_path": self.resume_pdf_path,
            "sponsorship_required": self.sponsorship_required,
            "work_authorization": self.work_authorization,
            "start_date": self.start_date,
            "location_preference": self.location_preference,
            "salary_expectation": self.salary_expectation,
            "onsite_preference": self.onsite_preference,
            "weekly_availability_hours": self.weekly_availability_hours,
            "graduation_window": self.graduation_window,
            "commute_preference": self.commute_preference,
            "custom_answers": self.custom_answers or {},
        }


@dataclass(slots=True)
class ApplyPayload:
    url: str
    profile: ApplicantProfilePayload
    dry_run: bool = True

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "ApplyPayload":
        allowed = {"url", "profile", "dry_run"}
        extra = set(payload.keys()) - allowed
        if extra:
            raise SchemaValidationError(f"Unexpected apply payload fields: {sorted(extra)}")

        return cls(
            url=_expect_str(payload.get("url"), "url"),
            profile=ApplicantProfilePayload.from_dict(
                _expect_dict(payload.get("profile"), "profile")
            ),
            dry_run=_expect_bool(payload.get("dry_run"), "dry_run", default=True),
        )


@dataclass(slots=True)
class PlannedActionPayload:
    action: ActionType
    selector: str
    value: str = ""
    required: bool = True


@dataclass(slots=True)
class CapturedScreenshotPayload:
    label: str
    mime_type: str = "image/png"
    data_base64: str = ""


@dataclass(slots=True)
class ApplyResultPayload:
    portal: PortalType
    status: ApplyStatus
    confirmation_snippet: str = ""
    actions: list[PlannedActionPayload] | None = None
    error: str = ""
    screenshots: list[CapturedScreenshotPayload] | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "portal": self.portal,
            "status": self.status,
            "confirmation_snippet": self.confirmation_snippet,
            "actions": [
                {
                    "action": action.action,
                    "selector": action.selector,
                    "value": action.value,
                    "required": action.required,
                }
                for action in (self.actions or [])
            ],
            "error": self.error,
            "screenshots": [
                {
                    "label": screenshot.label,
                    "mime_type": screenshot.mime_type,
                    "data_base64": screenshot.data_base64,
                }
                for screenshot in (self.screenshots or [])
            ],
        }
