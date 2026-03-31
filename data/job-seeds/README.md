# Live Job Seeds

These are current public ATS job URLs captured to bootstrap parser and apply-engine work.

## Why these seeds

- They are live public posting URLs
- They cover the first two ATS targets: Greenhouse and Lever
- They are enough to start portal detection, HTML inspection, and Playwright fixture design

## File

- `live-openings-2026.json`
- `vetted-live-mvp.json`

## Vetted MVP set

Use `vetted-live-mvp.json` for real apply-engine testing.

- It contains the smaller set of live postings we want to run repeatedly while
  hardening the MVP
- It is the source for `/apply-lab`
- It should stay small and high-signal
- Add a posting there only after it has been manually opened and confirmed to
  still expose a public apply flow

## Next step

For each URL:

1. download the raw HTML snapshot
2. save a cleaned DOM fixture
3. record field selectors and upload behavior
4. turn that into deterministic portal-agent tests
