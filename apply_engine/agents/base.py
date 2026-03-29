from __future__ import annotations

from abc import ABC, abstractmethod

from apply_engine.models import ApplyRequest, ApplyResult


class PortalAgent(ABC):
    portal_name: str

    @abstractmethod
    async def apply(self, request: ApplyRequest) -> ApplyResult:
        raise NotImplementedError
