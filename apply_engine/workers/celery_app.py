"""
apply_engine/workers/celery_app.py
────────────────────────────────────
Celery application configuration.

Required env vars:
    REDIS_URL            — broker + result backend, e.g. redis://localhost:6379/0

Optional:
    CELERY_CONCURRENCY   — worker concurrency (default: 4)
    CELERY_MAX_RETRIES   — per-task max retries before Celery gives up (default: 3)
                           Note: this is Celery's own retry mechanism on top of
                           our ApplicationService retry logic.

Start the worker:
    celery -A apply_engine.workers.celery_app worker \
        --loglevel=info \
        --concurrency=4 \
        -Q apply_tasks
"""

from __future__ import annotations

import os

from celery import Celery  # type: ignore[import]

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

app = Celery(
    "apply_engine",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["apply_engine.workers.apply_task"],
)

app.conf.update(
    # Serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",

    # Timezone
    timezone="UTC",
    enable_utc=True,

    # Queue
    task_default_queue="apply_tasks",
    task_routes={"apply_engine.workers.apply_task.*": {"queue": "apply_tasks"}},

    # Reliability
    task_acks_late=True,          # re-queue on worker crash
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,  # one task at a time per worker slot

    # Results
    result_expires=86400,  # 24 hours

    # Retry defaults (Celery-level)
    task_max_retries=int(os.environ.get("CELERY_MAX_RETRIES", "3")),
)
