"""
apply_engine/worker_health.py
──────────────────────────────
Starts the health server first (so Railway's healthcheck passes immediately),
then launches the Celery worker in a subprocess.
"""

import os
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer


_celery_status = {"alive": True, "error": ""}


class _HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if _celery_status["alive"]:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
        else:
            self.send_response(503)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            msg = _celery_status["error"].encode()
            self.wfile.write(b'{"status":"error","error":' + msg + b'}')

    def log_message(self, *args):
        pass


def _run_health_server(port: int) -> None:
    server = HTTPServer(("0.0.0.0", port), _HealthHandler)
    server.serve_forever()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))

    # 1. Start health server immediately so Railway healthcheck passes
    t = threading.Thread(target=_run_health_server, args=(port,), daemon=True)
    t.start()
    print(f"[worker_health] Health server listening on :{port}", flush=True)

    # 2. Launch Celery worker as a subprocess so import errors don't kill the health server
    cmd = [
        sys.executable, "-m", "celery",
        "-A", "apply_engine.workers.celery_app",
        "worker",
        "--loglevel=info",
        "--concurrency=2",
        "-Q", "apply_tasks",
    ]
    print(f"[worker_health] Starting Celery: {' '.join(cmd)}", flush=True)

    proc = subprocess.Popen(cmd)
    exit_code = proc.wait()

    _celery_status["alive"] = False
    _celery_status["error"] = f"exited with code {exit_code}"
    print(f"[worker_health] Celery exited with code {exit_code}", flush=True)

    # Keep health server alive so Railway doesn't restart in a crash loop
    # (health will return 503 so you can see it failed in logs)
    import time
    while True:
        time.sleep(60)
