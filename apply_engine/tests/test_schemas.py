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
