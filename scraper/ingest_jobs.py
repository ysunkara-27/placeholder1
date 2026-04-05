"""
ingest_jobs.py — Push scraped jobs directly to Supabase.

Uses the Supabase service role key to upsert jobs into the jobs table,
deduplicating by URL. Skips the Next.js API route entirely.

Env vars required:
    SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL
                           — https://xxxx.supabase.co
    SUPABASE_SERVICE_ROLE_KEY — service_role JWT from Supabase project settings
"""
from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from typing import Any
from scraper.sources.common import canonicalize_url, infer_level

VALID_PORTALS = {
    "greenhouse", "lever", "workday", "handshake", "linkedin",
    "indeed", "icims", "smartrecruiters", "company_website", "other",
}

BATCH_SIZE = 50


def _normalize_slug(raw: str) -> str:
    return "_".join(part for part in "".join(ch.lower() if ch.isalnum() else " " for ch in raw).split() if part)


def _infer_work_modality(location: str, remote: bool, summary: str) -> tuple[str, str]:
    if remote:
        return "remote", "high"
    text = f"{location} {summary}".lower()
    if "hybrid" in text:
        return "hybrid", "medium"
    if "onsite" in text or "on-site" in text or "in office" in text:
        return "onsite", "medium"
    return "unknown", "low"


def _split_location_options(location: str) -> list[str]:
    if not location:
        return []
    out: list[str] = []
    for part in re.split(r"\s*(?:\||;|\n|/)\s*", location):
        for inner in re.split(r"\s+\bor\b\s+", part, flags=re.IGNORECASE):
            candidate = inner.strip()
            if candidate and candidate not in out:
                out.append(candidate)
    return out


def _geo_node_slugs(location: str) -> list[str]:
    slugs: list[str] = []
    city_map = {
        "san francisco": "geo.usa.west.california.san_francisco_bay_area",
        "bay area": "geo.usa.west.california.san_francisco_bay_area",
        "los angeles": "geo.usa.west.california.los_angeles",
        "san diego": "geo.usa.west.california.san_diego",
        "seattle": "geo.usa.west.washington.seattle",
        "denver": "geo.usa.west.colorado.denver",
        "new york city": "geo.usa.northeast.new_york.new_york_city",
        "nyc": "geo.usa.northeast.new_york.new_york_city",
        "boston": "geo.usa.northeast.massachusetts.boston",
        "pittsburgh": "geo.usa.northeast.pennsylvania.pittsburgh",
        "austin": "geo.usa.south.texas.austin",
        "dallas": "geo.usa.south.texas.dallas",
        "houston": "geo.usa.south.texas.houston",
        "atlanta": "geo.usa.south.georgia.atlanta",
        "miami": "geo.usa.south.florida.miami",
        "raleigh": "geo.usa.south.north_carolina.raleigh",
        "chicago": "geo.usa.midwest.illinois.chicago",
        "detroit": "geo.usa.midwest.michigan.detroit",
        "columbus": "geo.usa.midwest.ohio.columbus",
        "toronto": "geo.canada.ontario.toronto",
    }
    state_map = {
        "ab": "geo.canada.alberta",
        "alberta": "geo.canada.alberta",
        "bc": "geo.canada.british_columbia",
        "british columbia": "geo.canada.british_columbia",
        "mb": "geo.canada.manitoba",
        "manitoba": "geo.canada.manitoba",
        "nb": "geo.canada.new_brunswick",
        "new brunswick": "geo.canada.new_brunswick",
        "nl": "geo.canada.newfoundland_and_labrador",
        "newfoundland and labrador": "geo.canada.newfoundland_and_labrador",
        "ns": "geo.canada.nova_scotia",
        "nova scotia": "geo.canada.nova_scotia",
        "nt": "geo.canada.northwest_territories",
        "northwest territories": "geo.canada.northwest_territories",
        "nu": "geo.canada.nunavut",
        "nunavut": "geo.canada.nunavut",
        "on": "geo.canada.ontario",
        "ontario": "geo.canada.ontario",
        "pe": "geo.canada.prince_edward_island",
        "pei": "geo.canada.prince_edward_island",
        "prince edward island": "geo.canada.prince_edward_island",
        "qc": "geo.canada.quebec",
        "quebec": "geo.canada.quebec",
        "sk": "geo.canada.saskatchewan",
        "saskatchewan": "geo.canada.saskatchewan",
        "yk": "geo.canada.yukon",
        "yukon": "geo.canada.yukon",
    }
    for option in (_split_location_options(location) or [location]):
        text = option.lower()
        for match, slug in city_map.items():
            if match in text:
                slugs.append(slug)
        for match, slug in state_map.items():
            if re.search(rf"(^|[\s,\-]){re.escape(match)}($|[\s,])", text, re.IGNORECASE):
                slugs.append(slug)
        slugs.append("geo.canada" if "canada" in text else "geo.usa")
    return list(dict.fromkeys(slugs))


