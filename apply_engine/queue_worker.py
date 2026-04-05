"""
Hosted queue poller for Twin's Supabase-backed application queue.

Railway can run this as a lightweight worker service. It repeatedly calls the
Next.js protected queue-drain endpoint and exposes a simple /health response on
PORT so the service stays observable.
"""

from __future__ import annotations

import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any

import httpx


_state: dict[str, Any] = {
    "alive": True,
    "last_success_at": None,
    "last_error": "",
    "last_processed": 0,
    "last_status_code": None,
}


def _env_int(name: str, default: int) -> int:
    value = os.environ.get(name, "").strip()
    if not value:
        return default


def _env_flag(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in {"1", "true", "yes", "on"}

    try:
        return max(1, int(value))
    except ValueError:
        return default


def _get_base_url() -> str:
    base_url = (
        os.environ.get("TWIN_APP_BASE_URL", "").strip()
        or os.environ.get("NEXT_PUBLIC_APP_URL", "").strip()
    )
    return base_url.rstrip("/")


def _build_health_payload() -> bytes:
    payload = {
        "status": "ok" if _state["alive"] else "error",
        "last_success_at": _state["last_success_at"],
        "last_error": _state["last_error"],
        "last_processed": _state["last_processed"],
        "last_status_code": _state["last_status_code"],
    }
    return json.dumps(payload).encode("utf-8")


class _HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802
        status_code = 200 if _state["alive"] else 503
        body = _build_health_payload()
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args: object) -> None:
        return


def _run_health_server(port: int) -> None:
    server = HTTPServer(("0.0.0.0", port), _HealthHandler)
    server.serve_forever()


def _process_queue_once(
    client: httpx.Client,
    base_url: str,
    worker_secret: str,
    timeout_seconds: int,
) -> int:
    response = client.post(
        f"{base_url}/api/internal/cron/process-queue",
        headers={"Authorization": f"Bearer {worker_secret}"},
        timeout=timeout_seconds,
    )
    _state["last_status_code"] = response.status_code
    response.raise_for_status()

    payload = response.json()
    processed = int(payload.get("processed", 0) or 0)
    _state["last_processed"] = processed
    _state["last_success_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    _state["last_error"] = ""
    _state["alive"] = True

    print(
        "[queue_worker] processed="
        f"{processed} results={len(payload.get('results', []))}",
        flush=True,
    )

    for result in payload.get("results", []):
        print(
            "[queue_worker] result "
            f"application={result.get('applicationId')} "
            f"status={result.get('status')} "
            f"portal={result.get('portal')} "
            f"run={result.get('runId')} "
            f"error={result.get('error')}",
            flush=True,
        )

    return processed


def main() -> None:
    port = _env_int("PORT", 8000)
    base_url = _get_base_url()
    worker_secret = os.environ.get("APPLY_QUEUE_WORKER_SECRET", "").strip()
    request_timeout_seconds = _env_int("TWIN_QUEUE_REQUEST_TIMEOUT_SECONDS", 320)
    idle_sleep_seconds = _env_int("TWIN_QUEUE_IDLE_SLEEP_SECONDS", 20)
    busy_sleep_seconds = _env_int("TWIN_QUEUE_BUSY_SLEEP_SECONDS", 3)
    error_sleep_seconds = _env_int("TWIN_QUEUE_ERROR_SLEEP_SECONDS", 30)
    run_once = _env_flag("TWIN_QUEUE_RUN_ONCE")

    if not base_url:
        raise RuntimeError("Missing TWIN_APP_BASE_URL or NEXT_PUBLIC_APP_URL")

    if not worker_secret:
        raise RuntimeError("Missing APPLY_QUEUE_WORKER_SECRET")

    thread = threading.Thread(target=_run_health_server, args=(port,), daemon=True)
    thread.start()
    print(f"[queue_worker] health server listening on :{port}", flush=True)
    print(f"[queue_worker] target={base_url}", flush=True)

    with httpx.Client(follow_redirects=True) as client:
        while True:
            try:
                processed = _process_queue_once(
                    client,
                    base_url,
                    worker_secret,
                    request_timeout_seconds,
                )
                if run_once:
                    return
                time.sleep(busy_sleep_seconds if processed > 0 else idle_sleep_seconds)
            except KeyboardInterrupt:
                raise
            except Exception as exc:  # noqa: BLE001
                _state["alive"] = False
                _state["last_error"] = str(exc)
                print(f"[queue_worker] error={exc}", flush=True)
                time.sleep(error_sleep_seconds)
                _state["alive"] = True


if __name__ == "__main__":
    main()
