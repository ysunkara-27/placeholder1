import argparse
import json
from pathlib import Path

from apply_engine.scripts.ingest_jobs import process_batch


def infer_level(title: str) -> str:
    normalized = title.lower()

    if "intern" in normalized:
        return "internship"
    if "co-op" in normalized or "coop" in normalized:
        return "co_op"
    if "new grad" in normalized:
        return "new_grad"
    if "part time" in normalized:
        return "part_time"

    return "internship"


def infer_industries(title: str, notes: str) -> list[str]:
    normalized = f"{title} {notes}".lower()
    industries: list[str] = []

    if any(keyword in normalized for keyword in ("software", "engineer", "developer")):
        industries.append("SWE")
    if any(keyword in normalized for keyword in ("data", "ml")):
        industries.append("Data")
    if "product" in normalized:
        industries.append("PM")
    if "research" in normalized:
        industries.append("Research")

    return industries or ["SWE"]


def load_seed_jobs(path: str) -> list[dict]:
    file_path = Path(path)
    raw = json.loads(file_path.read_text(encoding="utf-8"))

    if not isinstance(raw, list):
        raise ValueError("Seed jobs file must contain a list")

    payloads: list[dict] = []

    for job in raw:
        payloads.append(
            {
                "company": job["company"],
                "title": job["title"],
                "level": infer_level(job["title"]),
                "location": job["location"],
                "url": job["source_url"],
                "application_url": job["apply_url"],
                "remote": "remote" in job["location"].lower(),
                "industries": infer_industries(job["title"], job.get("notes", "")),
                "portal": job.get("portal"),
                "jd_summary": job.get("notes"),
                "posted_at": f"{job['retrieved_on']}T00:00:00.000Z",
                "source": "repo_seed",
                "tags": ["seed_import"],
            }
        )

    return payloads


def parse_args():
    parser = argparse.ArgumentParser(
        description="Ingest the repo seed jobs into Twin via /api/jobs/ingest"
    )
    parser.add_argument(
        "--file",
        default="data/job-seeds/live-openings-2026.json",
        help="Path to the repo seed job JSON file",
    )
    parser.add_argument(
        "--base-url",
        required=True,
        help="Twin app base URL, e.g. https://your-project.vercel.app",
    )
    parser.add_argument(
        "--worker-secret",
        required=True,
        help="Worker bearer token for /api/jobs/ingest",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=10,
        help="Maximum concurrent ingest requests",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    jobs = load_seed_jobs(args.file)
    import asyncio

    asyncio.run(
        process_batch(
            scraped_jobs=jobs,
            base_url=args.base_url,
            worker_secret=args.worker_secret,
            concurrency=max(args.concurrency, 1),
        )
    )


if __name__ == "__main__":
    main()
