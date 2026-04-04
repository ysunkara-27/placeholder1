"""
apply_engine/tracking/confirmation.py
───────────────────────────────────────
Confirmation detection and structured storage.

The engine returns an ApplyResult with:
    status              — "applied" | "requires_auth" | "failed" | "unsupported"
    confirmation_snippet — text captured from the confirmation page

This module parses that snippet, infers the confirmation type and
confidence, extracts any external application ID, and persists an
ApplicationConfirmation record.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apply_engine.tracking.enums import ConfirmationType
from apply_engine.tracking.orm import ApplicationConfirmation

# ── Confirmation patterns ──────────────────────────────────────────────────────

# Pattern: "Your application has been received" / "Application submitted"
_SUCCESS_PHRASES = [
    r"application.{0,30}(submitted|received|sent|confirmed|complete|success)",
    r"thank.{0,20}(applying|submission|application)",
    r"we.{0,20}received.{0,20}application",
    r"you.{0,20}(have|will).{0,20}hear",
]

# Pattern: external application/reference IDs
_APP_ID_PATTERNS = [
    r"(?:application|reference|confirmation|req(?:uisition)?)\s*(?:id|#|no\.?|number)[:\s]*([A-Z0-9\-]{4,32})",
    r"(?:job\s*req(?:uisition)?|req)\s*#?\s*([A-Z0-9\-]{4,32})",
]

# Confidence weights
_PHRASE_CONFIDENCE    = 0.95
_APP_ID_CONFIDENCE    = 0.90
_REDIRECT_CONFIDENCE  = 0.85
_SCREENSHOT_CONFIDENCE = 0.75
_FALLBACK_CONFIDENCE  = 0.60


def _detect_type_and_confidence(
    snippet: str,
    evidence_url: str | None,
    screenshot_b64: str | None,
) -> tuple[str, float, str | None]:
    """
    Return (confirmation_type, confidence_score, external_application_id).
    """
    if not snippet and not evidence_url and not screenshot_b64:
        return ConfirmationType.TEXT_SNIPPET, _FALLBACK_CONFIDENCE, None

    text = (snippet or "").lower()
    ext_id: str | None = None

    # Check for external application ID first (highest specificity)
    for pattern in _APP_ID_PATTERNS:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            ext_id = m.group(1).upper()
            return ConfirmationType.APPLICATION_ID, _APP_ID_CONFIDENCE, ext_id

    # Check for confirmation phrases
    for pattern in _SUCCESS_PHRASES:
        if re.search(pattern, text, re.IGNORECASE):
            return ConfirmationType.TEXT_SNIPPET, _PHRASE_CONFIDENCE, None

    # Confirmation from redirect URL (e.g. /apply/success, /thank-you)
    if evidence_url:
        url_lower = evidence_url.lower()
        if any(kw in url_lower for kw in ("success", "thank", "confirm", "complete", "submitted")):
            return ConfirmationType.REDIRECT_URL, _REDIRECT_CONFIDENCE, None

    # Screenshot only
    if screenshot_b64:
        return ConfirmationType.SCREENSHOT, _SCREENSHOT_CONFIDENCE, None

    # Fallback: we have some text but no clear pattern
    return ConfirmationType.TEXT_SNIPPET, _FALLBACK_CONFIDENCE, None


class ConfirmationService:
    """
    Creates and retrieves ApplicationConfirmation records.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        application_id: uuid.UUID,
        user_id: uuid.UUID,
        attempt_number: int,
        *,
        confirmation_snippet: str = "",
        evidence_url: str | None = None,
        evidence_screenshot_path: str | None = None,
        screenshot_b64: str | None = None,
        extra_data: dict[str, Any] | None = None,
    ) -> ApplicationConfirmation:
        """
        Parse confirmation evidence and persist a record.
        Idempotent: if a record already exists for this application, return it.
        """
        existing = await self.get(application_id)
        if existing is not None:
            return existing

        conf_type, confidence, ext_id = _detect_type_and_confidence(
            confirmation_snippet, evidence_url, screenshot_b64
        )

        confirmation = ApplicationConfirmation(
            application_id=application_id,
            user_id=user_id,
            attempt_number=attempt_number,
            confirmation_type=conf_type,
            detected_text=confirmation_snippet or None,
            external_application_id=ext_id,
            evidence_url=evidence_url,
            evidence_screenshot_path=evidence_screenshot_path,
            confidence_score=confidence,
            detected_at=datetime.now(timezone.utc),
        )
        self._session.add(confirmation)
        await self._session.flush()
        return confirmation

    async def get(self, application_id: uuid.UUID) -> ApplicationConfirmation | None:
        result = await self._session.execute(
            select(ApplicationConfirmation).where(
                ApplicationConfirmation.application_id == application_id
            )
        )
        return result.scalar_one_or_none()
