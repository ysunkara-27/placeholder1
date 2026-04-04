"""
apply_engine/worker_health.py
──────────────────────────────
Starts the Celery apply worker alongside a minimal HTTP health server
so Railway's healthcheck passes.

Start command (Railway):
    python apply_engine/worker_health.py
"""

import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer


class _HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"status":"ok"}')

    def log_message(self, *args):
        pass  # silence default access logs


def _run_health_server():
    port = int(os.environ.get("PORT", 8000))
    server = HTTPServer(("0.0.0.0", port), _HealthHandler)
    server.serve_forever()


if __name__ == "__main__":
    # Health server in background thread
    t = threading.Thread(target=_run_health_server, daemon=True)
    t.start()

    # Celery worker in foreground (blocking — process exits when Celery exits)
    sys.argv = [
        "celery",
        "-A", "apply_engine.workers.celery_app",
        "worker",
        "--loglevel=info",
        "--concurrency=2",
        "-Q", "apply_tasks",
    ]
    from celery.__main__ import main  # type: ignore[import]
    main()
