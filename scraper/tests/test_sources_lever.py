"""Tests for apply_engine/sources/lever.py"""
import json
import unittest
from pathlib import Path
from unittest.mock import MagicMock

import httpx

from scraper.sources.base import SourceConfig
from scraper.sources.lever import LeverSource

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _make_config() -> SourceConfig:
    return SourceConfig(
        id="beta-lever",
        portal="lever",
        company="Beta Inc",
        board_token="beta-inc",
        board_url="https://api.lever.co/v0/postings/beta-inc",
        enabled=True,
        default_industries=["SWE"],
        notes="",
    )


def _load_fixture() -> list:
    return json.loads((FIXTURES_DIR / "source_lever_listings.json").read_text())


def _make_mock_response(fixture, status_code: int = 200) -> MagicMock:
    mock_resp = MagicMock()
    mock_resp.status_code = status_code
    mock_resp.json.return_value = fixture
    return mock_resp


class LeverSourceTests(unittest.TestCase):
    def _scrape_with_fixture(self, fixture=None, status_code: int = 200):
        if fixture is None:
            fixture = _load_fixture()
        config = _make_config()
        source = LeverSource()
        mock_client = MagicMock()
        mock_client.get.return_value = _make_mock_response(fixture, status_code)
        return source.scrape(config, mock_client)

    def test_lever_scrape_returns_correct_emitted_count(self) -> None:
        result = self._scrape_with_fixture()
        # 2 intern/co-op + 1 new grad = 3 emitted; 1 senior filtered
        self.assertEqual(result.emitted, 3)
        self.assertEqual(result.fetched, 4)

    def test_lever_scrape_emitted_jobs_have_required_fields(self) -> None:
        result = self._scrape_with_fixture()
        required_fields = {"company", "title", "level", "location", "url", "application_url", "portal"}
        for job in result.jobs:
            for field in required_fields:
                self.assertIn(field, job, f"Missing field '{field}' in job: {job.get('title')}")

    def test_lever_scrape_filters_senior_roles(self) -> None:
        result = self._scrape_with_fixture()
        titles = [j["title"] for j in result.jobs]
        self.assertNotIn("Senior Backend Engineer", titles)

    def test_lever_scrape_handles_http_error(self) -> None:
        result = self._scrape_with_fixture(fixture=[], status_code=403)
        self.assertTrue(len(result.errors) > 0)
        self.assertEqual(result.jobs, [])
        self.assertEqual(result.emitted, 0)

    def test_lever_scrape_handles_timeout(self) -> None:
        config = _make_config()
        source = LeverSource()
        mock_client = MagicMock()
        mock_client.get.side_effect = httpx.TimeoutException("timed out")
        result = source.scrape(config, mock_client)
        self.assertTrue(len(result.errors) > 0)
        self.assertEqual(result.jobs, [])
        self.assertEqual(result.emitted, 0)

    def test_lever_scrape_converts_ms_timestamp(self) -> None:
        result = self._scrape_with_fixture()
        for job in result.jobs:
            posted_at = job.get("posted_at", "")
            self.assertTrue(
                len(posted_at) > 0,
                "posted_at should not be empty",
            )
            # Should end with Z (UTC) or contain T (ISO format)
            self.assertTrue(
                "T" in posted_at or posted_at.endswith("Z"),
                f"posted_at does not look like ISO format: {posted_at}",
            )

    def test_lever_scrape_job_portal_field(self) -> None:
        result = self._scrape_with_fixture()
        for job in result.jobs:
            self.assertEqual(job["portal"], "lever")

    def test_lever_scrape_job_source_field(self) -> None:
        result = self._scrape_with_fixture()
        for job in result.jobs:
            self.assertEqual(job["source"], "lever_source_sync")

    def test_lever_scrape_tags_set(self) -> None:
        result = self._scrape_with_fixture()
        for job in result.jobs:
            self.assertIn("source:lever", job["tags"])
            self.assertIn("sync:scheduled", job["tags"])

    def test_lever_scrape_coop_level(self) -> None:
        result = self._scrape_with_fixture()
        coop_jobs = [j for j in result.jobs if j["title"] == "Infrastructure Co-op, Fall 2026"]
        self.assertTrue(len(coop_jobs) > 0)
        self.assertEqual(coop_jobs[0]["level"], "co_op")

    def test_lever_scrape_application_url_set(self) -> None:
        result = self._scrape_with_fixture()
        for job in result.jobs:
            self.assertTrue(
                len(job["application_url"]) > 0,
                "application_url should not be empty",
            )


if __name__ == "__main__":
    unittest.main()
