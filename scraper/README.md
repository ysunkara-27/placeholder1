# Job Scraper

Standalone scraper that pulls internship/new-grad listings from 180+ companies and ingests them into the Twin app via `/api/jobs/ingest`.

**Adapters:**
- **Greenhouse** — public JSON API, no AI needed
- **Lever** — public JSON API, no AI needed
- **Gemini** — fetches HTML, strips to text, asks Gemini to extract listings (used for company_website, workday, etc.)

---

## Setup

```bash
# From repo root — create venv if you haven't already
python3 -m venv .venv
source .venv/bin/activate

# Install scraper dependencies
pip install -r scraper/requirements.txt
```

---

## Required env vars

```bash
export GEMINI_API_KEY=...           # from aistudio.google.com/app/apikey
export SUPABASE_URL=...             # https://xxxx.supabase.co
# or reuse the app env name:
export NEXT_PUBLIC_SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=... # service_role key from Supabase project settings
```

---

## Run commands

All commands are run from the **repo root**.

### Greenhouse + Lever only (fast, no AI)

```bash
./.venv/bin/python -m scraper.run_scrape \
  --sources-file scraper/career-page-links.json \
  --skip-gemini \
  --base-url "" \
  --worker-secret ""
```

~184 sources, takes ~5-10 min. Good first run to verify the pipeline works.

### Full run (Greenhouse + Lever + Gemini for company pages)

```bash
./.venv/bin/python -m scraper.run_scrape \
  --sources-file scraper/career-page-links.json \
  --base-url "" \
  --worker-secret ""
```

Uses `GEMINI_API_KEY` from env automatically. Keep your laptop awake (`caffeinate -t 7200 &`).

### Scrape only — save to file, no ingest

```bash
./.venv/bin/python -m scraper.run_scrape \
  --sources-file scraper/career-page-links.json \
  --scrape-only \
  --output-file /tmp/scraped-jobs.json
```

### Filter to one company or portal

```bash
# Single company
./.venv/bin/python -m scraper.run_scrape \
  --sources-file scraper/career-page-links.json \
  --company "Stripe" \
  --scrape-only \
  --output-file /tmp/stripe.json

# All greenhouse sources
./.venv/bin/python -m scraper.run_scrape \
  --sources-file scraper/career-page-links.json \
  --portal greenhouse \
  --skip-gemini \
  --base-url "" \
  --worker-secret ""
```

---

## All flags

| Flag | Default | Description |
|---|---|---|
| `--sources-file` | `career-page-links.json` | Path to source config JSON |
| `--base-url` | `$TWIN_BASE_URL` | Twin app URL for ingest |
| `--worker-secret` | `$TWIN_WORKER_SECRET` | Bearer token for `/api/jobs/ingest` |
| `--gemini-key` | `$GEMINI_API_KEY` | Gemini API key |
| `--gemini-model` | `gemini-2.0-flash` | Gemini model to use |
| `--portal` | — | Filter to one portal (greenhouse, lever, company_website) |
| `--company` | — | Filter to one company name |
| `--limit` | — | Max number of sources to process |
| `--concurrency` | 20 | Ingest concurrency |
| `--scrape-only` | off | Scrape but don't ingest (requires `--output-file`) |
| `--output-file` | — | Save scraped jobs JSON to this path |
| `--skip-gemini` | off | Only run Greenhouse + Lever |
| `--all` | off | Include disabled sources |

---

## Verify data landed

In Supabase SQL editor:

```sql
SELECT source, count(*) FROM jobs GROUP BY source ORDER BY count DESC;
```

Ingest is idempotent — re-running won't create duplicates.

Direct Supabase ingest also works. `scraper/ingest_jobs.py` will accept either
`SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`, plus `SUPABASE_SERVICE_ROLE_KEY`.

---

## Updating the source list

The master source list lives in `scraper/careers_links_master_plus_800_1540_live_verified_batch.csv`.
After editing or replacing the CSV, regenerate the JSON with:

```bash
./.venv/bin/python -m scraper.csv_to_json \
  --csv scraper/careers_links_master_plus_800_1540_live_verified_batch.csv \
  --out scraper/career-page-links.json
```

The converter auto-detects the real portal from each URL (handles mismatches like Ashby URLs
tagged as Greenhouse) and extracts `board_token` for Greenhouse and Lever sources.

---

## Structure

```
scraper/
  sources/
    base.py            — SourceConfig, ScrapeResult, BaseSource
    common.py          — is_early_career, infer_level, dedupe_by_url, etc.
    registry.py        — SOURCES dict + load_source_configs()
    greenhouse.py      — Greenhouse JSON API adapter
    lever.py           — Lever JSON API adapter
    gemini_scraper.py  — Gemini HTML scraper adapter
    handshake.py       — scaffold (disabled)
    workday.py         — scaffold (disabled)
  ingest_jobs.py       — async batch ingest via /api/jobs/ingest
  run_scrape.py        — main CLI entry point
  career-page-links.json — 1540 source configs (generated from CSV)
  careers_links_master_plus_800_1540_live_verified_batch.csv — master source list
  csv_to_json.py         — converts CSV → career-page-links.json
  requirements.txt
  README.md
```
