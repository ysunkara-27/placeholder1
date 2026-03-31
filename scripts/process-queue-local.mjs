import fs from "node:fs";
import path from "node:path";

function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const contents = fs.readFileSync(filePath, "utf8");
  const env = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalsIndex = line.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

function resolveConfig() {
  const cwd = process.cwd();
  const envFile = loadDotEnvFile(path.join(cwd, ".env.local"));
  const workerSecret =
    process.env.APPLY_QUEUE_WORKER_SECRET ||
    process.env.TWIN_WORKER_SECRET ||
    envFile.APPLY_QUEUE_WORKER_SECRET ||
    envFile.TWIN_WORKER_SECRET ||
    "";
  const explicitBaseUrl =
    process.env.TWIN_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    envFile.TWIN_BASE_URL ||
    "";
  const maxRuns = Math.max(
    1,
    Number.parseInt(process.env.TWIN_MAX_RUNS || "3", 10) || 3
  );

  if (!workerSecret) {
    throw new Error(
      "Missing APPLY_QUEUE_WORKER_SECRET. Add it to .env.local or export it before running the local queue worker."
    );
  }

  return {
    explicitBaseUrl: explicitBaseUrl.replace(/\/$/, ""),
    workerSecret,
    maxRuns,
  };
}

async function resolveBaseUrl(explicitBaseUrl) {
  if (explicitBaseUrl) {
    return explicitBaseUrl;
  }

  const candidates = ["http://127.0.0.1:3000", "http://127.0.0.1:3001"];

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, { method: "HEAD" });
      if (response.ok || response.status < 500) {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  return candidates[0];
}

async function processQueueRun(baseUrl, workerSecret, attempt) {
  const response = await fetch(`${baseUrl}/api/internal/apply-queue/process`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${workerSecret}`,
      "Content-Type": "application/json",
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || `Queue worker returned ${response.status}`);
  }

  const label = payload.application?.id || payload.run_id || `attempt-${attempt}`;
  console.log(
    `[Twin queue] ${label}: processed=${Boolean(payload.processed)} status=${payload.status ?? "none"} portal=${payload.portal ?? "none"}`
  );

  if (payload.error) {
    console.log(`[Twin queue] ${label}: error=${payload.error}`);
  }

  return payload;
}

async function main() {
  const { explicitBaseUrl, workerSecret, maxRuns } = resolveConfig();
  const baseUrl = await resolveBaseUrl(explicitBaseUrl);

  console.log(`[Twin queue] base=${baseUrl} max_runs=${maxRuns}`);

  for (let attempt = 1; attempt <= maxRuns; attempt += 1) {
    const payload = await processQueueRun(baseUrl, workerSecret, attempt);
    if (!payload.processed) {
      console.log("[Twin queue] no queued applications remaining");
      return;
    }
  }

  console.log("[Twin queue] reached max_runs; run again to continue draining the queue");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "fetch failed") {
    console.error(
      "[Twin queue] failed: could not reach the Twin app. Start `npm run dev` first or set TWIN_BASE_URL to your deployed app URL."
    );
  } else {
    console.error("[Twin queue] failed:", message);
  }
  process.exitCode = 1;
});
