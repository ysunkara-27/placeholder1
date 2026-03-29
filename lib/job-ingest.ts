import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { detectJobPortalFromUrl, type JobPortalKind } from "@/lib/portal";
import type { Database } from "@/lib/supabase/database.types";

type JobInsert = Database["public"]["Tables"]["jobs"]["Insert"];
type JobRow = Database["public"]["Tables"]["jobs"]["Row"];

const jobLevelSchema = z.enum([
  "internship",
  "new_grad",
  "co_op",
  "part_time",
]);

const jobPortalSchema = z.enum([
  "greenhouse",
  "lever",
  "workday",
  "handshake",
  "linkedin",
  "indeed",
  "icims",
  "smartrecruiters",
  "company_website",
  "other",
]);

const nonEmptyStringSchema = z.string().trim().min(1);

const optionalTimestampSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Must be a valid timestamp",
  })
  .optional();

const optionalDateSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Must be a valid date",
  })
  .optional();

export const jobIngestPayloadSchema = z.object({
  company: nonEmptyStringSchema,
  title: nonEmptyStringSchema,
  level: jobLevelSchema,
  location: nonEmptyStringSchema,
  url: z.string().url(),
  application_url: z.string().url(),
  remote: z.boolean().default(false),
  industries: z.array(nonEmptyStringSchema).default([]),
  portal: jobPortalSchema.optional(),
  jd_summary: z.string().trim().min(1).optional(),
  posted_at: optionalTimestampSchema,
  salary_range: z.string().trim().min(1).optional(),
  tags: z.array(nonEmptyStringSchema).default([]),
  deadline: optionalDateSchema,
  headcount: z.number().int().positive().optional(),
  source: z.string().trim().min(1).optional(),
});

export type JobIngestPayload = z.infer<typeof jobIngestPayloadSchema>;

function dedupeStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeTimestamp(value?: string) {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString();
}

export function canonicalizeJobUrl(url: string) {
  const parsed = new URL(url);
  parsed.hash = "";

  if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }

  return parsed.toString();
}

export function parseJobIngestPayload(input: unknown): JobIngestPayload {
  return jobIngestPayloadSchema.parse(input);
}

function resolvePortal(payload: JobIngestPayload): JobPortalKind {
  return (
    payload.portal ??
    detectJobPortalFromUrl(payload.application_url) ??
    detectJobPortalFromUrl(payload.url)
  );
}

export function mapJobIngestPayloadToInsert(
  payload: JobIngestPayload
): JobInsert {
  const portal = resolvePortal(payload);
  const deadline = normalizeTimestamp(payload.deadline);

  return {
    company: payload.company.trim(),
    title: payload.title.trim(),
    level: payload.level,
    location: payload.location.trim(),
    url: canonicalizeJobUrl(payload.url),
    application_url: canonicalizeJobUrl(payload.application_url),
    remote: payload.remote,
    industries: dedupeStrings(payload.industries),
    portal,
    jd_summary: payload.jd_summary?.trim() ?? null,
    posted_at: normalizeTimestamp(payload.posted_at) ?? new Date().toISOString(),
    status: "active",
    metadata: {
      ...(payload.salary_range ? { salary_range: payload.salary_range.trim() } : {}),
      ...(payload.tags.length > 0 ? { tags: dedupeStrings(payload.tags) } : {}),
      ...(deadline ? { deadline } : {}),
      ...(payload.headcount ? { headcount: payload.headcount } : {}),
      source: payload.source?.trim() ?? "jobs_ingest_api",
      ingested_via: "api_jobs_ingest",
    },
  };
}

export async function upsertJobFromIngestPayload(
  supabase: SupabaseClient<Database>,
  payload: JobIngestPayload
): Promise<JobRow> {
  const insert = mapJobIngestPayloadToInsert(payload);
  const { data, error } = await supabase
    .from("jobs")
    .upsert(insert, {
      onConflict: "url",
      ignoreDuplicates: false,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
