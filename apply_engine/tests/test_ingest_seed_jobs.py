import json
import tempfile
import unittest
from pathlib import Path

from apply_engine.scripts.ingest_seed_jobs import infer_level, load_seed_jobs


class IngestSeedJobsTests(unittest.TestCase):
    def test_infer_level_recognizes_common_titles(self):
        self.assertEqual(infer_level("Software Engineering Intern"), "internship")
        self.assertEqual(infer_level("Software Engineer Co-op"), "co_op")
        self.assertEqual(infer_level("New Grad Backend Engineer"), "new_grad")
        self.assertEqual(infer_level("Part Time Developer"), "part_time")

    def test_load_seed_jobs_maps_seed_shape_to_ingest_payload(self):
        seed_jobs = [
            {
                "id": "seed-1",
                "portal": "greenhouse",
                "company": "Twin",
                "title": "Software Engineering Intern",
                "location": "Remote",
                "apply_url": "https://boards.greenhouse.io/twin/jobs/123",
                "source_url": "https://boards.greenhouse.io/twin/jobs/123",
                "notes": "Standard SWE internship",
                "retrieved_on": "2026-03-29",
            }
        ]

        with tempfile.TemporaryDirectory() as tmp_dir:
            file_path = Path(tmp_dir) / "seed_jobs.json"
            file_path.write_text(json.dumps(seed_jobs), encoding="utf-8")

            payloads = load_seed_jobs(str(file_path))

        self.assertEqual(len(payloads), 1)
        payload = payloads[0]
        self.assertEqual(payload["company"], "Twin")
        self.assertEqual(payload["level"], "internship")
        self.assertTrue(payload["remote"])
        self.assertEqual(payload["portal"], "greenhouse")
        self.assertEqual(payload["source"], "repo_seed")
        self.assertIn("seed_import", payload["tags"])


if __name__ == "__main__":
    unittest.main()
