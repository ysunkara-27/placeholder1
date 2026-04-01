import unittest

from apply_engine.schemas import ApplyPayload


class SchemaTests(unittest.TestCase):
    def test_apply_payload_defaults_dry_run_true(self) -> None:
        payload = ApplyPayload.from_dict(
            {
                "url": "https://job-boards.greenhouse.io/scaleai/jobs/4606014005",
                "profile": {
                    "first_name": "Test",
                    "last_name": "User",
                    "email": "test@example.com",
                    "start_date": "2026-06-01",
                    "location_preference": "San Francisco, CA",
                    "salary_expectation": "$45/hour",
                    "onsite_preference": "Open to onsite",
                    "weekly_availability_hours": "40",
                    "graduation_window": "2027",
                    "commute_preference": "Within 45 minutes",
                    "custom_answers": {
                        "favorite_language": "Python",
                    },
                },
            }
        )

        self.assertTrue(payload.dry_run)
        self.assertEqual(payload.profile.first_name, "Test")
        self.assertEqual(payload.profile.start_date, "2026-06-01")
        self.assertEqual(payload.profile.weekly_availability_hours, "40")
        self.assertEqual(payload.profile.graduation_window, "2027")
        self.assertEqual(payload.profile.custom_answers, {"favorite_language": "Python"})
        self.assertEqual(payload.runtime_hints, {})

    def test_apply_payload_accepts_runtime_hints(self) -> None:
        payload = ApplyPayload.from_dict(
            {
                "url": "https://jobs.lever.co/weride/8f84c602-8a79-43f6-b662-74a92ef761f5",
                "profile": {
                    "first_name": "Test",
                    "last_name": "User",
                    "email": "test@example.com",
                },
                "runtime_hints": {
                    "likely_blocked_family": "availability",
                    "historical_blocked_families": ["availability", "eeo"],
                },
            }
        )

        self.assertEqual(payload.runtime_hints["likely_blocked_family"], "availability")
        self.assertEqual(
            payload.runtime_hints["historical_blocked_families"],
            ["availability", "eeo"],
        )

    def test_apply_payload_accepts_extended_profile_fields(self) -> None:
        payload = ApplyPayload.from_dict(
            {
                "url": "https://job-boards.greenhouse.io/scaleai/jobs/4606014005",
                "profile": {
                    "first_name": "Test",
                    "last_name": "User",
                    "email": "test@example.com",
                    "linkedin_url": "https://linkedin.com/in/test-user",
                    "website_url": "https://test.dev",
                    "github_url": "https://github.com/test-user",
                    "authorized_to_work": True,
                    "earliest_start_date": "2026-06-01",
                },
            }
        )

        self.assertEqual(payload.profile.linkedin_url, "https://linkedin.com/in/test-user")
        self.assertEqual(payload.profile.website_url, "https://test.dev")
        self.assertEqual(payload.profile.github_url, "https://github.com/test-user")
        self.assertTrue(payload.profile.authorized_to_work)
        self.assertEqual(payload.profile.earliest_start_date, "2026-06-01")

    def test_apply_payload_accepts_live_log_fields(self) -> None:
        payload = ApplyPayload.from_dict(
            {
                "url": "https://jobs.lever.co/example/abc",
                "profile": {
                    "first_name": "Test",
                    "last_name": "User",
                    "email": "test@example.com",
                },
                "application_id": "abc-123",
                "supabase_url": "https://xyz.supabase.co",
                "supabase_key": "secret-key",
            }
        )
        self.assertEqual(payload.application_id, "abc-123")
        self.assertEqual(payload.supabase_url, "https://xyz.supabase.co")
        self.assertEqual(payload.supabase_key, "secret-key")

    def test_apply_payload_rejects_extra_fields(self) -> None:
        with self.assertRaises(Exception):
            ApplyPayload.from_dict(
                {
                    "url": "https://jobs.lever.co/weride/8f84c602-8a79-43f6-b662-74a92ef761f5",
                    "profile": {
                        "first_name": "Test",
                        "last_name": "User",
                        "email": "test@example.com",
                        "unknown_field": "bad",
                    },
                }
            )


if __name__ == "__main__":
    unittest.main()
