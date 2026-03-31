import fs from "node:fs";
import path from "node:path";

function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
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

async function resolveBaseUrl(explicitBaseUrl) {
  if (explicitBaseUrl) return explicitBaseUrl.replace(/\/$/, "");
  for (const candidate of ["http://127.0.0.1:3000", "http://127.0.0.1:3001"]) {
    try {
      const response = await fetch(candidate, { method: "HEAD" });
      if (response.ok || response.status < 500) return candidate;
    } catch {}
  }
  return "http://127.0.0.1:3000";
}

async function main() {
  const envFile = loadDotEnvFile(path.join(process.cwd(), ".env.local"));
  const workerSecret =
    process.env.APPLY_QUEUE_WORKER_SECRET ||
    envFile.APPLY_QUEUE_WORKER_SECRET ||
    "";
  const explicitBaseUrl =
    process.env.TWIN_BASE_URL ||
    envFile.TWIN_BASE_URL ||
    "";

  if (!workerSecret) {
    throw new Error("Missing APPLY_QUEUE_WORKER_SECRET.");
  }

  const baseUrl = await resolveBaseUrl(explicitBaseUrl);
  const response = await fetch(`${baseUrl}/api/internal/followups/send-daily`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${workerSecret}`,
      "Content-Type": "application/json",
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Daily follow-up route returned ${response.status}`);
  }

  console.log(
    `[Twin followups] sent=${payload.sent ?? 0} skipped=${payload.skipped ?? 0}`
  );
  if (Array.isArray(payload.errors)) {
    for (const error of payload.errors) {
      console.log(`[Twin followups] error=${error}`);
    }
  }
}

main().catch((error) => {
  console.error(
    "[Twin followups] failed:",
    error instanceof Error ? error.message : String(error)
  );
  process.exitCode = 1;
});
