"""
csv_to_json.py — Convert careers_links_master CSV to career-page-links.json

Detects real portal from URL (overrides stale CSV portal field),
extracts board_token for Greenhouse and Lever, and writes to
scraper/career-page-links.json.

Usage:
    python -m scraper.csv_to_json \
        --csv careers_links_master_plus_800_1540_live_verified_batch.csv \
        --out scraper/career-page-links.json
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path


# Portal detection from URL (takes priority over CSV portal column)
PORTAL_PATTERNS: list[tuple[str, str]] = [
    (r"boards\.greenhouse\.io|job-boards\.greenhouse\.io", "greenhouse"),
    (r"jobs\.lever\.co", "lever"),
    (r"jobs\.ashbyhq\.com", "ashby"),
    (r"myworkdayjobs\.com|workday\.com", "workday"),
    (r"smartrecruiters\.com", "smartrecruiters"),
    (r"jobs\.jobvite\.com", "jobvite"),
    (r"icims\.com", "icims"),
]


def detect_portal(url: str, csv_portal: str) -> str:
    for pattern, portal in PORTAL_PATTERNS:
        if re.search(pattern, url, re.IGNORECASE):
            return portal
    return csv_portal


def extract_board_token(url: str, portal: str) -> str:
    if portal == "greenhouse":
        # https://boards.greenhouse.io/{token}
        # https://job-boards.greenhouse.io/{token}
        m = re.search(r"greenhouse\.io/([^/?#]+)", url)
        return m.group(1) if m else ""
    if portal == "lever":
        # https://jobs.lever.co/{token}
        m = re.search(r"jobs\.lever\.co/([^/?#]+)", url)
        return m.group(1) if m else ""
    return ""


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def convert(csv_path: str, out_path: str) -> None:
    path = Path(csv_path)
    if not path.exists():
        sys.exit(f"CSV not found: {csv_path}")

    with path.open(encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    configs = []
    seen_ids: set[str] = set()

    for row in rows:
        company = row.get("company", "").strip()
        if not company:
            continue

        csv_portal = row.get("portal", "company_website").strip() or "company_website"
        url = (row.get("tightened_link") or row.get("current_link") or "").strip()
        if not url:
            continue

        portal = detect_portal(url, csv_portal)
        board_token = extract_board_token(url, portal)
        sector = row.get("sector", "").strip()

        # Build unique id
        base_id = slugify(company)
        uid = base_id
        n = 1
        while uid in seen_ids:
            uid = f"{base_id}_{n}"
            n += 1
        seen_ids.add(uid)

        configs.append({
            "id": uid,
            "company": company,
            "portal": portal,
            "board_url": url,
            "board_token": board_token,
            "enabled": True,
            "default_location": None,
            "default_industries": [sector] if sector else [],
            "notes": row.get("note", "").strip(),
        })

    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(configs, indent=2, ensure_ascii=False), encoding="utf-8")

    # Stats
    portal_counts: dict[str, int] = {}
    for c in configs:
        portal_counts[c["portal"]] = portal_counts.get(c["portal"], 0) + 1

    print(f"Wrote {len(configs)} sources → {out_path}")
    for p, n in sorted(portal_counts.items(), key=lambda x: -x[1]):
        print(f"  {p:<20} {n}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert careers CSV to JSON source config")
    parser.add_argument("--csv", required=True, help="Path to CSV file")
    parser.add_argument("--out", default="scraper/career-page-links.json", help="Output JSON path")
    args = parser.parse_args()
    convert(args.csv, args.out)


if __name__ == "__main__":
    main()
