from __future__ import annotations

from apply_engine.agents.base import PortalAgent
from apply_engine.models import ApplyRequest, ApplyResult


class VisionAgent(PortalAgent):
    portal_name = "vision"

    async def apply(self, request: ApplyRequest) -> ApplyResult:
        return ApplyResult(
            portal="vision",
            status="unsupported" if request.dry_run else "failed",
            error="" if request.dry_run else "Claude vision runtime not wired yet.",
        )
