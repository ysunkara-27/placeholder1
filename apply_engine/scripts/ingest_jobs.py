import argparse
import asyncio
import json
import os
from pathlib import Path
from typing import Literal

import httpx
from pydantic import BaseModel, Field, HttpUrl


class JobIngestPayload(BaseModel):
    company: str
    title: str
    level: Literal["internship", "new_grad", "co_op", "part_time"]
    location: str
    url: HttpUrl
    application_url: HttpUrl

    remote: bool = False
    industries: list[str] = Field(default_factory=list)
    portal: (
        Literal[
            "greenhouse",
            "lever",
            "workday",
            "handshake",
            "linkedin",
            "indeed",
            "icims",
            "smartrecruiters",
            "company_website",
            "other",
        ]
        | None
    ) = None
    jd_summary: str | None = None
    posted_at: str | None = None
    salary_range: str | None = None
    tags: list[str] = Field(default_factory=list)
    deadline: str | None = None
    headcount: int | None = None
    source: str | None = None


async def ingest_job(
    client: httpx.AsyncClient,
    job_data: dict,
    semaphore: asyncio.Semaphore,
    url: str,
    headers: dict[str, str],
):
    async with semaphore:
        try:
            validated_job = JobIngestPayload(**job_data)
            response = await client.post(
                url,
                headers=headers,
                json=validated_job.model_dump(mode="json", exclude_none=True),
                timeout=15.0,
            )
            response.raise_for_status()
            return {
                "status": "success",
                "job_url": str(validated_job.url),
                "data": response.json(),
            }
        except Exception as error:  # noqa: BLE001
            print(f"Failed to ingest job ({job_data.get('url')}): {error}")
            return {
                "status": "error",
                "job_url": job_data.get("url"),
                "error": str(error),
            }


async def process_batch(
    scraped_jobs: list[dict],
    base_url: str,
    worker_secret: str,
    concurrency: int = 50,
):
    api_url = f"{base_url.rstrip('/')}/api/jobs/ingest"
    headers = {"Authorization": f"Bearer {worker_secret}"}
    semaphore = asyncio.Semaphore(concurrency)
    limits = httpx.Limits(
        max_keepalive_connections=concurrency,
        max_connections=max(concurrency * 2, 100),
    )

    async with httpx.AsyncClient(limits=limits) as client:
        tasks = [
            ingest_job(client, job, semaphore, api_url, headers)
            for job in scraped_jobs
        ]

        print(f"Launching ingestion of {len(scraped_jobs)} jobs -> {api_url}")
        results = await asyncio.gather(*tasks)

    successful = [result for result in results if result["status"] == "success"]
    failed = [result for result in results if result["status"] == "error"]

    print(f"Successfully ingested: {len(successful)}")
    print(f"Failed: {len(failed)}")

    return results


def load_jobs(path: str) -> list[dict]:
    file_path = Path(path)
    raw = json.loads(file_path.read_text(encoding="utf-8"))

    if not isinstance(raw, list):
        raise ValueError("Input JSON must be a list of job objects")

    return raw


def parse_args():
    parser = argparse.ArgumentParser(
        description="Batch-ingest jobs into Twin via /api/jobs/ingest"
    )
    parser.add_argument(
        "--file",
        required=True,
        help="Path to a JSON file containing a list of job objects",
    )
    parser.add_argument(
        "--base-url",
        default=os.environ.get("TWIN_BASE_URL", ""),
        help="Twin app base URL, e.g. https://your-domain.com",
    )
    parser.add_argument(
        "--worker-secret",
        default=os.environ.get("TWIN_WORKER_SECRET", ""),
        help="Worker bearer token for /api/jobs/ingest",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=50,
        help="Maximum concurrent ingest requests",
    )
    return parser.parse_args()


def main():
    args = parse_args()

    if not args.base_url:
        raise SystemExit("--base-url or TWIN_BASE_URL is required")

    if not args.worker_secret:
        raise SystemExit("--worker-secret or TWIN_WORKER_SECRET is required")

    jobs = load_jobs(args.file)
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
