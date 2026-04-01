import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

let spawnedWorker = null;

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

function getEnv() {
  const envFile = loadDotEnvFile(path.join(process.cwd(), ".env.local"));
  return {
    supabaseUrl:
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      envFile.NEXT_PUBLIC_SUPABASE_URL ||
      envFile.SUPABASE_URL ||
      "",
    serviceRoleKey:
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      envFile.SUPABASE_SERVICE_ROLE_KEY ||
      "",
    applyEngineBaseUrl:
      process.env.APPLY_ENGINE_BASE_URL ||
      envFile.APPLY_ENGINE_BASE_URL ||
      "http://127.0.0.1:8000",
    // Add 360s (6 min) confirmation window on top of normal execution budget
    applyEngineTimeoutMs:
      Number.parseInt(
        process.env.APPLY_ENGINE_TIMEOUT_MS ||
          envFile.APPLY_ENGINE_TIMEOUT_MS ||
          "240000",
        10
      ) + 360_000,
    applyEngineGreenhouseTimeoutMs:
      Number.parseInt(
        process.env.APPLY_ENGINE_GREENHOUSE_TIMEOUT_MS ||
          envFile.APPLY_ENGINE_GREENHOUSE_TIMEOUT_MS ||
          "420000",
        10
      ) + 360_000,
    maxRuns: Math.max(
      1,
      Number.parseInt(process.env.TWIN_MAX_RUNS || "3", 10) || 3
    ),
  };
}

function ensureEnv(value, label) {
  if (!value) {
    throw new Error(`Missing ${label}. Add it to .env.local before processing the queue.`);
  }
  return value;
}

