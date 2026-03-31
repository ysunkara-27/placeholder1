"""Tests for scraper.ingest_jobs environment resolution."""
import os
import unittest
from unittest.mock import patch

from scraper.ingest_jobs import resolve_supabase_url


class ResolveSupabaseUrlTests(unittest.TestCase):
    def test_prefers_explicit_argument(self) -> None:
        with patch.dict(
            os.environ,
            {
                "SUPABASE_URL": "https://from-env.supabase.co",
                "NEXT_PUBLIC_SUPABASE_URL": "https://from-next-public.supabase.co",
            },
            clear=False,
        ):
            self.assertEqual(
                resolve_supabase_url("https://from-arg.supabase.co"),
                "https://from-arg.supabase.co",
            )

    def test_falls_back_to_supabase_url(self) -> None:
        with patch.dict(
            os.environ,
            {"SUPABASE_URL": "https://from-env.supabase.co"},
            clear=True,
        ):
            self.assertEqual(
                resolve_supabase_url(),
                "https://from-env.supabase.co",
            )

    def test_falls_back_to_next_public_supabase_url(self) -> None:
        with patch.dict(
            os.environ,
            {"NEXT_PUBLIC_SUPABASE_URL": "https://from-next-public.supabase.co"},
            clear=True,
        ):
            self.assertEqual(
                resolve_supabase_url(),
                "https://from-next-public.supabase.co",
            )

    def test_returns_empty_string_when_unset(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(resolve_supabase_url(), "")


if __name__ == "__main__":
    unittest.main()
