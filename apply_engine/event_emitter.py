"""
apply_engine/event_emitter.py

Real-time log streaming and user-confirmation gate via Supabase.

Usage (set once per /apply call in main.py):

    emitter = SupabaseEventEmitter(application_id, supabase_url, supabase_key)
    token = set_emitter(emitter)
    try:
        result = await route_application(request)
    finally:
        reset_emitter(token)

Then anywhere in the call stack (browser.py, agents, etc.):

    await emit_log("Filling contact info")
    await emit_log("Upload error", level="error")
    confirmed = await request_confirmation(page_screenshot_b64)
"""

from __future__ import annotations

import asyncio
import time
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from contextvars import Token

try:
    import httpx as _httpx
except ImportError:  # pragma: no cover
    _httpx = None  # type: ignore[assignment]

# ── Context variable ──────────────────────────────────────────────────────────

_current_emitter: ContextVar["SupabaseEventEmitter | None"] = ContextVar(
    "_current_emitter", default=None
)

# ── Pre-auth context variable ─────────────────────────────────────────────────
# Set by the registry before a login-retry attempt.  run_with_chromium() reads
# this and executes it before navigating to the apply URL.

from typing import Callable, Awaitable  # noqa: E402

_pre_auth_fn: ContextVar["Callable | None"] = ContextVar("_pre_auth_fn", default=None)


def get_pre_auth() -> "Callable | None":
    return _pre_auth_fn.get()


def set_pre_auth(fn: "Callable | None") -> "Token[Callable | None]":
    return _pre_auth_fn.set(fn)


def reset_pre_auth(token: "Token[Callable | None]") -> None:
    _pre_auth_fn.reset(token)


# ── Emitter context helpers ───────────────────────────────────────────────────

def get_emitter() -> "SupabaseEventEmitter | None":
    return _current_emitter.get()


def set_emitter(emitter: "SupabaseEventEmitter | None") -> "Token[SupabaseEventEmitter | None]":
    return _current_emitter.set(emitter)


def reset_emitter(token: "Token[SupabaseEventEmitter | None]") -> None:
    _current_emitter.reset(token)


# ── Module-level helpers ──────────────────────────────────────────────────────

async def emit_log(msg: str, level: str = "info") -> None:
    """Append a log event if an emitter is active. Silently no-ops otherwise."""
    emitter = get_emitter()
    if emitter is not None:
        await emitter.emit(msg, level)


async def request_confirmation(screenshot_b64: str = "") -> bool:
    """
    Pause before submission and wait for user confirmation.

    Returns True  → confirmed, engine should click Submit.
    Returns False → cancelled or timed out, engine should abort.
    """
    emitter = get_emitter()
    if emitter is None:
        # No emitter configured — auto-confirm so behaviour is unchanged
        # for runs that don't pass supabase credentials.
        return True

    await emitter.set_awaiting_confirmation(screenshot_b64)
    confirmed = await emitter.await_confirmation()
    return confirmed


# ── SupabaseEventEmitter ──────────────────────────────────────────────────────

class SupabaseEventEmitter:
    """
    Writes structured log events to applications.log_events via the
    Supabase REST API and polls for user confirmation before Submit.
    """

    CONFIRMATION_TIMEOUT_SECONDS = 300  # 5 minutes
    POLL_INTERVAL_SECONDS = 3

    def __init__(
        self,
        application_id: str,
        supabase_url: str,
        supabase_key: str,
    ) -> None:
        self.application_id = application_id
        self.supabase_url = supabase_url.rstrip("/")
        self.supabase_key = supabase_key
        self._logs: list[dict] = []

    # ── Internal Supabase helpers ─────────────────────────────────────────────

    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }

    def _row_url(self) -> str:
        return (
            f"{self.supabase_url}/rest/v1/applications"
            f"?id=eq.{self.application_id}"
        )

    async def _patch(self, data: dict) -> None:
        if _httpx is None:
            return
        try:
            async with _httpx.AsyncClient(timeout=8) as client:
                await client.patch(
                    self._row_url(),
                    headers=self._headers(),
                    json=data,
                )
        except Exception:
            pass  # never let telemetry crash the apply run

    async def _get_status(self) -> str:
        if _httpx is None:
            return ""
        try:
            headers = {
                "apikey": self.supabase_key,
                "Authorization": f"Bearer {self.supabase_key}",
            }
            async with _httpx.AsyncClient(timeout=8) as client:
                resp = await client.get(
                    f"{self._row_url()}&select=status",
                    headers=headers,
                )
                data = resp.json()
                if isinstance(data, list) and data:
                    return str(data[0].get("status", ""))
        except Exception:
            pass
        return ""

    # ── Public API ────────────────────────────────────────────────────────────

    async def emit(self, msg: str, level: str = "info") -> None:
        """Append one structured log event to applications.log_events."""
        event: dict = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "msg": msg,
            "level": level,
        }
        self._logs.append(event)
        # Replace the full array so Supabase's simple REST PATCH works
        await self._patch({"log_events": self._logs})

    async def set_awaiting_confirmation(self, screenshot_b64: str = "") -> None:
        """
        Store the pre-submit screenshot and flip the application to
        'awaiting_confirmation' so the dashboard shows the confirmation modal.
        """
        await self.emit(
            "Form fully filled — waiting for your confirmation before submitting",
            level="confirmation",
        )
        update: dict = {"status": "awaiting_confirmation", "log_events": self._logs}
        if screenshot_b64:
            update["preview_screenshot"] = screenshot_b64
        await self._patch(update)

    async def set_confirmation_timeout(self) -> None:
        await self.emit("Confirmation timed out — application aborted", level="error")
        await self._patch({"status": "confirmation_timeout", "log_events": self._logs})

    async def set_cancelled(self) -> None:
        await self.emit("Submission cancelled by user", level="warn")
        # status is written by the user-facing API; we just log here

    async def set_running(self) -> None:
        """Reset status to 'running' once confirmation received so the
        dashboard shows the engine is active again."""
        await self._patch({"status": "running", "log_events": self._logs})

    async def await_confirmation(self) -> bool:
        """
        Poll Supabase every POLL_INTERVAL_SECONDS for a status change.

        Returns:
            True   if status becomes 'confirmed'
            False  if status becomes 'cancelled' or timeout expires
        """
        deadline = time.monotonic() + self.CONFIRMATION_TIMEOUT_SECONDS
        while time.monotonic() < deadline:
            status = await self._get_status()
            if status == "confirmed":
                await self.set_running()
                return True
            if status == "cancelled":
                await self.set_cancelled()
                return False
            await asyncio.sleep(self.POLL_INTERVAL_SECONDS)

        await self.set_confirmation_timeout()
        return False
