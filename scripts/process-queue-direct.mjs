import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

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
    applyEngineTimeoutMs: Number.parseInt(
      process.env.APPLY_ENGINE_TIMEOUT_MS ||
        envFile.APPLY_ENGINE_TIMEOUT_MS ||
        "240000",
      10
    ),
    applyEngineGreenhouseTimeoutMs: Number.parseInt(
      process.env.APPLY_ENGINE_GREENHOUSE_TIMEOUT_MS ||
        envFile.APPLY_ENGINE_GREENHOUSE_TIMEOUT_MS ||
        "420000",
      10
    ),
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

  try {
    result = await fetchApplySubmitWithRetry(
      env.applyEngineBaseUrl,
      timeoutMs,
      requestPayload
    );
    runId = await persistRun(supabase, claimed, requestPayload, result, result.error || null);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process queued application";
    result = buildFailureResult(requestPayload, message);
    runId = await persistRun(supabase, claimed, requestPayload, result, message);
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

main().catch((error) => {
  console.error("[Twin direct queue] failed:", formatError(error));
  process.exitCode = 1;
});
