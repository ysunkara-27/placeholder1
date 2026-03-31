"""Tests for scaffold source adapters: Workday and Handshake."""
import unittest
from unittest.mock import MagicMock

from scraper.sources.base import SourceConfig
from scraper.sources.handshake import HandshakeSource
from scraper.sources.workday import WorkdaySource


def _make_workday_config() -> SourceConfig:
    return SourceConfig(
        id="microsoft-workday",
        portal="workday",
        company="Microsoft",
        board_token="microsoft",
        board_url="https://microsoft.wd5.myworkdayjobs.com/en-US/External",
        enabled=False,
        default_industries=["SWE"],
        notes="Workday scaffold",
    )


def _make_handshake_config() -> SourceConfig:
    return SourceConfig(
        id="handshake-example",
        portal="handshake",
        company="Example Corp",
        board_token="example",
        board_url="https://app.joinhandshake.com/emp/employers/example",
        enabled=False,
        default_industries=["SWE"],
        notes="Handshake scaffold",
    )


class WorkdayScaffoldTests(unittest.TestCase):
    def test_workday_scrape_returns_empty_and_warning(self) -> None:
        source = WorkdaySource()
        config = _make_workday_config()
        mock_client = MagicMock()

        result = source.scrape(config, mock_client)

        self.assertEqual(result.jobs, [])
        self.assertEqual(result.fetched, 0)
        self.assertEqual(result.emitted, 0)
        self.assertEqual(result.filtered_out, 0)
        self.assertTrue(len(result.warnings) > 0)
        self.assertIn("microsoft-workday", result.warnings[0])

    def test_workday_scrape_does_not_call_http(self) -> None:
        source = WorkdaySource()
        config = _make_workday_config()
        mock_client = MagicMock()

        source.scrape(config, mock_client)

        mock_client.get.assert_not_called()

    def test_workday_portal_attribute(self) -> None:
        source = WorkdaySource()
        self.assertEqual(source.portal, "workday")

    def test_workday_supports_config(self) -> None:
        source = WorkdaySource()
        config = _make_workday_config()
        self.assertTrue(source.supports(config))


class HandshakeScaffoldTests(unittest.TestCase):
    def test_handshake_scrape_returns_empty_and_warning(self) -> None:
        source = HandshakeSource()
        config = _make_handshake_config()
        mock_client = MagicMock()

        result = source.scrape(config, mock_client)

        self.assertEqual(result.jobs, [])
        self.assertEqual(result.fetched, 0)
        self.assertEqual(result.emitted, 0)
        self.assertEqual(result.filtered_out, 0)
        self.assertTrue(len(result.warnings) > 0)
        self.assertIn("handshake-example", result.warnings[0])

    def test_handshake_scrape_does_not_call_http(self) -> None:
        source = HandshakeSource()
        config = _make_handshake_config()
        mock_client = MagicMock()

        source.scrape(config, mock_client)

        mock_client.get.assert_not_called()

    def test_handshake_portal_attribute(self) -> None:
        source = HandshakeSource()
        self.assertEqual(source.portal, "handshake")

    def test_handshake_supports_config(self) -> None:
        source = HandshakeSource()
        config = _make_handshake_config()
        self.assertTrue(source.supports(config))


if __name__ == "__main__":
    unittest.main()
