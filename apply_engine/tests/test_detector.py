import unittest

from apply_engine.agents.detector import detect_portal


class PortalDetectorTests(unittest.TestCase):
    def test_detects_greenhouse(self) -> None:
        self.assertEqual(
            detect_portal("https://job-boards.greenhouse.io/scaleai/jobs/4606014005"),
            "greenhouse",
        )

    def test_detects_lever(self) -> None:
        self.assertEqual(
            detect_portal("https://jobs.lever.co/weride/8f84c602-8a79-43f6-b662-74a92ef761f5"),
            "lever",
        )

    def test_detects_workday(self) -> None:
        self.assertEqual(
            detect_portal("https://wd1.myworkdaysite.com/recruiting/company/job/123"),
            "workday",
        )

    def test_detects_handshake(self) -> None:
        self.assertEqual(
            detect_portal("https://joinhandshake.com/stu/jobs/123"),
            "handshake",
        )

    def test_falls_back_to_vision(self) -> None:
        self.assertEqual(
            detect_portal("https://careers.example.com/apply/software-engineering-intern"),
            "vision",
        )


if __name__ == "__main__":
    unittest.main()
