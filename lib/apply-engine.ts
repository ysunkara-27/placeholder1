import { z } from "zod";
import { getApplyEngineEnv } from "@/lib/env";

const applicantProfileSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().default(""),
  linkedin: z.string().default(""),
  website: z.string().default(""),
  github: z.string().default(""),
  resume_pdf_path: z.string().default(""),
  sponsorship_required: z.boolean().default(false),
  work_authorization: z.string().default(""),
  start_date: z.string().default(""),
  location_preference: z.string().default(""),
  salary_expectation: z.string().default(""),
  onsite_preference: z.string().default(""),
  weekly_availability_hours: z.string().default(""),
  graduation_window: z.string().default(""),
  commute_preference: z.string().default(""),
  city: z.string().default(""),
  state_region: z.string().default(""),
  country: z.string().default("United States"),
  school: z.string().default(""),
  major: z.string().default(""),
  gpa: z.string().default(""),
  graduation: z.string().default(""),
  visa_type: z.string().default(""),
  eeo: z.record(z.string(), z.string()).default({}),
  custom_answers: z.record(z.string(), z.string()).default({}),
});

const applyPlanRequestSchema = z.object({
  url: z.string().url(),
  profile: applicantProfileSchema,
  runtime_hints: z
    .object({
      likely_blocked_family: z
        .enum([
          "contact",
          "resume",
          "authorization",
          "education",
          "availability",
          "eeo",
          "custom",
          "unknown",
        ])
        .optional(),
      historical_blocked_families: z
        .array(
          z.enum([
            "contact",
            "resume",
            "authorization",
            "education",
            "availability",
            "eeo",
            "custom",
            "unknown",
          ])
        )
        .default([]),
    })
    .default({
      historical_blocked_families: [],
    }),
});

const applyEngineExecutionContextSchema = z.object({
  application_id: z.string().optional(),
  supabase_url: z.string().url().optional(),
  supabase_key: z.string().min(1).optional(),
});

const applyActionSchema = z.object({
  action: z.enum(["fill", "click", "select", "upload", "check", "uncheck"]),
  selector: z.string(),
  value: z.string().default(""),
  required: z.boolean().default(true),
});

const screenshotSchema = z.object({
  label: z.string(),
  mime_type: z.string().default("image/png"),
  data_base64: z.string().default(""),
});

const applyEngineResponseSchema = z.object({
  portal: z.enum(["greenhouse", "lever", "workday", "ashby", "handshake", "vision"]),
  status: z.enum(["applied", "requires_auth", "failed", "unsupported"]),
  confirmation_snippet: z.string().default(""),
  actions: z.array(applyActionSchema),
  error: z.string().default(""),
  screenshots: z.array(screenshotSchema).default([]),
  inferred_answers: z.array(z.string()).default([]),
  unresolved_questions: z.array(z.string()).default([]),
  recovery_attempted: z.boolean().default(false),
  recovery_family: z
    .enum([
      "contact",
      "resume",
      "authorization",
      "education",
      "availability",
      "eeo",
      "custom",
      "unknown",
    ])
    .nullable()
    .default(null),
});

export type ApplyPlanRequest = z.infer<typeof applyPlanRequestSchema>;
export type ApplyEngineResponse = z.infer<typeof applyEngineResponseSchema>;
export type ApplyEngineExecutionContext = z.infer<
  typeof applyEngineExecutionContextSchema
>;

export function parseApplyPlanRequest(input: unknown): ApplyPlanRequest {
  return applyPlanRequestSchema.parse(input);
}

export async function fetchApplyPlan(
  input: ApplyPlanRequest
): Promise<ApplyEngineResponse> {
  return fetchApplyEngine("plan", input);
}

export async function fetchApplySubmit(
  input: ApplyPlanRequest,
  executionContext?: ApplyEngineExecutionContext
): Promise<ApplyEngineResponse> {
  const parsedExecutionContext = executionContext
    ? applyEngineExecutionContextSchema.parse(executionContext)
    : undefined;

  return fetchApplyEngine("apply", {
    ...input,
    ...parsedExecutionContext,
    dry_run: false,
  });
}

async function fetchApplyEngine(
  path: "plan" | "apply",
  input: ApplyPlanRequest &
    ApplyEngineExecutionContext & {
      dry_run?: boolean;
    }
): Promise<ApplyEngineResponse> {
  const { baseUrl, timeoutMs, greenhouseTimeoutMs } = getApplyEngineEnv();

  if (!baseUrl) {
    throw new Error("APPLY_ENGINE_BASE_URL is not set");
  }

  const portalAwareTimeoutMs =
    input.url.toLowerCase().includes("greenhouse.io") && path === "apply"
      ? greenhouseTimeoutMs
      : timeoutMs;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), portalAwareTimeoutMs);

  let response: Response;

  try {
    response = await fetch(`${baseUrl}/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Apply engine ${path} request timed out after ${portalAwareTimeoutMs}ms`
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const payload = await response.json();

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String(payload.error)
        : "Apply engine plan request failed";
    throw new Error(message);
  }

  return applyEngineResponseSchema.parse(payload);
}
