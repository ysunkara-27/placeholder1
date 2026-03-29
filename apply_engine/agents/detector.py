from __future__ import annotations

from urllib.parse import urlparse

from apply_engine.models import PortalType


def detect_portal(url: str) -> PortalType:
    normalized = url.lower().strip()
    hostname = urlparse(normalized).netloc
    path = urlparse(normalized).path

    if "greenhouse.io" in hostname or "greenhouse.io" in path:
        return "greenhouse"
    if "lever.co" in hostname or "lever.co" in path:
        return "lever"
    if "myworkdayjobs.com" in hostname or "myworkdaysite.com" in hostname:
        return "workday"
    if "handshake.com" in hostname or "joinhandshake.com" in hostname:
        return "handshake"
    return "vision"
