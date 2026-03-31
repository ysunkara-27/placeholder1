"""Tests for apply_engine/sources/common.py"""
import unittest

from scraper.sources.common import (
    canonicalize_url,
    dedupe_by_url,
    infer_industries,
    infer_level,
    infer_remote,
    is_early_career,
)


class IsEarlyCareerTests(unittest.TestCase):
    def test_is_early_career_intern(self) -> None:
        self.assertTrue(is_early_career("Software Engineering Intern"))

    def test_is_early_career_new_grad(self) -> None:
        self.assertTrue(is_early_career("New Grad Software Engineer"))

    def test_is_early_career_senior_excluded(self) -> None:
        self.assertFalse(is_early_career("Senior Software Engineer"))

    def test_is_early_career_staff_excluded(self) -> None:
        self.assertFalse(is_early_career("Staff Engineer"))

    def test_is_early_career_coop(self) -> None:
        self.assertTrue(is_early_career("Software Engineer", "Co-op"))

    def test_is_early_career_entry_level(self) -> None:
        self.assertTrue(is_early_career("Entry-Level Software Developer"))

    def test_is_early_career_university(self) -> None:
        self.assertTrue(is_early_career("University Recruiting — Software Engineer"))

    def test_is_early_career_campus(self) -> None:
        self.assertTrue(is_early_career("Campus Recruiting Program — Engineering"))


class InferLevelTests(unittest.TestCase):
    def test_infer_level_intern(self) -> None:
        self.assertEqual(infer_level("SWE Intern Summer 2026"), "internship")

    def test_infer_level_coop(self) -> None:
        self.assertEqual(infer_level("Software Co-op Fall 2026"), "co_op")

    def test_infer_level_new_grad(self) -> None:
        self.assertEqual(infer_level("New Grad Software Engineer"), "new_grad")

    def test_infer_level_part_time(self) -> None:
        self.assertEqual(infer_level("Part-time Data Analyst"), "part_time")

    def test_infer_level_defaults_to_internship(self) -> None:
        self.assertEqual(infer_level("Software Engineering Internship"), "internship")

    def test_infer_level_coop_from_commitment(self) -> None:
        self.assertEqual(infer_level("Software Engineer", "Co-op"), "co_op")

    def test_infer_level_new_grad_from_title(self) -> None:
        self.assertEqual(infer_level("New-Grad Backend Engineer"), "new_grad")


class InferIndustriesTests(unittest.TestCase):
    def test_infer_industries_swe(self) -> None:
        result = infer_industries("Software Engineer Intern")
        self.assertIn("SWE", result)

    def test_infer_industries_data(self) -> None:
        result = infer_industries("Data Science Intern")
        self.assertIn("Data", result)

    def test_infer_industries_pm(self) -> None:
        result = infer_industries("Product Management Intern")
        self.assertIn("PM", result)

    def test_infer_industries_research(self) -> None:
        result = infer_industries("Research Scientist Intern")
        self.assertIn("Research", result)

    def test_infer_industries_design(self) -> None:
        result = infer_industries("UX Design Intern")
        self.assertIn("Design", result)

    def test_infer_industries_fallback_defaults(self) -> None:
        # A title with no keyword matches should fall back to defaults
        result = infer_industries("Accounting Intern", defaults=["Finance"])
        self.assertEqual(result, ["Finance"])

    def test_infer_industries_fallback_swe_when_no_match_no_defaults(self) -> None:
        result = infer_industries("Accounting Intern")
        self.assertEqual(result, ["SWE"])

    def test_infer_industries_multiple_tags(self) -> None:
        result = infer_industries("ML Research Intern")
        # Should include both Data and Research
        self.assertIn("Data", result)
        self.assertIn("Research", result)


class InferRemoteTests(unittest.TestCase):
    def test_infer_remote_yes(self) -> None:
        self.assertTrue(infer_remote("Remote - US"))

    def test_infer_remote_no(self) -> None:
        self.assertFalse(infer_remote("San Francisco, CA"))

    def test_infer_remote_anywhere(self) -> None:
        self.assertTrue(infer_remote("Anywhere"))

    def test_infer_remote_distributed(self) -> None:
        self.assertTrue(infer_remote("Distributed Team"))

    def test_infer_remote_work_from_home(self) -> None:
        self.assertTrue(infer_remote("Work from home"))


class CanonicalizeUrlTests(unittest.TestCase):
    def test_canonicalize_url_strips_trailing_slash(self) -> None:
        url = "https://example.com/jobs/123/"
        self.assertEqual(canonicalize_url(url), "https://example.com/jobs/123")

    def test_canonicalize_url_strips_fragment(self) -> None:
        url = "https://example.com/jobs/123#apply"
        self.assertEqual(canonicalize_url(url), "https://example.com/jobs/123")

    def test_canonicalize_url_strips_both(self) -> None:
        url = "https://example.com/jobs/123/#apply"
        self.assertEqual(canonicalize_url(url), "https://example.com/jobs/123")

    def test_canonicalize_url_preserves_query(self) -> None:
        url = "https://example.com/jobs?id=123"
        self.assertEqual(canonicalize_url(url), "https://example.com/jobs?id=123")

    def test_canonicalize_url_root_path(self) -> None:
        url = "https://example.com/"
        self.assertEqual(canonicalize_url(url), "https://example.com/")


class DedupeByUrlTests(unittest.TestCase):
    def test_dedupe_by_url_removes_duplicate(self) -> None:
        jobs = [
            {"title": "Intern A", "url": "https://example.com/jobs/1"},
            {"title": "Intern A duplicate", "url": "https://example.com/jobs/1"},
        ]
        result = dedupe_by_url(jobs)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["title"], "Intern A")

    def test_dedupe_by_url_preserves_unique(self) -> None:
        jobs = [
            {"title": "Intern A", "url": "https://example.com/jobs/1"},
            {"title": "Intern B", "url": "https://example.com/jobs/2"},
        ]
        result = dedupe_by_url(jobs)
        self.assertEqual(len(result), 2)

    def test_dedupe_by_url_handles_trailing_slash(self) -> None:
        jobs = [
            {"title": "Intern A", "url": "https://example.com/jobs/1"},
            {"title": "Intern A dup", "url": "https://example.com/jobs/1/"},
        ]
        result = dedupe_by_url(jobs)
        self.assertEqual(len(result), 1)

    def test_dedupe_by_url_preserves_order(self) -> None:
        jobs = [
            {"title": "First", "url": "https://example.com/jobs/1"},
            {"title": "Second", "url": "https://example.com/jobs/2"},
            {"title": "Third", "url": "https://example.com/jobs/3"},
        ]
        result = dedupe_by_url(jobs)
        self.assertEqual([j["title"] for j in result], ["First", "Second", "Third"])


if __name__ == "__main__":
    unittest.main()
