"""Tests for scrape_jobs.py and scrape_and_ingest_jobs.py CLI scripts."""
import os
import subprocess
import sys
import unittest
from pathlib import Path

# Project root: two levels up from this test file
_PROJECT_ROOT = str(Path(__file__).parent.parent.parent)


def _run_script(script_path: str, args: list[str]) -> subprocess.CompletedProcess:
    """Run a script with PYTHONPATH set so package imports resolve."""
    env = dict(os.environ)
    existing_pythonpath = env.get("PYTHONPATH", "")
    env["PYTHONPATH"] = (
        f"{_PROJECT_ROOT}:{existing_pythonpath}" if existing_pythonpath else _PROJECT_ROOT
    )
    return subprocess.run(
        [sys.executable, script_path] + args,
        capture_output=True,
        text=True,
        timeout=30,
        env=env,
        cwd=_PROJECT_ROOT,
    )


class ScrapeJobsCliTests(unittest.TestCase):
    def test_scrape_jobs_cli_help(self) -> None:
        result = _run_script("apply_engine/scripts/scrape_jobs.py", ["--help"])
        self.assertEqual(result.returncode, 0)
        self.assertIn("scrape", result.stdout.lower())

    def test_scrape_and_ingest_cli_help(self) -> None:
        result = _run_script("apply_engine/scripts/scrape_and_ingest_jobs.py", ["--help"])
        self.assertEqual(result.returncode, 0)
        self.assertIn("scrape", result.stdout.lower())


if __name__ == "__main__":
    unittest.main()
