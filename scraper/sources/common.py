"""Shared normalization and filtering logic for source adapters."""
from __future__ import annotations

INCLUDE_KEYWORDS = [
    "intern",
    "internship",
    "new grad",
    "new-grad",
    "co-op",
    "coop",
    "university",
    "campus",
    "early career",
    "entry level",
    "entry-level",
    "graduate",
]

EXCLUDE_KEYWORDS = [
    "senior",
    "staff",
    "principal",
    "manager",
    "director",
    "vp ",
    "vice president",
    "lead ",
    " lead",
    "head of",
    "architect",
]


def is_early_career(title: str, commitment: str = "") -> bool:
    """Return True if the role looks like internship/new-grad/co-op/entry-level."""
    text = f"{title} {commitment}".lower()
    has_include = any(kw in text for kw in INCLUDE_KEYWORDS)
    has_exclude = any(kw in text for kw in EXCLUDE_KEYWORDS)
    return has_include and not has_exclude


def infer_level(title: str, commitment: str = "") -> str:
    """Map a job title + commitment to one of: internship, new_grad, co_op, part_time, associate."""
    text = f"{title} {commitment}".lower()
    if "co-op" in text or "coop" in text:
        return "co_op"
    if "new grad" in text or "new-grad" in text or "university grad" in text:
        return "new_grad"
    if "associate" in text:
        return "associate"
    if "part time" in text or "part-time" in text:
        return "part_time"
    return "internship"


def infer_industries(
    title: str,
    team: str = "",
    notes: str = "",
    defaults: list[str] | None = None,
) -> list[str]:
    """Infer industry tags from title + team + notes. Falls back to defaults."""
    text = f"{title} {team} {notes}".lower()
    industries: list[str] = []

    if any(
        kw in text
        for kw in (
            "software",
            "engineer",
            "developer",
            "frontend",
            "backend",
            "fullstack",
            "swe",
            "infrastructure",
            "platform",
            "mobile",
            "ios",
            "android",
        )
    ):
        industries.append("SWE")

    if any(kw in text for kw in ("data", "ml", "machine learning", "analytics", "bi ")):
        industries.append("Data")

    if "research" in text or "scientist" in text:
        industries.append("Research")

    if any(kw in text for kw in ("product manager", "product management", " pm ")):
        industries.append("PM")

    if "design" in text or "ux" in text or "ui " in text:
        industries.append("Design")

    if any(kw in text for kw in ("finance", "fintech", "payment", "quant", "trading")):
        industries.append("Finance")

    if any(kw in text for kw in ("marketing", "growth", "content", "brand")):
        industries.append("Marketing")

    if any(kw in text for kw in ("operations", "ops", "supply chain", "logistics")):
        industries.append("Operations")

    if defaults and not industries:
        return list(defaults)

    return industries or ["SWE"]


def infer_remote(location: str) -> bool:
    loc = location.lower()
    return any(kw in loc for kw in ("remote", "anywhere", "distributed", "work from home"))


def canonicalize_url(url: str) -> str:
    """Strip trailing slash and fragment."""
    from urllib.parse import urlparse, urlunparse

    parsed = urlparse(url)
    path = parsed.path.rstrip("/") or "/"
    cleaned = parsed._replace(fragment="", path=path)
    return urlunparse(cleaned)


def dedupe_by_url(jobs: list[dict]) -> list[dict]:
    """Collapse jobs with the same canonical URL."""
    seen: set[str] = set()
    out: list[dict] = []
    for job in jobs:
        key = canonicalize_url(job.get("url", ""))
        if key not in seen:
            seen.add(key)
            out.append(job)
    return out


def now_iso() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()
