"""Source registry: maps portal names to adapter instances."""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from scraper.sources.ashby import AshbySource
from scraper.sources.base import SourceConfig
from scraper.sources.greenhouse import GreenhouseSource
from scraper.sources.handshake import HandshakeSource
from scraper.sources.lever import LeverSource
from scraper.sources.workday import WorkdaySource

SOURCES = {
    "greenhouse": GreenhouseSource(),
    "lever": LeverSource(),
    "workday": WorkdaySource(),
    "ashby": AshbySource(),
    "handshake": HandshakeSource(),
}


def get_source(portal: str):
    return SOURCES.get(portal)


def load_source_configs(sources_file: str) -> list[SourceConfig]:
    """Load SourceConfig objects from a JSON sources file."""
    path = Path(sources_file)
    raw = json.loads(path.read_text(encoding="utf-8"))
    configs = []
    for item in raw:
        configs.append(
            SourceConfig(
                id=item["id"],
                portal=item["portal"],
                company=item["company"],
                board_token=item.get("board_token") or "",
                board_url=item["board_url"],
                enabled=item.get("enabled", True),
                default_location=item.get("default_location"),
                default_industries=item.get("default_industries", []),
                notes=item.get("notes", ""),
            )
        )
    return configs


def scrape_sources(
    sources_file: str,
    portal_filter: str | None = None,
    company_filter: str | None = None,
    http_client: Any = None,
) -> tuple[list[dict], dict[str, Any]]:
    """
    Load sources from file, apply filters, scrape each enabled source,
    and return (all_jobs, diagnostics_dict).
    """
    import httpx

    configs = load_source_configs(sources_file)

    # Apply filters
    enabled = [c for c in configs if c.enabled]
    if portal_filter:
        enabled = [c for c in enabled if c.portal == portal_filter]
    if company_filter:
        enabled = [c for c in enabled if c.company.lower() == company_filter.lower()]

    all_jobs: list[dict] = []
    total_fetched = 0
    total_emitted = 0
    sources_attempted = 0
    sources_succeeded = 0

    close_client = False
    if http_client is None:
        http_client = httpx.Client()
        close_client = True

    try:
        for config in enabled:
            adapter = get_source(config.portal)
            if adapter is None:
                print(
                    f"[WARN] No adapter for portal '{config.portal}' (source: {config.id})",
                    file=sys.stderr,
                )
                continue

            sources_attempted += 1
            result = adapter.scrape(config, http_client)

            if result.errors:
                for err in result.errors:
                    print(f"[ERROR] {config.id}: {err}", file=sys.stderr)
            else:
                sources_succeeded += 1

            if result.warnings:
                for warn in result.warnings:
                    print(f"[WARN] {config.id}: {warn}", file=sys.stderr)

            total_fetched += result.fetched
            total_emitted += result.emitted
            all_jobs.extend(result.jobs)
    finally:
        if close_client:
            http_client.close()

    diagnostics = {
        "sources_attempted": sources_attempted,
        "sources_succeeded": sources_succeeded,
        "total_fetched": total_fetched,
        "total_emitted": total_emitted,
    }

    return all_jobs, diagnostics
