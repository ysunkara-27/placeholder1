from __future__ import annotations

from apply_engine.agents.ashby import AshbyAgent
from apply_engine.agents.detector import detect_portal
from apply_engine.agents.greenhouse import GreenhouseAgent
from apply_engine.agents.icims import IcimsAgent
from apply_engine.agents.lever import LeverAgent
from apply_engine.agents.vision import VisionAgent
from apply_engine.agents.workday import WorkdayAgent
from apply_engine.models import ApplyRequest, ApplyResult


AGENTS = {
    "greenhouse": GreenhouseAgent(),
    "lever": LeverAgent(),
    "workday": WorkdayAgent(),
    "ashby": AshbyAgent(),
    "icims": IcimsAgent(),
    "vision": VisionAgent(),
}


async def route_application(request: ApplyRequest) -> ApplyResult:
    portal = detect_portal(request.url)
    agent = AGENTS.get(portal, AGENTS["vision"])
    return await agent.apply(request)
