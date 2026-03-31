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
    url = job["url"].rstrip("/")
    portal = job.get("portal")
    return {
        "company": job["company"],
        "title": job["title"],
        "level": job["level"],
        "location": job["location"],
        "url": url,
        "application_url": job.get("application_url", url).rstrip("/"),
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
            client.table("jobs").upsert(batch, on_conflict="url").execute()
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
