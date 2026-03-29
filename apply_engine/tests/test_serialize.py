import unittest

from apply_engine.models import ApplyResult, CapturedScreenshot, PlannedAction
from apply_engine.serialize import serialize_apply_result


class SerializeTests(unittest.TestCase):
    def test_serializes_result(self) -> None:
        result = ApplyResult(
            portal="greenhouse",
            status="unsupported",
            confirmation_snippet="",
            actions=[
                PlannedAction("fill", 'input[name="email"]', "test@example.com"),
                PlannedAction("check", 'input[name="sponsorship_required"][value="no"]', required=False),
            ],
            error="",
            screenshots=[
                CapturedScreenshot(
                    label="final_state",
                    data_base64="ZmFrZS1wbmc=",
                )
            ],
        )

        payload = serialize_apply_result(result)

        self.assertEqual(payload.portal, "greenhouse")
        self.assertEqual(payload.status, "unsupported")
        self.assertEqual(len(payload.actions), 2)
        self.assertTrue(payload.actions[0].required)
        self.assertEqual(payload.actions[1].action, "check")
        self.assertFalse(payload.actions[1].required)
        self.assertEqual(len(payload.screenshots or []), 1)
        self.assertEqual(payload.screenshots[0].label, "final_state")


if __name__ == "__main__":
    unittest.main()
