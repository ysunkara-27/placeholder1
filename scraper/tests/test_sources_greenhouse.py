"""Tests for apply_engine/sources/greenhouse.py"""
import json
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import httpx

from scraper.sources.base import SourceConfig
from scraper.sources.greenhouse import GreenhouseSource

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _make_config() -> SourceConfig:
    return SourceConfig(
        id="acme-greenhouse",
        portal="greenhouse",
        company="Acme Corp",
        board_token="acme",
        board_url="https://boards-api.greenhouse.io/v1/boards/acme/jobs",
        enabled=True,
        default_industries=["SWE"],
        notes="",
    )


def _load_fixture() -> dict:
    return json.loads((FIXTURES_DIR / "source_greenhouse_listings.json").read_text())


def _make_mock_response(fixture: dict, status_code: int = 200) -> MagicMock:
    mock_resp = MagicMock()
    mock_resp.status_code = status_code
    mock_resp.json.return_value = fixture
    return mock_resp


class GreenhouseSourceTests(unittest.TestCase):
    def _scrape_with_fixture(self, fixture: dict | None = None, status_code: int = 200):
        if fixture is None:
            fixture = _load_fixture()
        config = _make_config()
        source = GreenhouseSource()
        mock_client = MagicMock()
        mock_client.get.return_value = _make_mock_response(fixture, status_code)
        return source.scrape(config, mock_client)

    def test_greenhouse_scrape_returns_correct_emitted_count(self) -> None:
        result = self._scrape_with_fixture()
        # 2 intern + 1 new grad = 3 emitted; 2 filtered (senior + staff)
        self.assertEqual(result.emitted, 3)
        self.assertEqual(result.fetched, 5)

    def test_greenhouse_scrape_emitted_jobs_have_required_fields(self) -> None:
        result = self._scrape_with_fixture()
        required_fields = {"company", "title", "level", "location", "url", "application_url", "portal"}
        for job in result.jobs:
            for field in required_fields:
                self.assertIn(field, job, f"Missing field '{field}' in job: {job.get('title')}")

    def test_greenhouse_scrape_filters_senior_roles(self) -> None:
        result = self._scrape_with_fixture()
        titles = [j["title"] for j in result.jobs]
        self.assertNotIn("Senior Software Engineer", titles)
        self.assertNotIn("Staff Engineer, Platform", titles)

    def test_greenhouse_scrape_dedupes_repeated_url(self) -> None:
        fixture = _load_fixture()
        # Duplicate one of the intern listings
        first_job = fixture["jobs"][0]
        duplicate = dict(first_job)
        duplicate["id"] = 9999999
        fixture["jobs"].append(duplicate)

        result = self._scrape_with_fixture(fixture=fixture)
        urls = [j["url"] for j in result.jobs]
        self.assertEqual(len(urls), len(set(urls)), "Duplicate URLs were not deduped")

    def test_greenhouse_scrape_handles_http_error(self) -> None:
        result = self._scrape_with_fixture(fixture={}, status_code=500)
        self.assertTrue(len(result.errors) > 0)
        self.assertEqual(result.jobs, [])
        self.assertEqual(result.emitted, 0)

    def test_greenhouse_scrape_handles_timeout(self) -> None:
        config = _make_config()
        source = GreenhouseSource()
        mock_client = MagicMock()
        mock_client.get.side_effect = httpx.TimeoutException("timed out")
        result = source.scrape(config, mock_client)
        self.assertTrue(len(result.errors) > 0)
        self.assertEqual(result.jobs, [])
        self.assertEqual(result.emitted, 0)

    def test_greenhouse_scrape_job_portal_field(self) -> None:
        result = self._scrape_with_fixture()
        for job in result.jobs:
            self.assertEqual(job["portal"], "greenhouse")

    def test_greenhouse_scrape_job_source_field(self) -> None:
        result = self._scrape_with_fixture()
        for job in result.jobs:
            self.assertEqual(job["source"], "greenhouse_source_sync")

    def test_greenhouse_scrape_remote_detection(self) -> None:
        result = self._scrape_with_fixture()
        # Second fixture job has "Remote - US" location
        remote_jobs = [j for j in result.jobs if j["location"] == "Remote - US"]
        self.assertTrue(len(remote_jobs) > 0)
        for j in remote_jobs:
            self.assertTrue(j["remote"])

    def test_greenhouse_scrape_tags_set(self) -> None:
        result = self._scrape_with_fixture()
        for job in result.jobs:
            self.assertIn("source:greenhouse", job["tags"])
            self.assertIn("sync:scheduled", job["tags"])


if __name__ == "__main__":
    unittest.main()
