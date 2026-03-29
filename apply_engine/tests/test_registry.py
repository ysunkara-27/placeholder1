import asyncio
import unittest

from apply_engine.models import ApplicantProfile, ApplyRequest
from apply_engine.registry import route_application


class RegistryTests(unittest.TestCase):
    def test_routes_greenhouse_dry_run(self) -> None:
        request = ApplyRequest(
            url="https://job-boards.greenhouse.io/scaleai/jobs/4606014005",
            profile=ApplicantProfile(
                first_name="Test",
                last_name="User",
                email="test@example.com",
                resume_pdf_path="/tmp/resume.pdf",
            ),
            dry_run=True,
        )

        result = asyncio.run(route_application(request))

        self.assertEqual(result.portal, "greenhouse")
        self.assertEqual(result.status, "unsupported")
        self.assertGreaterEqual(len(result.actions), 3)

    def test_routes_lever_dry_run(self) -> None:
        request = ApplyRequest(
            url="https://jobs.lever.co/weride/8f84c602-8a79-43f6-b662-74a92ef761f5",
            profile=ApplicantProfile(
                first_name="Test",
                last_name="User",
                email="test@example.com",
                resume_pdf_path="/tmp/resume.pdf",
            ),
            dry_run=True,
        )

        result = asyncio.run(route_application(request))

        self.assertEqual(result.portal, "lever")
        self.assertEqual(result.status, "unsupported")
        self.assertGreaterEqual(len(result.actions), 2)


if __name__ == "__main__":
    unittest.main()
