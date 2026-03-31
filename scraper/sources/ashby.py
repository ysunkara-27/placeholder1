"""Ashby source adapter.

Fetches job listings from the Ashby public Jobs API:
    GET https://api.ashbyhq.com/posting-api/job-board/{slug}

Ashby is used by OpenAI, Harvey, Suno, Replit, and ~18 other companies
in our source list.
"""
from __future__ import annotations

from typing import Any

from scraper.sources.base import BaseSource, ScrapeResult, SourceConfig
from scraper.sources.common import (
    canonicalize_url,
    infer_industries,
    infer_level,
    is_early_career,
    now_iso,
)


class AshbySource(BaseSource):
    portal = "ashby"

    def scrape(self, config: SourceConfig, http_client: Any) -> ScrapeResult:
        # Derive slug from the board_url or board_token
        slug = config.board_token or config.board_url.rstrip("/").split("/")[-1]
        api_url = f"https://api.ashbyhq.com/posting-api/job-board/{slug}"

        try:
            resp = http_client.get(api_url, timeout=15)
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            return ScrapeResult(
                source_id=config.id,
                company=config.company,
                portal=self.portal,
                fetched=0,
                emitted=0,
                filtered_out=0,
                jobs=[],
                errors=[str(exc)],
            )

        postings: list[dict] = data.get("jobPostings", [])
        fetched = len(postings)
        jobs: list[dict] = []

        for posting in postings:
            title: str = posting.get("title", "")
            if not is_early_career(title):
                continue

            # Prefer jobUrl, fall back to constructing from slug + id
            job_url: str = posting.get("jobUrl") or posting.get("applyUrl") or ""
            if not job_url.startswith("http"):
                posting_id = posting.get("id", "")
                job_url = f"https://jobs.ashbyhq.com/{slug}/{posting_id}"

            location: str = (
                posting.get("locationName")
                or (posting.get("location") or {}).get("locationName")
                or config.default_location
                or "Unknown"
            )

            jobs.append({
                "company": config.company,
                "title": title,
                "level": infer_level(title),
                "location": location,
                "url": canonicalize_url(job_url),
                "application_url": canonicalize_url(job_url),
                "remote": posting.get("isRemote", False),
                "industries": infer_industries(
                    title, "", config.notes, config.default_industries
                ),
                "portal": "ashby",
                "posted_at": posting.get("publishedDate") or now_iso(),
                "tags": ["source:ashby"],
                "source": "ashby_api",
            })

        return ScrapeResult(
            source_id=config.id,
            company=config.company,
            portal=self.portal,
            fetched=fetched,
            emitted=len(jobs),
            filtered_out=fetched - len(jobs),
            jobs=jobs,
        )
