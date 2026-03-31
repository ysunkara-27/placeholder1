"""Abstract base class for all source adapters."""
from __future__ import annotations

import abc
from dataclasses import dataclass, field
from typing import Any


@dataclass
class SourceConfig:
    id: str
    portal: str
    company: str
    board_token: str
    board_url: str
    enabled: bool = True
    default_location: str | None = None
    default_industries: list[str] = field(default_factory=list)
    notes: str = ""


@dataclass
class ScrapeResult:
    source_id: str
    company: str
    portal: str
    fetched: int
    emitted: int
    filtered_out: int
    jobs: list[dict[str, Any]]
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


class BaseSource(abc.ABC):
    """Every source adapter must subclass this."""

    portal: str = ""

    @abc.abstractmethod
    def scrape(self, config: SourceConfig, http_client: Any) -> ScrapeResult:
        """Fetch and normalize jobs from the source. Must be synchronous."""
        ...

    def supports(self, config: SourceConfig) -> bool:
        return config.portal == self.portal
