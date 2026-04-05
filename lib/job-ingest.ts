import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { detectJobPortalFromUrl, type JobPortalKind } from "@/lib/portal";
import {
  canonicalizeJobUrl,
  inferJobLevel,
  inferQualificationTags,
} from "@/lib/job-normalization";
import { normalizeJobIndustries } from "@/lib/job-industries";
import { buildJobTaxonomy } from "@/lib/taxonomy/job";
import { resolveTaxonomyNodeIds } from "@/lib/taxonomy/node-resolution";
import type { Database, Json } from "@/lib/supabase/database.types";

type JobInsert = Database["public"]["Tables"]["jobs"]["Insert"];
type JobRow = Database["public"]["Tables"]["jobs"]["Row"];

// Known junk patterns that scrapers write when they can't extract a real description
const JD_JUNK_PATTERNS = [
  /extracted via generic html rules/i,
  /no description available/i,
  /description not found/i,
  /see (job )?posting/i,
  /^n\/a$/i,
  /^null$/i,
  /^none$/i,
  /^-$/,
];

function sanitizeJdSummary(raw: string | null | undefined): string | null {
  const s = raw?.trim();
  if (!s || s.length < 20) return null;
  if (JD_JUNK_PATTERNS.some((p) => p.test(s))) return null;
  return s;
}

const jobLevelSchema = z
  .string()
  .transform((s) => s.toLowerCase().replace(/[\s-]+/g, "_"))
  .pipe(z.enum(["internship", "new_grad", "co_op", "part_time", "associate"]));

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
  level: jobLevelSchema.optional(),
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

function jsonObject(value: unknown): { [key: string]: Json | undefined } {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as { [key: string]: Json | undefined };
  }

  return {};
}

