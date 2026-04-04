/**
 * smoke-test.mjs — fast sanity check, no browser, no Supabase needed.
 *
 * Calls /plan (dry_run) on the apply engine with a minimal fake profile.
 * Returns in < 5 seconds. Use this to verify the engine is wired up correctly
 * before doing a real queue run.
 *
 * Usage:
 *   node scripts/smoke-test.mjs                          # tests Lever (fast)
 *   node scripts/smoke-test.mjs --portal greenhouse      # tests Greenhouse
 *   node scripts/smoke-test.mjs --url <apply_url>        # tests any URL
 *   node scripts/smoke-test.mjs --engine http://host:8000
 */
import fs from "node:fs";
import path from "node:path";

function loadDotEnv() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const eq = line.indexOf("=");
    if (eq <= 0 || line.startsWith("#")) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = loadDotEnv();
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : null;
};

const engineUrl = flag("--engine") || process.env.APPLY_ENGINE_BASE_URL || env.APPLY_ENGINE_BASE_URL || "http://127.0.0.1:8000";
const portal    = flag("--portal") || "lever";

const URLS = {
  greenhouse: "https://job-boards.greenhouse.io/scaleai/jobs/4677519005",
  lever:      "https://jobs.lever.co/solopulseco/e430dd0f-8a73-46ec-8aea-739e1a5c1f9c/apply",
  ashby:      "https://jobs.ashbyhq.com/openai/abc123",
};

const targetUrl = flag("--url") || URLS[portal] || URLS.lever;

const profile = {
  first_name: "Test",
  last_name: "User",
  email: "test@example.com",
  phone: "5550001234",
  linkedin: "https://linkedin.com/in/testuser",
  resume_pdf_path: "",
  school: "State University",
  major: "Computer Science",
  gpa: "3.8",
  graduation: "May 2026",
  authorized_to_work: true,
  sponsorship_required: false,
  work_authorization: "Authorized to work in the United States",
  start_date: "June 2026",
  city: "San Francisco",
  state_region: "CA",
  country: "United States",
  eeo: {},
  custom_answers: {},
};

console.log(`\nTwin Smoke Test`);
console.log(`  engine : ${engineUrl}`);
console.log(`  portal : ${portal}`);
console.log(`  url    : ${targetUrl}`);
console.log();

// 1. Health check
process.stdout.write("  [1/2] health check ... ");
try {
  const h = await fetch(`${engineUrl}/health`, { signal: AbortSignal.timeout(5000) });
  const body = await h.json().catch(() => ({}));
  if (!h.ok || body?.status !== "ok") throw new Error(`status ${h.status}`);
  console.log("ok");
} catch (err) {
  console.log(`FAIL — ${err.message}`);
  console.log("\n  Apply engine is not running. Start it with:");
  console.log("  ./.venv/bin/uvicorn apply_engine.main:app --host 127.0.0.1 --port 8000\n");
  process.exit(1);
}

// 2. Dry-run plan (no browser launched, no application submitted)
process.stdout.write("  [2/2] dry-run plan   ... ");
try {
  const start = Date.now();
  const r = await fetch(`${engineUrl}/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: targetUrl, profile, dry_run: true }),
    signal: AbortSignal.timeout(15000),
  });
  const elapsed = Date.now() - start;
  const body = await r.json();
  if (!r.ok) throw new Error(body?.error || `HTTP ${r.status}`);

  const actionCount = Array.isArray(body.actions) ? body.actions.length : "?";
  console.log(`ok (${elapsed}ms, ${actionCount} planned actions, portal=${body.portal})`);

  if (process.env.VERBOSE || args.includes("--verbose")) {
    console.log("\n  Planned actions:");
    for (const a of body.actions || []) {
      console.log(`    ${a.action.padEnd(8)} ${a.selector?.slice(0, 60)}`);
    }
  }
} catch (err) {
  console.log(`FAIL — ${err.message}`);
  process.exit(1);
}

console.log("\n  Smoke test passed. Run a real apply with:\n");
console.log("  Queue real jobs from Browse Jobs, then run npm run process:queue:direct\n");