def _build_taxonomy_summary(company: str, title: str, location: str, summary: str, role_family: str, target_term: str | None, remote: bool, industries: list[str]) -> dict[str, Any]:
    work_modality, modality_confidence = _infer_work_modality(location, remote, summary)
    career = []
    if role_family == "co_op":
        career = ["career_role.student.co_op", "employment_type.temporary.co_op"]
    elif role_family == "new_grad":
        career = ["career_role.early_career.new_grad", "employment_type.permanent.full_time"]
    elif role_family == "associate":
        career = ["career_role.early_career.associate", "employment_type.permanent.full_time"]
    elif role_family == "part_time":
        career = ["career_role.student.part_time_student", "employment_type.permanent.part_time"]
    else:
        career = ["career_role.student.internship", "employment_type.temporary.internship"]
    if target_term in {"spring", "summer", "fall", "winter"}:
        career.append(f"career_role.student.internship.{target_term}")
    legacy_industries = list(dict.fromkeys(industries or ["SWE"]))
    return {
        "version": "taxonomy-mvp-v1",
        "company_slug": _normalize_slug(company),
        "industry_node_slugs": [f"legacy.{_normalize_slug(value)}" for value in legacy_industries],
        "job_function_node_slugs": [],
        "career_node_slugs": [value for value in career if value.startswith("career_role.")],
        "geo_node_slugs": _geo_node_slugs(location),
        "location_options_text": _split_location_options(location),
        "employment_type_node_slugs": [value for value in career if value.startswith("employment_type.")],
        "work_modality": work_modality,
        "work_modality_confidence": modality_confidence,
    }


def resolve_supabase_url(supabase_url: str | None = None) -> str:
    return (
        supabase_url
        or os.environ.get("SUPABASE_URL", "")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
    )


def _make_row(job: dict) -> dict:
    url = canonicalize_url(job["url"])
    application_url = canonicalize_url(job.get("application_url", url))
    title = job["title"]
    summary = job.get("jd_summary", "")
    level = job.get("level") or infer_level(title, summary)
    normalized = f"{title} {summary}".lower()
    if "co-op" in normalized or "coop" in normalized:
        role_family = "co_op"
    elif "new grad" in normalized or "new-grad" in normalized or "fresh grad" in normalized:
        role_family = "new_grad"
    elif "associate" in normalized:
        role_family = "associate"
    elif "part time" in normalized or "part-time" in normalized:
        role_family = "part_time"
    else:
        role_family = "internship"

    target_term = None
    if "spring" in normalized:
        target_term = "spring"
    elif "summer" in normalized:
        target_term = "summer"
    elif "fall" in normalized or "autumn" in normalized:
        target_term = "fall"
    elif "winter" in normalized:
        target_term = "winter"

    target_year = None
    for token in normalized.replace("/", " ").split():
        if token.isdigit() and len(token) == 4 and token.startswith("20"):
            target_year = int(token)
            break

    portal = job.get("portal")
    remote = job.get("remote", False)
    work_modality, work_modality_confidence = _infer_work_modality(job["location"], remote, summary)
    taxonomy_summary = _build_taxonomy_summary(
        job["company"],
        title,
        job["location"],
        summary,
        role_family,
        target_term,
        remote,
        job.get("industries", []),
    )
    return {
        "company": job["company"],
        "title": title,
        "level": level,
        "role_family": role_family,
        "target_term": target_term,
        "target_year": target_year,
        "experience_band": "early_career" if role_family == "associate" else ("new_grad" if role_family == "new_grad" else "student"),
        "is_early_career": True,
        "location": job["location"],
        "locations_text": _split_location_options(job["location"]),
        "url": url,
        "application_url": application_url,
        "canonical_url": url,
        "canonical_application_url": application_url,
        "remote": remote,
        "work_modality": work_modality,
        "work_modality_confidence": work_modality_confidence,
        "industries": job.get("industries", []),
        "job_geo_node_ids": [],
        "job_industry_node_ids": [],
        "job_function_node_ids": [],
        "job_career_node_ids": [],
        "job_degree_requirement_node_ids": [],
        "job_education_field_node_ids": [],
        "job_work_auth_node_ids": [],
        "job_employment_type_node_ids": [],
        "job_taxonomy_summary": taxonomy_summary,
        "taxonomy_resolution_version": taxonomy_summary["version"],
        "taxonomy_needs_review": True,
        "portal": portal if portal in VALID_PORTALS else "company_website",
        "posted_at": job.get("posted_at", datetime.now(timezone.utc).isoformat()),
        "status": "pending",
        "metadata": {
            "tags": job.get("tags", []),
            "source": job.get("source", "scraper"),
            "ingested_via": "python_direct",
        },
    }


def ingest_to_supabase(
    scraped_jobs: list[dict],
    supabase_url: str | None = None,
    service_role_key: str | None = None,
) -> dict[str, int]:
    """
    Upsert scraped_jobs into Supabase jobs table.
    Returns {"ok": N, "failed": N}.
    """
    from supabase import create_client  # type: ignore

    url = resolve_supabase_url(supabase_url)
    key = service_role_key or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set "
            "(env vars or passed directly)"
        )

    client = create_client(url, key)

    # Dedupe by URL
    seen: dict[str, dict] = {}
    for job in scraped_jobs:
        row = _make_row(job)
        seen[row["url"]] = row
    rows = list(seen.values())

    print(f"Launching ingestion of {len(rows)} jobs → Supabase")

    ok = failed = 0
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i : i + BATCH_SIZE]
        try:
            client.table("jobs").upsert(batch, on_conflict="canonical_url").execute()
            ok += len(batch)
        except Exception as exc:  # noqa: BLE001
            failed += len(batch)
            print(f"  [ERROR] batch {i // BATCH_SIZE + 1}: {exc}")

    return {"ok": ok, "failed": failed}


async def process_batch(
    scraped_jobs: list[dict],
    base_url: str = "",
    worker_secret: str = "",
    concurrency: int = 20,
    supabase_url: str | None = None,
    service_role_key: str | None = None,
) -> list[dict[str, Any]]:
    """Called by run_scrape.py after scraping completes."""
    stats = ingest_to_supabase(
        scraped_jobs,
        supabase_url=supabase_url,
        service_role_key=service_role_key,
    )
    return [{"status": "success"}] * stats["ok"] + [{"status": "error"}] * stats["failed"]
