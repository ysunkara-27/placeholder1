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
from datetime import datetime, timezone
from typing import Any
from scraper.sources.common import canonicalize_url, infer_level

VALID_PORTALS = {
    "greenhouse", "lever", "workday", "handshake", "linkedin",
    "indeed", "icims", "smartrecruiters", "company_website", "other",
}

BATCH_SIZE = 50


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
        "url": url,
        "application_url": application_url,
        "canonical_url": url,
        "canonical_application_url": application_url,
        "remote": job.get("remote", False),
        "industries": job.get("industries", []),
        "portal": portal if portal in VALID_PORTALS else "company_website",
        "posted_at": job.get("posted_at", datetime.now(timezone.utc).isoformat()),
        "status": "active",
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
