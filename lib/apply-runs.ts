import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type ApplyRunInsert = Database["public"]["Tables"]["apply_runs"]["Insert"];

type ActionSummary = {
  total: number;
  required: number;
  optional: number;
  by_type: Record<string, number>;
};

type ApplyRunSummary = {
  stage: "planned" | "applied" | "auth_wall" | "validation_blocked" | "failed";
  actions: ActionSummary;
  screenshot_count: number;
};

interface PersistApplyRunInput {
  userId: string;
  jobId?: string | null;
  mode: "plan" | "submit";
  url: string;
  portal?: string;
  status: string;
  requestPayload: unknown;
  resultPayload: unknown;
  error?: string;
}

function summarizeActions(resultPayload: unknown): ActionSummary {
  const actions =
    resultPayload &&
    typeof resultPayload === "object" &&
    "actions" in resultPayload &&
    Array.isArray(resultPayload.actions)
      ? resultPayload.actions
      : [];

  const summary: ActionSummary = {
    total: actions.length,
    required: 0,
    optional: 0,
    by_type: {},
  };

  for (const action of actions) {
    if (!action || typeof action !== "object") {
      continue;
    }

    const type =
      "action" in action && typeof action.action === "string"
        ? action.action
        : "unknown";
    const required =
      "required" in action && typeof action.required === "boolean"
        ? action.required
        : true;

    summary.by_type[type] = (summary.by_type[type] ?? 0) + 1;
    if (required) {
      summary.required += 1;
    } else {
      summary.optional += 1;
    }
  }

  return summary;
}

function summarizeStage(status: string, error?: string): ApplyRunSummary["stage"] {
  const normalizedError = (error ?? "").toLowerCase();

  if (status === "applied") {
    return "applied";
  }
  if (status === "unsupported") {
    return "planned";
  }
  if (status === "requires_auth") {
    return "auth_wall";
  }
  if (
    normalizedError.includes("valid") ||
    normalizedError.includes("required") ||
    normalizedError.includes("please enter") ||
    normalizedError.includes("please select")
  ) {
    return "validation_blocked";
  }
  return "failed";
}

function summarizeScreenshotCount(resultPayload: unknown): number {
  const screenshots =
    resultPayload &&
    typeof resultPayload === "object" &&
    "screenshots" in resultPayload &&
    Array.isArray(resultPayload.screenshots)
      ? resultPayload.screenshots
      : [];

  return screenshots.length;
}

function withRunSummary(
  resultPayload: unknown,
  status: string,
  error?: string
): Record<string, unknown> {
  const base =
    resultPayload && typeof resultPayload === "object" ? { ...resultPayload } : {};

  const summary: ApplyRunSummary = {
    stage: summarizeStage(status, error),
    actions: summarizeActions(resultPayload),
    screenshot_count: summarizeScreenshotCount(resultPayload),
  };

  return {
    ...base,
    summary,
  };
}

export async function persistApplyRun(
  supabase: SupabaseClient<Database>,
  input: PersistApplyRunInput
) {
  const payload: ApplyRunInsert = {
    user_id: input.userId,
    job_id: input.jobId ?? null,
    mode: input.mode,
    url: input.url,
    portal: input.portal ?? null,
    status: input.status,
    request_payload: (input.requestPayload ?? {}) as ApplyRunInsert["request_payload"],
    result_payload: withRunSummary(
      input.resultPayload,
      input.status,
      input.error
    ) as ApplyRunInsert["result_payload"],
    error: input.error ?? null,
  };

  const { data, error } = await supabase
    .from("apply_runs")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
