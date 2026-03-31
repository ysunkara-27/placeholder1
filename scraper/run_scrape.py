"""
run_scrape.py — Manual full-stack scrape runner with live progress bars.

Reads career-page-links.json (or any sources file), scrapes all enabled
sources using the right adapter (Greenhouse, Lever, or Gemini for everything
else), then ingests results into Twin via /api/jobs/ingest.

Usage:
    ./.venv/bin/python -m scraper.run_scrape \\
        --sources-file scraper/career-page-links.json \\
        --base-url https://your-app.vercel.app \\
        --worker-secret YOUR_SECRET

    # Scrape only (no ingest):
    ./.venv/bin/python -m scraper.run_scrape \\
        --sources-file scraper/career-page-links.json \\
        --scrape-only \\
        --output-file /tmp/scraped-jobs.json

    # Only run deterministic adapters (no Gemini):
    ./.venv/bin/python -m scraper.run_scrape \\
        --sources-file scraper/career-page-links.json \\
        --skip-gemini \\
        --base-url ... --worker-secret ...

    # Filter to a portal or company:
    ./.venv/bin/python -m scraper.run_scrape \\
        --portal greenhouse \\
        --company "Stripe" ...

Env vars (alternative to flags):
    TWIN_BASE_URL, TWIN_WORKER_SECRET, GEMINI_API_KEY
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from pathlib import Path

import httpx

try:
    from tqdm import tqdm
    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False

from scraper.ingest_jobs import process_batch
from scraper.sources.base import SourceConfig
from scraper.sources.registry import SOURCES, get_source, load_source_configs

# Portals that have real deterministic adapters
DETERMINISTIC_PORTALS = {"greenhouse", "lever"}


def _print_banner(n_enabled: int, n_greenhouse: int, n_lever: int, n_gemini: int) -> None:
    print()
    print("=" * 60)
    print("  Twin Scraper — Full Stack Run")
    print("=" * 60)
    print(f"  Sources enabled : {n_enabled}")
    print(f"    Greenhouse     : {n_greenhouse}")
    print(f"    Lever          : {n_lever}")
    print(f"    Gemini (other) : {n_gemini}")
    print("=" * 60)
    print()


def _simple_progress(current: int, total: int, label: str = "", width: int = 40) -> str:
    """Fallback progress bar when tqdm is not available."""
    filled = int(width * current / max(total, 1))
    bar = "█" * filled + "░" * (width - filled)
    return f"\r[{bar}] {current}/{total} {label}"


def scrape_all(
    configs: list[SourceConfig],
    gemini_key: str | None,
    gemini_model: str,
    skip_gemini: bool,
    http_client: httpx.Client,
) -> tuple[list[dict], dict]:
    """Scrape all configs, return (all_jobs, diagnostics)."""
    from scraper.sources.gemini_scraper import GeminiSource

    gemini_adapter = GeminiSource(api_key=gemini_key, model=gemini_model)

    all_jobs: list[dict] = []
    sources_attempted = 0
    sources_succeeded = 0
    sources_skipped = 0
    total_fetched = 0
    total_emitted = 0
    interrupted = False

    iterator = (
        tqdm(configs, desc="Scraping", unit="source", ncols=80)
        if HAS_TQDM
        else configs
    )

    for idx, config in enumerate(iterator):
        portal = config.portal

        # Pick adapter
        if portal in DETERMINISTIC_PORTALS:
            adapter = get_source(portal)
        elif skip_gemini:
            sources_skipped += 1
            if HAS_TQDM:
                iterator.set_postfix({"skipped": sources_skipped}, refresh=False)
            else:
                print(f"  [SKIP] {config.company} ({portal}) — Gemini disabled")
            continue
        else:
            if not gemini_key:
                sources_skipped += 1
                print(
                    f"  [SKIP] {config.company} — no GEMINI_API_KEY",
                    file=sys.stderr,
                )
                continue
            adapter = gemini_adapter

        if adapter is None:
            sources_skipped += 1
            continue

        sources_attempted += 1

        if not HAS_TQDM:
            print(f"  [{idx + 1}/{len(configs)}] {config.company} ({portal})")

        try:
            result = adapter.scrape(config, http_client)
        except KeyboardInterrupt:
            interrupted = True
            print(
                f"\n[WARN] Interrupted while scraping {config.id}. Returning partial results.",
                file=sys.stderr,
            )
            break

        for err in result.errors:
            print(f"\n  [ERROR] {config.id}: {err}", file=sys.stderr)
        for warn in result.warnings:
            print(f"\n  [WARN] {config.id}: {warn}", file=sys.stderr)

        if not result.errors:
            sources_succeeded += 1

        total_fetched += result.fetched
        total_emitted += result.emitted
        all_jobs.extend(result.jobs)

        if HAS_TQDM:
            iterator.set_postfix(
                {
                    "jobs": total_emitted,
                    "ok": sources_succeeded,
                    "err": sources_attempted - sources_succeeded,
                },
                refresh=True,
            )
        else:
            msg = (
                f"    → fetched={result.fetched} emitted={result.emitted}"
            )
            if result.errors:
                msg += f" ERRORS={len(result.errors)}"
            print(msg)

    diagnostics = {
        "sources_attempted": sources_attempted,
        "sources_succeeded": sources_succeeded,
        "sources_skipped": sources_skipped,
        "total_fetched": total_fetched,
        "total_emitted": total_emitted,
        "interrupted": interrupted,
    }
    return all_jobs, diagnostics


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scrape all sources and ingest into Twin"
    )
    parser.add_argument(
        "--sources-file",
        default="career-page-links.json",
        help="Path to source config JSON (default: career-page-links.json)",
    )
    parser.add_argument(
        "--base-url",
        default=os.environ.get("TWIN_BASE_URL", ""),
        help="Twin app base URL (env: TWIN_BASE_URL)",
    )
    parser.add_argument(
        "--worker-secret",
        default=os.environ.get("TWIN_WORKER_SECRET", ""),
        help="Worker bearer token (env: TWIN_WORKER_SECRET)",
    )
    parser.add_argument(
        "--gemini-key",
        default=os.environ.get("GEMINI_API_KEY", ""),
        help="Gemini API key for non-deterministic sources (env: GEMINI_API_KEY)",
    )
    parser.add_argument(
        "--gemini-model",
        default="gemini-2.5-flash",
        help="Gemini model to use (default: gemini-2.5-flash)",
    )
    parser.add_argument(
        "--portal",
        default=None,
        help="Filter to this portal only (e.g. greenhouse, lever, company_website)",
    )
    parser.add_argument(
        "--company",
        default=None,
        help="Filter to this company name (case-insensitive)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Max number of sources to process",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=20,
        help="Ingest concurrency (default: 20)",
    )
    parser.add_argument(
        "--scrape-only",
        action="store_true",
        help="Scrape but do not ingest — requires --output-file",
    )
    parser.add_argument(
        "--output-file",
        default=None,
        help="Save scraped jobs JSON to this path (also works alongside ingest)",
    )
    parser.add_argument(
        "--skip-gemini",
        action="store_true",
        help="Only run Greenhouse and Lever adapters; skip all others",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Process all entries, including disabled ones",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if not HAS_TQDM:
        print("[WARN] tqdm not installed — install it for a nicer progress bar: pip install tqdm")

    if args.scrape_only and not args.output_file:
        raise SystemExit("--scrape-only requires --output-file")

    if not args.scrape_only:
        if not args.base_url:
            raise SystemExit("--base-url or TWIN_BASE_URL is required (unless --scrape-only)")
        if not args.worker_secret:
            raise SystemExit("--worker-secret or TWIN_WORKER_SECRET is required (unless --scrape-only)")

    # Load and filter sources
    configs = load_source_configs(args.sources_file)

    if not args.all:
        configs = [c for c in configs if c.enabled]

    if args.portal:
        configs = [c for c in configs if c.portal == args.portal]

    if args.company:
        configs = [c for c in configs if c.company.lower() == args.company.lower()]

    if args.limit:
        configs = configs[: args.limit]

    if not configs:
        raise SystemExit("No sources matched your filters. Try --all to include disabled sources.")

    # Stats breakdown
    n_det = sum(1 for c in configs if c.portal in DETERMINISTIC_PORTALS)
    n_gh = sum(1 for c in configs if c.portal == "greenhouse")
    n_lv = sum(1 for c in configs if c.portal == "lever")
    n_gemini = len(configs) - n_det

    _print_banner(len(configs), n_gh, n_lv, 0 if args.skip_gemini else n_gemini)

    gemini_key = args.gemini_key or None

    if n_gemini > 0 and not args.skip_gemini:
        if not gemini_key:
            print(
                f"[WARN] {n_gemini} sources need Gemini but GEMINI_API_KEY is not set. "
                "They will be skipped. Pass --gemini-key or set GEMINI_API_KEY.",
                file=sys.stderr,
            )

    # Phase 1: Scrape
    t0 = time.time()
    with httpx.Client(
        timeout=25.0,
        follow_redirects=True,
        headers={
            "User-Agent": "Mozilla/5.0 (Twin job scraper)",
            "Accept": "application/json, text/plain, */*",
        },
    ) as http_client:
        all_jobs, diagnostics = scrape_all(
            configs=configs,
            gemini_key=gemini_key,
            gemini_model=args.gemini_model,
            skip_gemini=args.skip_gemini,
            http_client=http_client,
        )

    scrape_elapsed = time.time() - t0

    print()
    print("─" * 60)
    print(f"  Scrape complete ({scrape_elapsed:.1f}s)")
    print(f"  Sources attempted : {diagnostics['sources_attempted']}")
    print(f"  Sources succeeded : {diagnostics['sources_succeeded']}")
    print(f"  Sources skipped   : {diagnostics['sources_skipped']}")
    print(f"  Jobs fetched raw  : {diagnostics['total_fetched']}")
    print(f"  Jobs emitted      : {diagnostics['total_emitted']}")
    if diagnostics.get("interrupted"):
        print("  Interrupted       : yes (partial results retained)")
    print("─" * 60)
    print()

    if not all_jobs:
        print("No jobs scraped — nothing to ingest. Exiting.")
        return

    # Save output file if requested
    if args.output_file:
        output_path = Path(args.output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(
            json.dumps(all_jobs, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        print(f"  Saved {len(all_jobs)} jobs → {args.output_file}")
        print()

    if diagnostics.get("interrupted"):
        if args.scrape_only:
            print("Scrape interrupted — partial output saved.")
        else:
            print("Scrape interrupted — skipping ingest for safety.")
        return

    if args.scrape_only:
        print("--scrape-only: skipping ingest.")
        return

    # Phase 2: Ingest
    print(f"  Ingesting {len(all_jobs)} jobs → {args.base_url}/api/jobs/ingest")
    print()

    t1 = time.time()
    results = asyncio.run(
        process_batch(
            scraped_jobs=all_jobs,
            base_url=args.base_url,
            worker_secret=args.worker_secret,
            concurrency=max(args.concurrency, 1),
        )
    )
    ingest_elapsed = time.time() - t1

    successful = sum(1 for r in results if r.get("status") == "success")
    failed = sum(1 for r in results if r.get("status") == "error")

    print()
    print("─" * 60)
    print(f"  Ingest complete ({ingest_elapsed:.1f}s)")
    print(f"  Jobs ingested OK  : {successful}")
    print(f"  Jobs failed       : {failed}")
    print("─" * 60)
    print()

    total_elapsed = time.time() - t0
    print(f"  Total time: {total_elapsed:.1f}s")
    print()


if __name__ == "__main__":
    main()
