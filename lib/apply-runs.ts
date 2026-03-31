import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type ApplyRunInsert = Database["public"]["Tables"]["apply_runs"]["Insert"];
type ApplyRunRow = Database["public"]["Tables"]["apply_runs"]["Row"];

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
  latest_screenshot_label: string | null;
  blocked_step: string | null;
  blocked_field_family:
    | "contact"
    | "resume"
    | "authorization"
    | "education"
    | "availability"
    | "eeo"
    | "custom"
    | "unknown"
    | null;
  failure_source: "profile_data" | "automation" | "mixed" | "unknown" | null;
  missing_profile_fields: string[];
  inferred_answers_count: number;
  inferred_answers: string[];
  follow_up_required: boolean;
  follow_up_items: string[];
  error_kind: "none" | "auth" | "validation" | "execution";
  recovery_attempted: boolean;
  recovery_family:
    | "contact"
    | "resume"
    | "authorization"
    | "education"
    | "availability"
    | "eeo"
    | "custom"
    | "unknown"
    | null;
};

export type ApplyRunHistorySignal = {
  portal: string | null;
  summary?: {
    blocked_field_family:
      | "contact"
      | "resume"
      | "authorization"
      | "education"
      | "availability"
      | "eeo"
      | "custom"
      | "unknown"
      | null;
    failure_source: "profile_data" | "automation" | "mixed" | "unknown" | null;
    error_kind: "none" | "auth" | "validation" | "execution";
  } | null;
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

function summarizeErrorKind(status: string, error?: string): ApplyRunSummary["error_kind"] {
  const normalizedError = (error ?? "").toLowerCase();

  if (status === "applied" || status === "unsupported") {
    return "none";
  }
  if (status === "requires_auth") {
    return "auth";
  }
  if (
    normalizedError.includes("valid") ||
    normalizedError.includes("required") ||
    normalizedError.includes("please enter") ||
    normalizedError.includes("please select")
  ) {
    return "validation";
  }
  return "execution";
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

function summarizeLatestScreenshotLabel(resultPayload: unknown): string | null {
  const screenshots =
    resultPayload &&
    typeof resultPayload === "object" &&
    "screenshots" in resultPayload &&
    Array.isArray(resultPayload.screenshots)
      ? resultPayload.screenshots
      : [];

  const lastScreenshot = screenshots.at(-1);
  if (
    lastScreenshot &&
    typeof lastScreenshot === "object" &&
    "label" in lastScreenshot &&
    typeof lastScreenshot.label === "string"
  ) {
    return lastScreenshot.label;
  }

  return null;
}

function summarizeBlockedStep(error?: string): string | null {
  if (!error) {
    return null;
  }

  const [prefix] = error.split(":");
  const normalized = prefix?.trim().toLowerCase() ?? "";

  if (!normalized || normalized.includes("application flow stalled on")) {
    const stalledStep = normalized.replace("application flow stalled on", "").trim();
    return stalledStep || null;
  }

  if (/^[a-z0-9_]+$/.test(normalized)) {
    return normalized;
  }

  return null;
}

function summarizeBlockedFieldFamily(error?: string): ApplyRunSummary["blocked_field_family"] {
  if (!error) {
    return null;
  }

  const normalized = error.toLowerCase();

  if (
    normalized.includes("email") ||
    normalized.includes("phone") ||
    normalized.includes("linkedin") ||
    normalized.includes("website") ||
    normalized.includes("portfolio") ||
    normalized.includes("name is required")
  ) {
    return "contact";
  }

  if (normalized.includes("resume") || normalized.includes("cv") || normalized.includes("cover letter")) {
    return "resume";
  }

  if (
    normalized.includes("work authorization") ||
    normalized.includes("authorized") ||
    normalized.includes("sponsorship") ||
    normalized.includes("visa")
  ) {
    return "authorization";
  }

  if (
    normalized.includes("school") ||
    normalized.includes("degree") ||
    normalized.includes("major") ||
    normalized.includes("gpa") ||
    normalized.includes("graduation")
  ) {
    return "education";
  }

  if (
    normalized.includes("start date") ||
    normalized.includes("availability") ||
    normalized.includes("hours") ||
    normalized.includes("onsite") ||
    normalized.includes("relocation") ||
    normalized.includes("commute")
  ) {
    return "availability";
  }

  if (
    normalized.includes("gender") ||
    normalized.includes("race") ||
    normalized.includes("ethnicity") ||
    normalized.includes("veteran") ||
    normalized.includes("disability") ||
    normalized.includes("equal employment") ||
    normalized.includes("eeo")
  ) {
    return "eeo";
  }

  if (
    normalized.includes("required") ||
    normalized.includes("please enter") ||
    normalized.includes("please select") ||
    normalized.includes("complete this field")
  ) {
    return "custom";
  }

  return "unknown";
}

function normalizeProfileRecord(requestPayload: unknown): Record<string, unknown> {
  if (
    requestPayload &&
    typeof requestPayload === "object" &&
    "profile" in requestPayload &&
    requestPayload.profile &&
    typeof requestPayload.profile === "object"
  ) {
    return requestPayload.profile as Record<string, unknown>;
  }

  return {};
}

function hasNonEmptyStringField(profile: Record<string, unknown>, key: string): boolean {
  const value = profile[key];
  return typeof value === "string" && value.trim().length > 0;
}

function hasNonEmptyNestedStringField(
  profile: Record<string, unknown>,
  parentKey: string,
  childKey: string
): boolean {
  const parent = profile[parentKey];
  if (!parent || typeof parent !== "object") {
    return false;
  }

  const value = (parent as Record<string, unknown>)[childKey];
  return typeof value === "string" && value.trim().length > 0;
}

function summarizeMissingProfileFields(
  requestPayload: unknown,
  family: ApplyRunSummary["blocked_field_family"]
): string[] {
  const profile = normalizeProfileRecord(requestPayload);
  const missing: string[] = [];

  if (family === "contact") {
    if (!hasNonEmptyStringField(profile, "email")) missing.push("email");
    if (!hasNonEmptyStringField(profile, "phone")) missing.push("phone");
    if (!hasNonEmptyStringField(profile, "linkedin")) missing.push("linkedin");
    if (!hasNonEmptyStringField(profile, "website")) missing.push("website");
  }

  if (family === "resume" && !hasNonEmptyStringField(profile, "resume_pdf_path")) {
    missing.push("resume_pdf_path");
  }

  if (family === "authorization" && !hasNonEmptyStringField(profile, "work_authorization")) {
    missing.push("work_authorization");
  }

  if (family === "education") {
    if (!hasNonEmptyStringField(profile, "school")) missing.push("school");
    if (!hasNonEmptyStringField(profile, "major")) missing.push("major");
    if (!hasNonEmptyStringField(profile, "graduation")) missing.push("graduation");
    if (!hasNonEmptyStringField(profile, "gpa")) missing.push("gpa");
  }

  if (family === "availability") {
    if (!hasNonEmptyStringField(profile, "start_date")) missing.push("start_date");
    if (!hasNonEmptyStringField(profile, "onsite_preference")) {
      missing.push("onsite_preference");
    }
    if (!hasNonEmptyStringField(profile, "weekly_availability_hours")) {
      missing.push("weekly_availability_hours");
    }
    if (!hasNonEmptyStringField(profile, "graduation_window")) {
      missing.push("graduation_window");
    }
  }

  if (family === "eeo") {
    if (!hasNonEmptyNestedStringField(profile, "eeo", "gender")) missing.push("eeo.gender");
    if (!hasNonEmptyNestedStringField(profile, "eeo", "race_ethnicity")) {
      missing.push("eeo.race_ethnicity");
    }
    if (!hasNonEmptyNestedStringField(profile, "eeo", "veteran_status")) {
      missing.push("eeo.veteran_status");
    }
    if (!hasNonEmptyNestedStringField(profile, "eeo", "disability_status")) {
      missing.push("eeo.disability_status");
    }
  }

  return missing;
}

function summarizeFailureSource(
  status: string,
  errorKind: ApplyRunSummary["error_kind"],
  blockedFieldFamily: ApplyRunSummary["blocked_field_family"],
  missingProfileFields: string[]
): ApplyRunSummary["failure_source"] {
  if (status === "applied" || status === "unsupported" || status === "requires_auth") {
    return null;
  }

  if (missingProfileFields.length > 0 && blockedFieldFamily && blockedFieldFamily !== "unknown") {
    return "mixed";
  }

  if (missingProfileFields.length > 0) {
    return "profile_data";
  }

  if (blockedFieldFamily || errorKind === "execution") {
    return "automation";
  }

  return "unknown";
}

function summarizeInferredAnswers(resultPayload: unknown): string[] {
  const inferredAnswers =
    resultPayload &&
    typeof resultPayload === "object" &&
    "inferred_answers" in resultPayload &&
    Array.isArray(resultPayload.inferred_answers)
      ? resultPayload.inferred_answers
      : [];

  return inferredAnswers
    .filter((answer): answer is string => typeof answer === "string" && answer.trim().length > 0)
    .map((answer) => answer.trim());
}

function summarizeUnresolvedQuestions(resultPayload: unknown): string[] {
  const unresolvedQuestions =
    resultPayload &&
    typeof resultPayload === "object" &&
    "unresolved_questions" in resultPayload &&
    Array.isArray(resultPayload.unresolved_questions)
      ? resultPayload.unresolved_questions
      : [];

  return unresolvedQuestions
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
}

function summarizeRecoveryAttempted(resultPayload: unknown): boolean {
  return Boolean(
    resultPayload &&
      typeof resultPayload === "object" &&
      "recovery_attempted" in resultPayload &&
      resultPayload.recovery_attempted === true
  );
}

function summarizeRecoveryFamily(
  resultPayload: unknown
): ApplyRunSummary["recovery_family"] {
  if (
    resultPayload &&
    typeof resultPayload === "object" &&
    "recovery_family" in resultPayload &&
    typeof resultPayload.recovery_family === "string"
  ) {
    return resultPayload.recovery_family as ApplyRunSummary["recovery_family"];
  }

  return null;
}

function withRunSummary(
  requestPayload: unknown,
  resultPayload: unknown,
  status: string,
  error?: string
): Record<string, unknown> {
  const base =
    resultPayload && typeof resultPayload === "object" ? { ...resultPayload } : {};
  const inferredAnswers = summarizeInferredAnswers(resultPayload);
  const unresolvedQuestions = summarizeUnresolvedQuestions(resultPayload);
  const blockedFieldFamily = summarizeBlockedFieldFamily(error);
  const errorKind = summarizeErrorKind(status, error);
  const missingProfileFields = summarizeMissingProfileFields(
    requestPayload,
    blockedFieldFamily
  );
  const recoveryAttempted = summarizeRecoveryAttempted(resultPayload);
  const recoveryFamily = summarizeRecoveryFamily(resultPayload);

  const summary: ApplyRunSummary = {
    stage: summarizeStage(status, error),
    actions: summarizeActions(resultPayload),
    screenshot_count: summarizeScreenshotCount(resultPayload),
    latest_screenshot_label: summarizeLatestScreenshotLabel(resultPayload),
    blocked_step: summarizeBlockedStep(error),
    blocked_field_family: blockedFieldFamily,
    failure_source: summarizeFailureSource(
      status,
      errorKind,
      blockedFieldFamily,
      missingProfileFields
    ),
    missing_profile_fields: missingProfileFields.slice(0, 6),
    inferred_answers_count: inferredAnswers.length,
    inferred_answers: inferredAnswers.slice(0, 6),
    follow_up_required: unresolvedQuestions.length > 0,
    follow_up_items: unresolvedQuestions.slice(0, 6),
    error_kind: errorKind,
    recovery_attempted: recoveryAttempted,
    recovery_family: recoveryFamily,
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
      input.requestPayload,
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

function mapApplyRunHistorySignal(row: ApplyRunRow): ApplyRunHistorySignal {
  const resultPayload =
    row.result_payload && typeof row.result_payload === "object"
      ? row.result_payload
      : {};
  const summary =
    "summary" in resultPayload &&
    resultPayload.summary &&
    typeof resultPayload.summary === "object"
      ? (resultPayload.summary as ApplyRunHistorySignal["summary"])
      : null;

  return {
    portal: row.portal,
    summary,
  };
}

export async function listRecentApplyRunHistorySignals(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit = 20
): Promise<ApplyRunHistorySignal[]> {
  const { data, error } = await supabase
    .from("apply_runs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapApplyRunHistorySignal);
}
