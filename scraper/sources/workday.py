"""Workday source adapter (scaffold).

Workday discovery requires tenant-specific API reverse engineering. Each company has a
different subdomain and endpoint shape. This adapter is scaffolded and will remain
disabled until a stable deterministic path is confirmed.
"""
from __future__ import annotations

import logging
from typing import Any

from scraper.sources.base import BaseSource, ScrapeResult, SourceConfig

logger = logging.getLogger(__name__)


class WorkdaySource(BaseSource):
    portal = "workday"

    def scrape(self, config: SourceConfig, http_client: Any) -> ScrapeResult:
        warning = f"Workday scraping not yet implemented — source {config.id} skipped"
        logger.warning(warning)
        return ScrapeResult(
            source_id=config.id,
            company=config.company,
            portal=self.portal,
            fetched=0,
            emitted=0,
            filtered_out=0,
            jobs=[],
            warnings=[warning],
            errors=[],
        )
