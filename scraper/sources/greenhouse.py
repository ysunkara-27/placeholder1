"""Greenhouse source adapter.

Fetches job listings from the public Greenhouse JSON API:
  GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true
"""
from __future__ import annotations

import logging
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


class GreenhouseSource(BaseSource):
    portal = "greenhouse"

    def _api_url(self, config: SourceConfig) -> str:
        if config.board_token:
            return f"https://boards-api.greenhouse.io/v1/boards/{config.board_token}/jobs"

        board_url = config.board_url.strip()
        if "boards-api.greenhouse.io" in board_url:
            return board_url.split("?", 1)[0].rstrip("/")

        return f"{board_url.rstrip('/')}/jobs"

    def scrape(self, config: SourceConfig, http_client: Any) -> ScrapeResult:
        fetched = 0
        emitted = 0
        filtered_out = 0
        jobs: list[dict] = []
        warnings: list[str] = []
        errors: list[str] = []

        try:
            response = http_client.get(
                f"{self._api_url(config)}?content=true",
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
            data = response.json()
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

        raw_jobs = data.get("jobs", [])
        fetched = len(raw_jobs)

        for job in raw_jobs:
            title = job.get("title", "")
            if not is_early_career(title):
                filtered_out += 1
                continue

            absolute_url = job.get("absolute_url", "")
            url = canonicalize_url(absolute_url)
            application_url = url

            location = job.get("location", {}).get(
                "name", config.default_location or "Unknown"
            )

            posted_at = job.get("updated_at", now_iso())

            departments = job.get("departments", [])
            team = departments[0].get("name", "") if departments else ""

            industries = infer_industries(title, team, config.notes, config.default_industries)
            level = infer_level(title)
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
                    "tags": ["source:greenhouse", "sync:scheduled"],
                    "source": "greenhouse_source_sync",
                }
            )

        jobs = dedupe_by_url(jobs)
        emitted = len(jobs)
        # recalculate filtered_out after deduplication
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