function formatError(error) {
  if (error instanceof Error) {
    if (error.cause instanceof Error) {
      return `${error.message}: ${error.cause.message}`;
    }
    return error.message;
  }

  if (error && typeof error === "object") {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return String(error);
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function isApplyEngineHealthy(baseUrl, timeoutMs = 3000) {
  try {
    const response = await fetchWithTimeout(`${baseUrl}/health`, timeoutMs);
    if (!response.ok) {
      return false;
    }
    const payload = await response.json().catch(() => ({}));
    return payload && typeof payload === "object" && payload.status === "ok";
  } catch {
    return false;
  }
}

function shouldSelfManageWorker(baseUrl) {
  try {
    const url = new URL(baseUrl);
    return ["127.0.0.1", "localhost"].includes(url.hostname);
  } catch {
    return false;
  }
}

function cleanupSpawnedWorker() {
  if (!spawnedWorker || spawnedWorker.killed) {
    return;
  }

  try {
    spawnedWorker.kill("SIGTERM");
  } catch {}
}

async function ensureApplyEngineHealthy(env, forceRestart = false) {
  if (!forceRestart && (await isApplyEngineHealthy(env.applyEngineBaseUrl))) {
    return;
  }

  if (!shouldSelfManageWorker(env.applyEngineBaseUrl)) {
    throw new Error(
      `Apply engine is not healthy at ${env.applyEngineBaseUrl} and cannot be auto-started`
    );
  }

  if (forceRestart && spawnedWorker && !spawnedWorker.killed) {
    cleanupSpawnedWorker();
    spawnedWorker = null;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (!spawnedWorker || spawnedWorker.killed) {
    const workerBinary = path.join(process.cwd(), ".venv", "bin", "uvicorn");
    spawnedWorker = spawn(
      workerBinary,
      ["apply_engine.main:app", "--host", "127.0.0.1", "--port", "8000"],
      {
        cwd: process.cwd(),
        stdio: "ignore",
      }
    );
  }

  const readyDeadline = Date.now() + 15_000;
  while (Date.now() < readyDeadline) {
    if (await isApplyEngineHealthy(env.applyEngineBaseUrl)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  throw new Error(`Apply engine did not become healthy at ${env.applyEngineBaseUrl}`);
}

function nowIso() {
  return new Date().toISOString();
}

function isoMinutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function detectPortalFromUrl(url) {
  const normalized = String(url || "").toLowerCase();
  if (normalized.includes("greenhouse.io")) return "greenhouse";
  if (normalized.includes("lever.co")) return "lever";
  if (normalized.includes("myworkdayjobs.com") || normalized.includes("wd1.myworkday")) {
    return "workday";
  }
  if (normalized.includes("ashbyhq.com")) return "ashby";
  if (normalized.includes("joinhandshake.com") || normalized.includes("handshake")) {
    return "handshake";
  }
  return "vision";
}

function normalizeUrl(value) {
  return typeof value === "string" ? value : "";
}

function buildFailureResult(requestPayload, error) {
  const url =
    requestPayload &&
    typeof requestPayload === "object" &&
    "url" in requestPayload
      ? normalizeUrl(requestPayload.url)
      : "";

  return {
    portal: detectPortalFromUrl(url),
    status: "failed",
    confirmation_snippet: "",
    actions: [],
    error,
    screenshots: [],
    inferred_answers: [],
    unresolved_questions: [],
    recovery_attempted: false,
    recovery_family: null,
  };
}

function extractConfirmationText(result) {
  const confirmation = String(result.confirmation_snippet || result.error || "").trim();
  return confirmation || null;
}

function buildCompletionUpdate(result, runId) {
  const completedAt = nowIso();

  if (result.status === "applied") {
    return {
      status: "applied",
      confirmation_text: extractConfirmationText(result),
      last_error: null,
      applied_at: completedAt,
      completed_at: completedAt,
      last_run_id: runId,
    };
  }

  if (result.status === "requires_auth") {
    return {
      status: "requires_auth",
      confirmation_text: extractConfirmationText(result),
      last_error: result.error || "Authentication required before submission",
      completed_at: completedAt,
      last_run_id: runId,
    };
  }

  // Cancelled by user — leave the status as-is (already set by confirm/cancel APIs)
  // but record the run and close out completed_at.
  if (result.status === "cancelled" || result.status === "confirmation_timeout") {
    return {
      confirmation_text: extractConfirmationText(result),
      last_error: result.error || null,
      completed_at: completedAt,
      last_run_id: runId,
    };
  }

  return {
    status: "failed",
    confirmation_text: extractConfirmationText(result),
    last_error: result.error || "Queued apply attempt failed",
    completed_at: completedAt,
    last_run_id: runId,
  };
}

function formatPreviewList(values, limit = 3) {
  if (!Array.isArray(values) || values.length === 0) {
    return "";
  }

  return values
    .slice(0, limit)
    .map((value) => String(value).trim())
    .filter(Boolean)
    .join(" | ");
}

async function fetchApplySubmit(baseUrl, timeoutMs, requestPayload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/apply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...requestPayload, dry_run: false }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `Apply engine returned ${response.status}`);
    }
    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Apply engine apply request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchApplySubmitWithRetry(baseUrl, timeoutMs, requestPayload) {
  const attempts = 2;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchApplySubmit(baseUrl, timeoutMs, requestPayload);
    } catch (error) {
      lastError = error;

      const message = formatError(error).toLowerCase();
      const shouldRetry =
        attempt < attempts &&
        (message.includes("fetch failed") ||
          message.includes("econnrefused") ||
          message.includes("socket hang up") ||
          message.includes("network"));

      if (!shouldRetry) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  throw lastError ?? new Error("Unknown apply engine fetch failure");
}

function resolvePortalAwareTimeoutMs(env, requestPayload) {
  const url =
    requestPayload &&
    typeof requestPayload === "object" &&
    "url" in requestPayload
      ? normalizeUrl(requestPayload.url).toLowerCase()
      : "";

  if (url.includes("greenhouse.io")) {
    return env.applyEngineGreenhouseTimeoutMs;
  }

  return env.applyEngineTimeoutMs;
}

async function persistRun(supabase, claimed, requestPayload, result, errorMessage) {
  const inserted = await supabase
    .from("apply_runs")
    .insert({
      user_id: claimed.user_id,
      job_id: claimed.job_id,
      mode: "submit",
      url: normalizeUrl(requestPayload.url),
      portal: result.portal,
      status: result.status,
      request_payload: requestPayload,
      result_payload: result,
      error: errorMessage || result.error || null,
    })
    .select("id")
    .single();

  if (inserted.error) {
    console.error("[Twin direct queue] failed to persist apply run:", inserted.error.message);
    return null;
  }

  return inserted.data.id;
}

async function claimNextQueuedApplication(supabase) {
  const { data, error } = await supabase.rpc("claim_next_application", {
    p_worker_id: "direct-worker",
    p_user_id: null,
  });

  if (error) {
    throw error;
  }

  return data?.[0] ?? null;
}

async function reclaimStaleRunningApplications(supabase, staleMinutes = 20) {
  const cutoff = isoMinutesAgo(staleMinutes);
  const { data, error } = await supabase
    .from("applications")
    .update({
      status: "queued",
      queued_at: nowIso(),
      started_at: null,
      worker_id: null,
      last_error: "Reclaimed after stale running state",
    })
    .eq("status", "running")
    .eq("worker_id", "direct-worker")
    .lt("started_at", cutoff)
    .select("id");

  if (error) {
    throw error;
  }

  return data?.length ?? 0;
}

async function processQueueRun(supabase, env, attempt) {
  const claimed = await claimNextQueuedApplication(supabase);

  if (!claimed) {
    console.log("[Twin direct queue] no queued applications remaining");
    return false;
  }

  const requestPayload = claimed.request_payload;
  let result;
  let runId = null;
  const timeoutMs = resolvePortalAwareTimeoutMs(env, requestPayload);

  console.log(
    `[Twin direct queue] ${claimed.id}: portal=${detectPortalFromUrl(normalizeUrl(requestPayload?.url))} timeout_ms=${timeoutMs} attempt=${attempt}`
  );

  // Fetch portal accounts (stored credentials) fresh from the DB.
  // These are NOT stored in request_payload to keep passwords out of the DB.
  let portalAccounts = {};
  try {
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("portal_accounts")
      .eq("id", claimed.user_id)
      .maybeSingle();
    portalAccounts = profileRow?.portal_accounts ?? {};
  } catch {
    // Non-fatal — proceed without portal credentials
  }

  // Enrich payload with application_id, Supabase credentials (for live logs +
  // confirmation gate), and portal_accounts (for auth-wall auto-login).
  const enrichedPayload = {
    ...requestPayload,
    application_id: claimed.id,
    supabase_url: env.supabaseUrl,
    supabase_key: env.serviceRoleKey,
    profile: {
      ...(requestPayload.profile ?? {}),
      portal_accounts: portalAccounts,
    },
  };

  try {
    await ensureApplyEngineHealthy(env);
    result = await fetchApplySubmitWithRetry(
      env.applyEngineBaseUrl,
      timeoutMs,
      enrichedPayload
    );
    runId = await persistRun(supabase, claimed, requestPayload, result, result.error || null);
  } catch (error) {
    const message = formatError(error).toLowerCase();
    const shouldRestartWorker =
      shouldSelfManageWorker(env.applyEngineBaseUrl) &&
      (message.includes("fetch failed") ||
        message.includes("econnrefused") ||
        message.includes("socket hang up") ||
        message.includes("network"));

    if (shouldRestartWorker) {
      await ensureApplyEngineHealthy(env, true);
      try {
        result = await fetchApplySubmit(
          env.applyEngineBaseUrl,
          timeoutMs,
          enrichedPayload
        );
        runId = await persistRun(supabase, claimed, requestPayload, result, result.error || null);
      } catch (retryError) {
        const retryMessage =
          retryError instanceof Error
            ? retryError.message
            : "Failed to process queued application";
        result = buildFailureResult(requestPayload, retryMessage);
        runId = await persistRun(supabase, claimed, requestPayload, result, retryMessage);
      }
    } else {
      const message =
        error instanceof Error ? error.message : "Failed to process queued application";
      result = buildFailureResult(requestPayload, message);
      runId = await persistRun(supabase, claimed, requestPayload, result, message);
    }
  }

  const updated = await supabase
    .from("applications")
    .update(buildCompletionUpdate(result, runId))
    .eq("id", claimed.id)
    .select("id, status")
    .single();

  if (updated.error) {
    throw updated.error;
  }

  console.log(
    `[Twin direct queue] ${updated.data.id}: processed=true status=${updated.data.status} portal=${result.portal}`
  );
  if (Array.isArray(result.inferred_answers) && result.inferred_answers.length > 0) {
    console.log(
      `[Twin direct queue] ${updated.data.id}: inferred_answers=${result.inferred_answers.length} preview=${formatPreviewList(result.inferred_answers)}`
    );
  }
  if (Array.isArray(result.unresolved_questions) && result.unresolved_questions.length > 0) {
    console.log(
      `[Twin direct queue] ${updated.data.id}: unresolved_questions=${result.unresolved_questions.length} preview=${formatPreviewList(result.unresolved_questions)}`
    );
  }
  if (result.recovery_attempted) {
    console.log(
      `[Twin direct queue] ${updated.data.id}: recovery_family=${result.recovery_family || "unknown"}`
    );
  }
  if (result.error) {
    console.log(`[Twin direct queue] ${updated.data.id}: error=${result.error}`);
  }

  return true;
}

async function main() {
  const env = getEnv();
  const supabase = createClient(
    ensureEnv(env.supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL"),
    ensureEnv(env.serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY")
  );

  console.log(
    `[Twin direct queue] engine=${env.applyEngineBaseUrl} timeout_ms=${env.applyEngineTimeoutMs} greenhouse_timeout_ms=${env.applyEngineGreenhouseTimeoutMs} max_runs=${env.maxRuns}`
  );

  await ensureApplyEngineHealthy(env);

  const reclaimed = await reclaimStaleRunningApplications(supabase);
  if (reclaimed > 0) {
    console.log(`[Twin direct queue] reclaimed ${reclaimed} stale running application(s)`);
  }

  for (let attempt = 1; attempt <= env.maxRuns; attempt += 1) {
    const processed = await processQueueRun(supabase, env, attempt);
    if (!processed) {
      return;
    }
  }

  console.log("[Twin direct queue] reached max_runs; run again to continue draining the queue");
}

process.on("exit", cleanupSpawnedWorker);
process.on("SIGINT", () => {
  cleanupSpawnedWorker();
  process.exit(130);
});
process.on("SIGTERM", () => {
  cleanupSpawnedWorker();
  process.exit(143);
});

main().catch((error) => {
  console.error("[Twin direct queue] failed:", formatError(error));
  process.exitCode = 1;
});
