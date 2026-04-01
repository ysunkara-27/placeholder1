from __future__ import annotations

from typing import Any

from apply_engine.agents.ashby import AshbyAgent
from apply_engine.agents.detector import detect_portal
from apply_engine.agents.greenhouse import GreenhouseAgent
from apply_engine.agents.icims import IcimsAgent
from apply_engine.agents.lever import LeverAgent
from apply_engine.agents.vision import VisionAgent
from apply_engine.agents.workday import WorkdayAgent
from apply_engine.browser import attempt_portal_login, selector_exists
from apply_engine.event_emitter import emit_log, set_pre_auth, reset_pre_auth
from apply_engine.models import ApplyRequest, ApplyResult


AGENTS = {
    "greenhouse": GreenhouseAgent(),
    "lever": LeverAgent(),
    "workday": WorkdayAgent(),
    "ashby": AshbyAgent(),
    "icims": IcimsAgent(),
    "vision": VisionAgent(),
}

# Portal-specific login page URLs.  Used when a login form isn't on the apply
# page itself (e.g. Handshake always routes to a central login page first).
_PORTAL_LOGIN_URLS: dict[str, str] = {
    "handshake": "https://app.joinhandshake.com/login",
}


def _build_pre_auth(portal: str, apply_url: str, creds: dict[str, Any]) -> Any:
    """
    Return an async callable that logs the user in before the apply page loads.

    For portals with a dedicated login URL (Handshake): navigate there directly.
    For portals where login is on the apply page itself (Workday, iCIMS, etc.):
    navigate to the apply URL first, handle the "Sign In" flow, then
    run_with_chromium will re-navigate to the apply URL after pre_auth finishes.
    """
    email: str = creds.get("email", "")
    password: str = creds.get("password", "")
    if not email or not password:
        return None

    login_url = _PORTAL_LOGIN_URLS.get(portal)

    async def pre_auth(page: Any) -> None:
        target_url = login_url or apply_url
        try:
            await page.goto(target_url, wait_until="domcontentloaded", timeout=30_000)
        except Exception:
            pass
        success = await attempt_portal_login(page, email, password)
        if success:
            await emit_log(f"Logged in to {portal} — resuming application")
        else:
            await emit_log(f"Login to {portal} did not succeed — continuing anyway", level="warn")

    return pre_auth


async def route_application(request: ApplyRequest) -> ApplyResult:
    portal = detect_portal(request.url)
    agent = AGENTS.get(portal, AGENTS["vision"])

    result = await agent.apply(request)

    # If the portal requires authentication and the user has saved credentials,
    # retry the entire application with a pre-auth login step.
    if result.status == "requires_auth" and not request.dry_run:
        portal_accounts: dict[str, Any] = getattr(request.profile, "portal_accounts", None) or {}
        creds = portal_accounts.get(portal) or {}
        if creds.get("email") and creds.get("password"):
            await emit_log(
                f"Auth wall detected — retrying with saved {portal} credentials",
                level="info",
            )
            pre_auth = _build_pre_auth(portal, request.url, creds)
            if pre_auth is not None:
                token = set_pre_auth(pre_auth)
                try:
                    retry_result = await agent.apply(request)
                finally:
                    reset_pre_auth(token)
                # Return the retry result even if it's still requires_auth
                # (so the user sees the latest error, not the first one)
                return retry_result

    return result
