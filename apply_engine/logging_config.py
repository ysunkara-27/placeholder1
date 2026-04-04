"""
apply_engine/logging_config.py
────────────────────────────────
Structured JSON logging configuration.

Call configure_logging() once at application startup (in main.py).

Every log record emits a JSON object with:
    ts          — ISO 8601 timestamp
    level       — DEBUG / INFO / WARNING / ERROR / CRITICAL
    logger      — logger name (e.g. "apply_engine.service")
    message     — the log message
    + any extra fields passed via logger.info("msg", extra={...})

Example output:
    {"ts":"2026-04-03T12:00:01.123Z","level":"INFO","logger":"apply_engine.service",
     "message":"application.created","application_id":"abc...","user_id":"xyz...",
     "job_url":"https://boards.greenhouse.io/acme/jobs/1234"}
"""

from __future__ import annotations

import json
import logging
import os
import sys
import traceback
from datetime import datetime, timezone


class _JsonFormatter(logging.Formatter):
    """Emit every log record as a single-line JSON object."""

    RESERVED = {"args", "created", "exc_info", "exc_text", "filename",
                "funcName", "levelname", "levelno", "lineno", "message",
                "module", "msecs", "msg", "name", "pathname", "process",
                "processName", "relativeCreated", "stack_info", "taskName",
                "thread", "threadName"}

    def format(self, record: logging.LogRecord) -> str:
        record.message = record.getMessage()
        doc: dict = {
            "ts":      datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level":   record.levelname,
            "logger":  record.name,
            "message": record.message,
        }

        # Include any extra fields the caller attached
        for key, value in record.__dict__.items():
            if key not in self.RESERVED and not key.startswith("_"):
                try:
                    json.dumps(value)  # ensure serialisable
                    doc[key] = value
                except (TypeError, ValueError):
                    doc[key] = str(value)

        if record.exc_info:
            doc["traceback"] = self.formatException(record.exc_info)

        return json.dumps(doc, default=str)


def configure_logging(level: str | None = None) -> None:
    """
    Install structured JSON logging for the apply_engine namespace.
    Call once at app startup.
    """
    log_level = getattr(logging, (level or os.environ.get("LOG_LEVEL", "INFO")).upper(), logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(_JsonFormatter())

    root = logging.getLogger("apply_engine")
    root.setLevel(log_level)

    # Remove any existing handlers (e.g. from uvicorn default setup)
    for h in root.handlers[:]:
        root.removeHandler(h)

    root.addHandler(handler)
    root.propagate = False  # don't double-log through root logger
