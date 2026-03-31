"""Handshake source adapter (scaffold).

Handshake requires authentication for most listing access. This adapter is scaffolded
and will remain disabled until an authenticated scraping strategy is confirmed.
"""
from __future__ import annotations

import logging
from typing import Any

from scraper.sources.base import BaseSource, ScrapeResult, SourceConfig

logger = logging.getLogger(__name__)


class HandshakeSource(BaseSource):
    portal = "handshake"

    def scrape(self, config: SourceConfig, http_client: Any) -> ScrapeResult:
        warning = f"Handshake scraping requires authentication — source {config.id} skipped"
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
