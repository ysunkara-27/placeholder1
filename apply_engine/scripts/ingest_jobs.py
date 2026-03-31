from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path
from typing import Literal

import httpx
from pydantic import BaseModel, Field


class JobIngestPayload(BaseModel):
    company: str
    title: str
    level: Literal["internship", "new_grad", "co_op", "part_time"]
    location: str
    url: str
    application_url: str
    remote: bool = False
    industries: list[str] = Field(default_factory=list)
    portal: Literal[
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
    ] | None = None
    jd_summary: str | None = None
    posted_at: str | None = None
    salary_range: str | None = None
    tags: list[str] = Field(default_factory=list)
    deadline: str | None = None
    headcount: int | None = None
    source: str | None = None


def load_jobs(path: str) -> list[dict]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError("Jobs file must contain a list")
    return [JobIngestPayload.model_validate(job).model_dump(exclude_none=True) for job in payload]


async def ingest_job(
    client: httpx.AsyncClient,
    job_data: dict,
    semaphore: asyncio.Semaphore,
    url: str,
    headers: dict[str, str],
) -> dict:
    async with semaphore:
        try:
            validated_job = JobIngestPayload.model_validate(job_data)
            response = await client.post(
                url,
                headers=headers,
                json=validated_job.model_dump(exclude_none=True),
                timeout=20.0,
            )
            response.raise_for_status()
            return {
                "status": "success",
                "job_url": validated_job.url,
                "data": response.json(),
            }
        except Exception as exc:  # noqa: BLE001
            return {
                "status": "error",
                "job_url": job_data.get("url"),
                "error": str(exc),
            }


async def process_batch(
    scraped_jobs: list[dict],
    base_url: str,
    worker_secret: str,
    concurrency: int = 20,
) -> list[dict]:
    api_url = f"{base_url.rstrip('/')}/api/jobs/ingest"
    headers = {"Authorization": f"Bearer {worker_secret}"}
    max_concurrency = max(concurrency, 1)
    semaphore = asyncio.Semaphore(max_concurrency)
    limits = httpx.Limits(
        max_keepalive_connections=max_concurrency,
        max_connections=max(max_concurrency * 2, 20),
    )

    async with httpx.AsyncClient(limits=limits) as client:
        tasks = [
            ingest_job(client, job, semaphore, api_url, headers)
            for job in scraped_jobs
        ]
        return await asyncio.gather(*tasks)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Ingest normalized jobs into Twin.")
    parser.add_argument("--file", required=True, help="Path to JSON file containing a list of jobs")
    parser.add_argument("--base-url", required=True, help="Twin app base URL")
    parser.add_argument("--worker-secret", required=True, help="Worker bearer token for /api/jobs/ingest")
    parser.add_argument("--concurrency", type=int, default=20, help="Maximum concurrent ingest requests")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    jobs = load_jobs(args.file)
    results = asyncio.run(
        process_batch(
            scraped_jobs=jobs,
            base_url=args.base_url,
            worker_secret=args.worker_secret,
            concurrency=args.concurrency,
        )
    )
    successful = sum(1 for result in results if result["status"] == "success")
    failed = len(results) - successful
    print(f"Successfully ingested: {successful}")
    print(f"Failed: {failed}")


if __name__ == "__main__":
    main()
