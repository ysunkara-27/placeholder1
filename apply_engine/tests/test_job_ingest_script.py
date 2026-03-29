import json
import tempfile
import unittest
from pathlib import Path

from pydantic import ValidationError

from apply_engine.scripts.ingest_jobs import JobIngestPayload, load_jobs


class JobIngestScriptTests(unittest.TestCase):
    def test_job_ingest_payload_accepts_valid_defaults(self):
        payload = JobIngestPayload(
            company="Twin",
            title="Software Engineering Intern",
            level="internship",
            location="New York, NY",
            url="https://company.example/jobs/123",
            application_url="https://jobs.example/apply/123",
        )

        self.assertFalse(payload.remote)
        self.assertEqual(payload.industries, [])
        self.assertEqual(payload.tags, [])

    def test_job_ingest_payload_rejects_invalid_level(self):
        with self.assertRaises(ValidationError):
            JobIngestPayload(
                company="Twin",
                title="Software Engineering Intern",
                level="full_time",
                location="New York, NY",
                url="https://company.example/jobs/123",
                application_url="https://jobs.example/apply/123",
            )

    def test_load_jobs_requires_list_payload(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            file_path = Path(tmp_dir) / "jobs.json"
            file_path.write_text(json.dumps({"company": "Twin"}), encoding="utf-8")

            with self.assertRaises(ValueError):
                load_jobs(str(file_path))


if __name__ == "__main__":
    unittest.main()
