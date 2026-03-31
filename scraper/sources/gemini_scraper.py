"""Gemini-powered source adapter for company career pages.

Used as a fallback when a portal has no deterministic API adapter
(company_website, workday, unknown portals).

Fetches the career page HTML, strips it to readable text + links,
then asks Gemini to extract internship/new-grad job listings.
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

import httpx
from bs4 import BeautifulSoup

from scraper.sources.base import BaseSource, ScrapeResult, SourceConfig
from scraper.sources.common import (
    canonicalize_url,
    dedupe_by_url,
    infer_industries,
    infer_level,
    infer_remote,
    is_early_career,
    now_iso,
)

logger = logging.getLogger(__name__)

_EXTRACT_PROMPT = """You are a job listing extractor. Given the text and links from a company career page, extract all internship, new grad, co-op, and early-career job listings.

Company: {company}
Career page URL: {url}

Page content:
{content}

Return ONLY a JSON array. Each element must have:
{{
  "title": "exact job title",
  "url": "direct link to the job listing (absolute URL)",
  "location": "city/state or Remote",
  "remote": true/false
}}

Rules:
- Only include roles that match: intern, internship, new grad, co-op, coop, university, campus, entry level, associate (junior)
- Skip: senior, staff, principal, manager, director, lead, VP
- If a job URL is relative, make it absolute using the base URL
- If location is unknown, use "Unknown"
- If no matching jobs found, return []
- Return ONLY the JSON array, no other text
"""


def _fetch_page_text(url: str, http_client: Any) -> tuple[str, list[tuple[str, str]]]:
    """Fetch a page and return (text_content, [(link_text, href), ...])."""
    try:
        resp = http_client.get(
            url,
            timeout=20,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                )
            },
            follow_redirects=True,
        )
        resp.raise_for_status()
    except Exception as exc:
        raise RuntimeError(f"Failed to fetch {url}: {exc}") from exc

    soup = BeautifulSoup(resp.text, "lxml")

    # Remove noise tags
    for tag in soup(["script", "style", "nav", "footer", "header", "meta", "noscript"]):
        tag.decompose()

    text = soup.get_text(separator="\n", strip=True)
    # Collapse excess whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = text[:8000]  # cap at ~8k chars to stay within token budget

    # Collect links
    links: list[tuple[str, str]] = []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        link_text = a.get_text(strip=True)
        if href and (
            "job" in href.lower()
            or "career" in href.lower()
            or "intern" in href.lower()
            or "recruit" in href.lower()
            or "position" in href.lower()
            or "opening" in href.lower()
        ):
            links.append((link_text[:100], href[:200]))

    return text, links[:100]


def _call_gemini(prompt: str, api_key: str, model: str) -> str:
    """Call Gemini API and return the text response."""
    from google import genai  # type: ignore
    from google.genai import types  # type: ignore

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0,
            max_output_tokens=4096,
        ),
    )
    return response.text


def _parse_gemini_response(text: str) -> list[dict]:
    """Extract JSON array from Gemini response."""
    text = text.strip()
    # Direct parse
    try:
        result = json.loads(text)
        if isinstance(result, list):
            return result
    except json.JSONDecodeError:
        pass
    # Find array in response
    match = re.search(r"\[\s*\{.*?\}\s*\]", text, re.DOTALL)
    if match:
        try:
            result = json.loads(match.group(0))
            if isinstance(result, list):
                return result
        except json.JSONDecodeError:
            pass
    # Empty brackets
    if "[]" in text:
        return []
    return []


def _make_absolute(href: str, base_url: str) -> str:
    """Make a relative URL absolute."""
    if href.startswith("http"):
        return href
    if href.startswith("//"):
        scheme = base_url.split("://")[0]
        return f"{scheme}:{href}"
    if href.startswith("/"):
        # Get origin from base_url
        parts = base_url.split("/")
        origin = "/".join(parts[:3])
        return f"{origin}{href}"
    return href


class GeminiSource(BaseSource):
    """Scrapes any career page using Gemini to extract job listings."""

    portal = "gemini"

    def __init__(self, api_key: str | None = None, model: str = "gemini-2.0-flash"):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY", "")
        self.model = model

    def scrape(self, config: SourceConfig, http_client: Any) -> ScrapeResult:
        fetched = 0
        emitted = 0
        filtered_out = 0
        jobs: list[dict] = []
        warnings: list[str] = []
        errors: list[str] = []

        if not self.api_key:
            errors.append(f"No GEMINI_API_KEY set — skipping {config.id}")
            return ScrapeResult(
                source_id=config.id,
                company=config.company,
                portal=self.portal,
                fetched=0, emitted=0, filtered_out=0,
                jobs=[], warnings=warnings, errors=errors,
            )

        # 1. Fetch the page
        try:
            text, links = _fetch_page_text(config.board_url, http_client)
        except RuntimeError as exc:
            errors.append(str(exc))
            return ScrapeResult(
                source_id=config.id,
                company=config.company,
                portal=self.portal,
                fetched=0, emitted=0, filtered_out=0,
                jobs=[], warnings=warnings, errors=errors,
            )

        # Build content block for Gemini
        links_text = "\n".join(
            f"  [{lt}]({href})" for lt, href in links
        ) if links else "(no job links detected)"

        content = f"=== PAGE TEXT ===\n{text}\n\n=== JOB LINKS ===\n{links_text}"

        prompt = _EXTRACT_PROMPT.format(
            company=config.company,
            url=config.board_url,
            content=content,
        )

        # 2. Call Gemini
        try:
            response_text = _call_gemini(prompt, self.api_key, self.model)
        except Exception as exc:  # noqa: BLE001
            errors.append(f"Gemini API error for {config.id}: {exc}")
            return ScrapeResult(
                source_id=config.id,
                company=config.company,
                portal=self.portal,
                fetched=0, emitted=0, filtered_out=0,
                jobs=[], warnings=warnings, errors=errors,
            )

        # 3. Parse response
        raw_jobs = _parse_gemini_response(response_text)
        fetched = len(raw_jobs)

        for raw in raw_jobs:
            title = raw.get("title", "").strip()
            if not title:
                filtered_out += 1
                continue

            if not is_early_career(title):
                filtered_out += 1
                continue

            raw_url = raw.get("url", "").strip()
            if not raw_url:
                raw_url = config.board_url
            job_url = canonicalize_url(_make_absolute(raw_url, config.board_url))

            location = raw.get("location") or config.default_location or "Unknown"
            remote = raw.get("remote", False) or infer_remote(location)
            level = infer_level(title)
            industries = infer_industries(title, "", config.notes, config.default_industries)

            jobs.append({
                "company": config.company,
                "title": title,
                "level": level,
                "location": location,
                "url": job_url,
                "application_url": job_url,
                "remote": remote,
                "industries": industries,
                "portal": config.portal,  # keep original portal label
                "posted_at": now_iso(),
                "tags": [f"source:gemini", f"source:{config.portal}", "sync:scheduled"],
                "source": "gemini_scrape",
            })

        jobs = dedupe_by_url(jobs)
        emitted = len(jobs)
        filtered_out = fetched - emitted

        if fetched == 0:
            warnings.append(f"Gemini returned no job listings for {config.id}")

        return ScrapeResult(
            source_id=config.id,
            company=config.company,
            portal=self.portal,
            fetched=fetched,
            emitted=emitted,
            filtered_out=filtered_out,
            jobs=jobs,
            warnings=warnings,
            errors=errors,
        )