export function parseJobIngestPayload(input: unknown): JobIngestPayload {
  const parsed = jobIngestPayloadSchema.parse(input);

  return {
    ...parsed,
    level: parsed.level ?? inferJobLevel(parsed.title, parsed.jd_summary ?? ""),
  };
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
  const level = payload.level ?? inferJobLevel(payload.title, payload.jd_summary ?? "");
  const canonicalUrl = canonicalizeJobUrl(payload.url);
  const canonicalApplicationUrl = canonicalizeJobUrl(payload.application_url);
  const qualification = inferQualificationTags({
    title: payload.title,
    jdSummary: payload.jd_summary,
    level,
  });
  const taxonomy = buildJobTaxonomy({
    company: payload.company.trim(),
    title: payload.title.trim(),
    level,
    role_family: qualification.role_family,
    target_term: qualification.target_term,
    target_year: qualification.target_year,
    location: payload.location.trim(),
    remote: payload.remote,
    industries: dedupeStrings(payload.industries),
    jd_summary: payload.jd_summary ?? "",
  });

  return {
    company: payload.company.trim(),
    title: payload.title.trim(),
    level,
    location: payload.location.trim(),
    url: canonicalUrl,
    application_url: canonicalApplicationUrl,
    canonical_url: canonicalUrl,
    canonical_application_url: canonicalApplicationUrl,
    remote: payload.remote,
    industries: normalizeJobIndustries(
      taxonomy.legacy_industries,
      payload.title,
      payload.jd_summary ?? ""
    ),
    locations_text: taxonomy.locations_text,
    work_modality: taxonomy.work_modality,
    work_modality_confidence: taxonomy.work_modality_confidence,
    job_geo_node_ids: [],
    job_industry_node_ids: [],
    job_function_node_ids: [],
    job_career_node_ids: [],
    job_degree_requirement_node_ids: [],
    job_education_field_node_ids: [],
    job_work_auth_node_ids: [],
    job_employment_type_node_ids: [],
    job_taxonomy_summary: taxonomy.summary as Json,
    taxonomy_resolution_version: taxonomy.taxonomy_resolution_version,
    taxonomy_needs_review: taxonomy.taxonomy_needs_review,
    portal,
    role_family: qualification.role_family,
    target_term: qualification.target_term,
    target_year: qualification.target_year,
    experience_band: qualification.experience_band,
    is_early_career: qualification.is_early_career,
    jd_summary: sanitizeJdSummary(payload.jd_summary),
    posted_at: normalizeTimestamp(payload.posted_at) ?? new Date().toISOString(),
    status: "pending",
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
  const taxonomySummary = (insert.job_taxonomy_summary ?? {}) as Record<string, any>;
  const resolved = await resolveTaxonomyNodeIds(supabase, {
    geo: (taxonomySummary.geo_node_slugs ?? []) as string[],
    industry: (taxonomySummary.industry_node_slugs ?? []) as string[],
    job_function: (taxonomySummary.job_function_node_slugs ?? []) as string[],
    career_role: (taxonomySummary.career_node_slugs ?? []) as string[],
    education_degree: (taxonomySummary.degree_requirement_node_slugs ?? []) as string[],
    education_field: (taxonomySummary.education_field_node_slugs ?? []) as string[],
    work_authorization: (taxonomySummary.work_auth_node_slugs ?? []) as string[],
    employment_type: (taxonomySummary.employment_type_node_slugs ?? []) as string[],
  });
  insert.job_geo_node_ids = resolved.geo?.ids ?? [];
  insert.job_industry_node_ids = resolved.industry?.ids ?? [];
  insert.job_function_node_ids = resolved.job_function?.ids ?? [];
  insert.job_career_node_ids = resolved.career_role?.ids ?? [];
  insert.job_degree_requirement_node_ids = resolved.education_degree?.ids ?? [];
  insert.job_education_field_node_ids = resolved.education_field?.ids ?? [];
  insert.job_work_auth_node_ids = resolved.work_authorization?.ids ?? [];
  insert.job_employment_type_node_ids = resolved.employment_type?.ids ?? [];

  const { data: existing, error: existingError } = await supabase
    .from("jobs")
    .select("*")
    .eq("canonical_url", insert.canonical_url!)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    // Rejected jobs stay closed — skip all re-processing so they never surface for review again.
    if (existing.status === "closed") {
      return existing;
    }

    const mergedMetadata = {
      ...jsonObject(existing.metadata),
      ...jsonObject(insert.metadata),
    };

    const update: Database["public"]["Tables"]["jobs"]["Update"] = {
      application_url:
        existing.application_url || insert.application_url,
      canonical_application_url:
        existing.canonical_application_url || insert.canonical_application_url,
      remote: existing.remote || insert.remote,
      industries: normalizeJobIndustries(
        (existing.industries?.length ? existing.industries : insert.industries) ?? [],
        existing.title,
        existing.jd_summary ?? insert.jd_summary ?? ""
      ),
      locations_text:
        existing.locations_text?.length ? existing.locations_text : insert.locations_text,
      work_modality:
        existing.work_modality ?? insert.work_modality,
      work_modality_confidence:
        existing.work_modality_confidence ?? insert.work_modality_confidence,
      job_geo_node_ids:
        existing.job_geo_node_ids?.length ? existing.job_geo_node_ids : insert.job_geo_node_ids,
      job_industry_node_ids:
        existing.job_industry_node_ids?.length ? existing.job_industry_node_ids : insert.job_industry_node_ids,
      job_function_node_ids:
        existing.job_function_node_ids?.length ? existing.job_function_node_ids : insert.job_function_node_ids,
      job_career_node_ids:
        existing.job_career_node_ids?.length ? existing.job_career_node_ids : insert.job_career_node_ids,
      job_degree_requirement_node_ids:
        existing.job_degree_requirement_node_ids?.length ? existing.job_degree_requirement_node_ids : insert.job_degree_requirement_node_ids,
      job_education_field_node_ids:
        existing.job_education_field_node_ids?.length ? existing.job_education_field_node_ids : insert.job_education_field_node_ids,
      job_work_auth_node_ids:
        existing.job_work_auth_node_ids?.length ? existing.job_work_auth_node_ids : insert.job_work_auth_node_ids,
      job_employment_type_node_ids:
        existing.job_employment_type_node_ids?.length ? existing.job_employment_type_node_ids : insert.job_employment_type_node_ids,
      job_taxonomy_summary:
        (existing.job_taxonomy_summary as Json) ?? insert.job_taxonomy_summary ?? {},
      taxonomy_resolution_version:
        existing.taxonomy_resolution_version ?? insert.taxonomy_resolution_version,
      taxonomy_needs_review:
        existing.taxonomy_needs_review ?? insert.taxonomy_needs_review ?? false,
      portal: existing.portal || insert.portal,
      role_family: existing.role_family || insert.role_family,
      target_term: existing.target_term || insert.target_term,
      target_year: existing.target_year || insert.target_year,
      experience_band: existing.experience_band || insert.experience_band,
      is_early_career: existing.is_early_career ?? insert.is_early_career,
      jd_summary: sanitizeJdSummary(existing.jd_summary) ?? sanitizeJdSummary(insert.jd_summary) ?? null,
      posted_at:
        new Date(insert.posted_at!).getTime() > new Date(existing.posted_at).getTime()
          ? insert.posted_at
          : existing.posted_at,
      // Keep whatever status admin set — never overwrite on re-scrape.
      // last_seen_at is updated by the DB trigger automatically.
      status: existing.status,
      metadata: mergedMetadata,
    };

    const { data: updated, error: updateError } = await supabase
      .from("jobs")
      .update(update)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (updateError) {
      throw updateError;
    }

    return updated;
  }

  const { data, error } = await supabase
    .from("jobs")
    .insert(insert)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
