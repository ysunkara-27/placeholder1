import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchApplySubmit,
  parseApplyPlanRequest,
  type ApplyEngineResponse,
  type ApplyPlanRequest,
} from "@/lib/apply-engine";
import { persistApplyRun } from "@/lib/apply-runs";
import { detectPortalFromUrl, type PortalKind } from "@/lib/portal";
import type { Database, Json } from "@/lib/supabase/database.types";

type ApplicationRow = Database["public"]["Tables"]["applications"]["Row"];
type ApplicationInsert = Database["public"]["Tables"]["applications"]["Insert"];
type ApplicationUpdate = Database["public"]["Tables"]["applications"]["Update"];

export type QueueDisposition =
  | "queued"
  | "already_queued"
  | "already_running"
  | "already_submitted";

export interface QueueApplicationResult {
  application: ApplicationRow;
  disposition: QueueDisposition;
  portal: PortalKind;
}

export interface ProcessQueueResult {
  processed: boolean;
  application: ApplicationRow | null;
  runId: string | null;
  portal: PortalKind | null;
  status: string | null;
  error: string | null;
}

interface QueueApplicationInput {
  userId: string;
  jobId: string;
  requestPayload: ApplyPlanRequest;
}

function nowIso() {
  return new Date().toISOString();
}

function extractConfirmationText(result: ApplyEngineResponse): string | null {
  const confirmation = result.confirmation_snippet?.trim() || result.error?.trim();
  return confirmation || null;
}

function buildQueuedApplicationUpdate(
  input: QueueApplicationInput
): ApplicationInsert | ApplicationUpdate {
  return {
    user_id: input.userId,
    job_id: input.jobId,
    status: "queued",
    request_payload: input.requestPayload as Json,
    confirmation_text: null,
    last_error: null,
    queued_at: nowIso(),
    started_at: null,
    completed_at: null,
    worker_id: null,
    last_run_id: null,
    browsing_task_id: null,
    applied_at: null,
  };
}

function buildCompletionUpdate(
  result: ApplyEngineResponse,
  runId: string | null
): ApplicationUpdate {
  const completedAt = nowIso();

  if (result.status === "applied") {
    return {
      status: "submitted",
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

function normalizeUnknownUrl(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function buildFailureResult(
  requestPayload: unknown,
  error: string
): ApplyEngineResponse {
  const url =
    requestPayload &&
    typeof requestPayload === "object" &&
    "url" in requestPayload
      ? normalizeUnknownUrl(requestPayload.url)
      : "";

  return {
    portal: detectPortalFromUrl(url),
    status: "failed",
    confirmation_snippet: "",
    actions: [],
    error,
    screenshots: [],
  };
}

async function safePersistRun(
  supabase: SupabaseClient<Database>,
  input: Parameters<typeof persistApplyRun>[1]
): Promise<string | null> {
  try {
    const run = await persistApplyRun(supabase, input);
    return run.id;
  } catch (error) {
    console.error("[application-queue][persist-run]", error);
    return null;
  }
}

export async function queueApplication(
  supabase: SupabaseClient<Database>,
  input: QueueApplicationInput
): Promise<QueueApplicationResult> {
  const existing = await supabase
    .from("applications")
    .select("*")
    .eq("user_id", input.userId)
    .eq("job_id", input.jobId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  const portal = detectPortalFromUrl(input.requestPayload.url);

  if (existing.data) {
    if (existing.data.status === "queued") {
      return {
        application: existing.data,
        disposition: "already_queued",
        portal,
      };
    }

    if (existing.data.status === "running") {
      return {
        application: existing.data,
        disposition: "already_running",
        portal,
      };
    }

    if (existing.data.status === "submitted") {
      return {
        application: existing.data,
        disposition: "already_submitted",
        portal,
      };
    }

    const updated = await supabase
      .from("applications")
      .update(buildQueuedApplicationUpdate(input))
      .eq("id", existing.data.id)
      .select("*")
      .single();

    if (updated.error) {
      throw updated.error;
    }

    return {
      application: updated.data,
      disposition: "queued",
      portal,
    };
  }

  const inserted = await supabase
    .from("applications")
    .insert(buildQueuedApplicationUpdate(input) as ApplicationInsert)
    .select("*")
    .single();

  if (inserted.error) {
    throw inserted.error;
  }

  return {
    application: inserted.data,
    disposition: "queued",
    portal,
  };
}

export async function claimNextQueuedApplication(
  supabase: SupabaseClient<Database>,
  workerId: string,
  userId?: string
): Promise<ApplicationRow | null> {
  const { data, error } = await supabase.rpc("claim_next_application", {
    p_worker_id: workerId,
    p_user_id: userId ?? null,
  });

  if (error) {
    throw error;
  }

  return data?.[0] ?? null;
}

export async function processNextQueuedApplication(
  supabase: SupabaseClient<Database>,
  workerId: string,
  userId?: string
): Promise<ProcessQueueResult> {
  const claimed = await claimNextQueuedApplication(supabase, workerId, userId);

  if (!claimed) {
    return {
      processed: false,
      application: null,
      runId: null,
      portal: null,
      status: null,
      error: null,
    };
  }

  let runId: string | null = null;

  try {
    const requestPayload = parseApplyPlanRequest(claimed.request_payload);
    const result = await fetchApplySubmit(requestPayload);
    runId = await safePersistRun(supabase, {
      userId: claimed.user_id,
      jobId: claimed.job_id,
      mode: "submit",
      url: requestPayload.url,
      portal: result.portal,
      status: result.status,
      requestPayload,
      resultPayload: result,
      error: result.error,
    });

    const updated = await supabase
      .from("applications")
      .update(buildCompletionUpdate(result, runId))
      .eq("id", claimed.id)
      .select("*")
      .single();

    if (updated.error) {
      throw updated.error;
    }

    return {
      processed: true,
      application: updated.data,
      runId,
      portal: result.portal,
      status: updated.data.status,
      error: result.error || null,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to process queued application";
    const failureResult = buildFailureResult(claimed.request_payload, message);
    runId = await safePersistRun(supabase, {
      userId: claimed.user_id,
      jobId: claimed.job_id,
      mode: "submit",
      url:
        claimed.request_payload &&
        typeof claimed.request_payload === "object" &&
        "url" in claimed.request_payload
          ? normalizeUnknownUrl(claimed.request_payload.url)
          : "",
      portal: failureResult.portal,
      status: failureResult.status,
      requestPayload: claimed.request_payload,
      resultPayload: failureResult,
      error: failureResult.error,
    });

    const updated = await supabase
      .from("applications")
      .update(buildCompletionUpdate(failureResult, runId))
      .eq("id", claimed.id)
      .select("*")
      .single();

    if (updated.error) {
      throw updated.error;
    }

    return {
      processed: true,
      application: updated.data,
      runId,
      portal: failureResult.portal,
      status: updated.data.status,
      error: message,
    };
  }
}
