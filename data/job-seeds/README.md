# Live Job Seeds

These are current public ATS job URLs captured to bootstrap parser and apply-engine work.

## Why these seeds

- They are live public posting URLs
- They cover the first two ATS targets: Greenhouse and Lever
- They are enough to start portal detection, HTML inspection, and Playwright fixture design

## File

- `live-openings-2026.json`

## Next step

For each URL:

1. download the raw HTML snapshot
2. save a cleaned DOM fixture
3. record field selectors and upload behavior
4. turn that into deterministic portal-agent tests
