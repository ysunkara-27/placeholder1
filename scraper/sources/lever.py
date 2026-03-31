"""Lever source adapter.

Fetches job listings from the public Lever postings API:
  GET https://api.lever.co/v0/postings/{board_token}?mode=json
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import httpx

from scraper.sources.base import BaseSource, ScrapeResult, SourceConfig
from scraper.sources.common import (
    canonicalize_url,
    dedupe_by_url,
    infer_industries,
    infer_level,
    infer_remote,
    is_early_career,
    now_iso,
)

logger = logging.getLogger(__name__)


class LeverSource(BaseSource):
    portal = "lever"

    def _api_url(self, config: SourceConfig) -> str:
        if config.board_token:
            return f"https://api.lever.co/v0/postings/{config.board_token}"

        return config.board_url.split("?", 1)[0].rstrip("/")

    def scrape(self, config: SourceConfig, http_client: Any) -> ScrapeResult:
        fetched = 0
        emitted = 0
        filtered_out = 0
        jobs: list[dict] = []
        warnings: list[str] = []
        errors: list[str] = []

        try:
            response = http_client.get(
                f"{self._api_url(config)}?mode=json",
                timeout=15,
            )
        except httpx.TimeoutException as exc:
            errors.append(f"Timeout fetching {config.id}: {exc}")
            return ScrapeResult(
                source_id=config.id,
                company=config.company,
                portal=self.portal,
                fetched=0,
                emitted=0,
                filtered_out=0,
                jobs=[],
                warnings=warnings,
                errors=errors,
            )
        except Exception as exc:  # noqa: BLE001
            errors.append(f"Request error fetching {config.id}: {exc}")
            return ScrapeResult(
                source_id=config.id,
                company=config.company,
                portal=self.portal,
                fetched=0,
                emitted=0,
                filtered_out=0,
                jobs=[],
                warnings=warnings,
                errors=errors,
            )

        if response.status_code != 200:
            errors.append(
                f"HTTP {response.status_code} fetching {config.id}: {self._api_url(config)}"
            )
            return ScrapeResult(
                source_id=config.id,
                company=config.company,
                portal=self.portal,
                fetched=0,
                emitted=0,
                filtered_out=0,
                jobs=[],
                warnings=warnings,
                errors=errors,
            )

        try:
            raw_jobs = response.json()
        except Exception as exc:  # noqa: BLE001
            errors.append(f"Failed to parse JSON for {config.id}: {exc}")
            return ScrapeResult(
                source_id=config.id,
                company=config.company,
                portal=self.portal,
                fetched=0,
                emitted=0,
                filtered_out=0,
                jobs=[],
                warnings=warnings,
                errors=errors,
            )

        if not isinstance(raw_jobs, list):
            errors.append(f"Unexpected response shape for {config.id}: expected JSON array")
            return ScrapeResult(
                source_id=config.id,
                company=config.company,
                portal=self.portal,
                fetched=0,
                emitted=0,
                filtered_out=0,
                jobs=[],
                warnings=warnings,
                errors=errors,
            )

        fetched = len(raw_jobs)

        for posting in raw_jobs:
            title = posting.get("text", "")
            categories = posting.get("categories", {})
            commitment = categories.get("commitment", "")

            if not is_early_career(title, commitment):
                filtered_out += 1
                continue

            hosted_url = posting.get("hostedUrl", "")
            url = canonicalize_url(hosted_url)
            apply_url = posting.get("applyUrl", hosted_url)
            application_url = canonicalize_url(apply_url)

            location = categories.get("location", config.default_location or "Unknown")

            created_at_ms = posting.get("createdAt")
            if created_at_ms is not None:
                try:
                    from datetime import timezone as _tz
                    posted_at = (
                        datetime.fromtimestamp(created_at_ms / 1000, tz=_tz.utc)
                        .replace(tzinfo=None)
                        .isoformat()
                        + "Z"
                    )
                except (ValueError, OSError):
                    posted_at = now_iso()
            else:
                posted_at = now_iso()

            team = categories.get("team", "")
            industries = infer_industries(title, team, "", config.default_industries)
            level = infer_level(title, commitment)
            remote = infer_remote(location)

            jobs.append(
                {
                    "company": config.company,
                    "title": title,
                    "level": level,
                    "location": location,
                    "url": url,
                    "application_url": application_url,
                    "remote": remote,
                    "industries": industries,
                    "portal": self.portal,
                    "posted_at": posted_at,
                    "tags": ["source:lever", "sync:scheduled"],
                    "source": "lever_source_sync",
                }
            )

        jobs = dedupe_by_url(jobs)
        emitted = len(jobs)
        filtered_out = fetched - emitted

        return ScrapeResult(
            source_id=config.id,
            company=config.company,
            portal=self.portal,
            fetched=fetched,
            emitted=emitted,
            filtered_out=filtered_out,
            jobs=jobs,
            warnings=warnings,
            errors=errors,
        )
