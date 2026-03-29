import { z } from "zod";
import { getApplyEngineEnv } from "@/lib/env";

const applicantProfileSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().default(""),
  linkedin: z.string().default(""),
  website: z.string().default(""),
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
  custom_answers: z.record(z.string(), z.string()).default({}),
});

const applyPlanRequestSchema = z.object({
  url: z.string().url(),
  profile: applicantProfileSchema,
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
  portal: z.enum(["greenhouse", "lever", "workday", "handshake", "vision"]),
  status: z.enum(["applied", "requires_auth", "failed", "unsupported"]),
  confirmation_snippet: z.string().default(""),
  actions: z.array(applyActionSchema),
  error: z.string().default(""),
  screenshots: z.array(screenshotSchema).default([]),
});

export type ApplyPlanRequest = z.infer<typeof applyPlanRequestSchema>;
export type ApplyEngineResponse = z.infer<typeof applyEngineResponseSchema>;

export function parseApplyPlanRequest(input: unknown): ApplyPlanRequest {
  return applyPlanRequestSchema.parse(input);
}

export async function fetchApplyPlan(
  input: ApplyPlanRequest
): Promise<ApplyEngineResponse> {
  return fetchApplyEngine("plan", input);
}

export async function fetchApplySubmit(
  input: ApplyPlanRequest
): Promise<ApplyEngineResponse> {
  return fetchApplyEngine("apply", { ...input, dry_run: false });
}

async function fetchApplyEngine(
  path: "plan" | "apply",
  input: ApplyPlanRequest & { dry_run?: boolean }
): Promise<ApplyEngineResponse> {
  const { baseUrl } = getApplyEngineEnv();

  if (!baseUrl) {
    throw new Error("APPLY_ENGINE_BASE_URL is not set");
  }

  const response = await fetch(`${baseUrl}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    cache: "no-store",
  });

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
