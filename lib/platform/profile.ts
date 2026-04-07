import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AnnotatedResume,
  DisclosurePolicy,
  EEOData,
  GrayAreaSuggestion,
  Industry,
  JobLevel,
  JobRoleFamily,
  TargetTerm,
  WorkModality,
} from "@/lib/types";
import type { Database } from "@/lib/supabase/database.types";
import { clampText, MAX_COVER_LETTER_CHARS } from "@/lib/upload-limits";
import {
  buildProfileTaxonomy,
  hydrateProfileTaxonomy,
} from "@/lib/taxonomy/profile";
import { resolveTaxonomyNodeIds } from "@/lib/taxonomy/node-resolution";

export interface PersistedProfile {
  name: string;
  phone: string;
  city: string;
  state_region: string;
  country: string;
  linkedin_url: string;
  website_url: string;
  github_url: string;
  school: string;
  major: string;
  degree: string;
  graduation: string;
  gpa: string;
  authorized_to_work: boolean;
  visa_type: string;
  earliest_start_date: string;
  industries: Industry[];
  levels: JobLevel[];
  locations: string[];
  remote_ok: boolean;
  gray_areas: GrayAreaSuggestion | null;
  eeo: EEOData | null;
  resume_url: string | null;
  major2: string;
  cover_letter_template: string;
  weekly_availability_hours: string;
  target_role_families: JobRoleFamily[];
  target_terms: TargetTerm[];
  target_years: number[];
  graduation_year: number | null;
  graduation_term: TargetTerm | null;
  work_modality_allow: WorkModality[];
  open_to_relocate: boolean;
  gpa_disclosure_policy: DisclosurePolicy;
  eeo_disclosure_policy: DisclosurePolicy;
}

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type { ProfileRow };

function inferGraduationYear(graduation: string, fallback: number | null): number | null {
  if (typeof fallback === "number") {
    return fallback;
  }

  const match = graduation.match(/\b(20\d{2})\b/);
  if (!match) {
    return null;
  }

  return Number(match[1]);
}

function inferGraduationTerm(
  graduation: string,
  fallback: TargetTerm | null
): TargetTerm | null {
  if (fallback) {
    return fallback;
  }

  const normalized = graduation.toLowerCase();
  if (normalized.includes("spring")) return "spring";
  if (normalized.includes("summer")) return "summer";
  if (normalized.includes("fall") || normalized.includes("autumn")) return "fall";
  if (normalized.includes("winter")) return "winter";
  return null;
}

export function mapProfileRowToPersistedProfile(row: ProfileRow): PersistedProfile {
  const taxonomyHydration = hydrateProfileTaxonomy(
    (row as any).profile_match_preferences ?? null,
    (row as any).profile_application_facts ?? null
  );

  return {
    name: row.full_name ?? "",
    phone: row.phone ?? "",
    city: row.city ?? "",
    state_region: row.state_region ?? "",
    country: row.country ?? "United States",
    linkedin_url: row.linkedin_url ?? "",
    website_url: row.website_url ?? "",
    github_url: row.github_url ?? "",
    school: row.school ?? "",
    major: row.major ?? "",
    degree: row.degree ?? "",
    graduation: row.graduation ?? "",
    gpa: row.gpa ?? "",
    authorized_to_work: row.authorized_to_work ?? true,
    visa_type: row.visa_type ?? "",
    earliest_start_date: row.earliest_start_date ?? "",
    industries: row.industries as Industry[],
    levels: row.levels as JobLevel[],
    locations: row.locations,
    remote_ok: row.remote_ok,
    gray_areas: (row.gray_areas as GrayAreaSuggestion | null) ?? null,
    eeo: (row.eeo as EEOData | null) ?? null,
    resume_url: row.resume_url ?? null,
    major2: (row as any).major2 ?? "",
    cover_letter_template: (row as any).cover_letter_template ?? "",
    weekly_availability_hours: (row as any).weekly_availability_hours ?? "",
    target_role_families: ((row as any).target_role_families ?? row.levels ?? []) as JobRoleFamily[],
    target_terms: ((row as any).target_terms ?? []) as TargetTerm[],
    target_years: ((row as any).target_years ?? []) as number[],
    graduation_year: (row as any).graduation_year ?? null,
    graduation_term: ((row as any).graduation_term as TargetTerm | null) ?? null,
    work_modality_allow: taxonomyHydration.work_modality_allow,
    open_to_relocate: taxonomyHydration.open_to_relocate,
    gpa_disclosure_policy: taxonomyHydration.gpa_disclosure_policy,
    eeo_disclosure_policy: taxonomyHydration.eeo_disclosure_policy,
  };
}

export function mapProfileToUpsertInput(args: {
  userId: string;
  userEmail: string;
  profile: PersistedProfile;
  resume: AnnotatedResume | null;
}): Database["public"]["Tables"]["profiles"]["Insert"] {
  const { userId, userEmail, profile, resume } = args;
  const graduationYear = inferGraduationYear(
    profile.graduation,
    (profile as any).graduation_year ?? null
  );
  const graduationTerm = inferGraduationTerm(
    profile.graduation,
    (profile as any).graduation_term ?? null
  );
  const taxonomy = buildProfileTaxonomy({
    city: profile.city,
    state_region: profile.state_region,
    country: profile.country,
    school: profile.school,
    major: profile.major,
    major2: profile.major2,
    degree: profile.degree,
    graduation: profile.graduation,
    gpa: profile.gpa,
    industries: profile.industries,
    levels: profile.levels,
    target_role_families: profile.target_role_families,
    target_terms: profile.target_terms,
    target_years: profile.target_years,
    locations: profile.locations,
    remote_ok: profile.remote_ok,
    work_modality_allow: profile.work_modality_allow,
    open_to_relocate: profile.open_to_relocate,
    authorized_to_work: profile.authorized_to_work,
    visa_type: profile.visa_type,
    earliest_start_date: profile.earliest_start_date,
    weekly_availability_hours: profile.weekly_availability_hours,
    linkedin_url: profile.linkedin_url,
    website_url: profile.website_url,
    github_url: profile.github_url,
    gpa_disclosure_policy: profile.gpa_disclosure_policy,
    eeo_disclosure_policy: profile.eeo_disclosure_policy,
  });

  return ({
    id: userId,
    full_name: profile.name,
    email: userEmail || null,
    phone: profile.phone || null,
    city: profile.city || null,
    state_region: profile.state_region || null,
    country: profile.country || "United States",
    linkedin_url: profile.linkedin_url || null,
    website_url: profile.website_url || null,
    github_url: profile.github_url || null,
    school: profile.school,
    major: profile.major || null,
    degree: profile.degree,
    graduation: profile.graduation,
    gpa: profile.gpa || null,
    authorized_to_work: profile.authorized_to_work,
    visa_type: (profile.visa_type || null) as Database["public"]["Tables"]["profiles"]["Insert"]["visa_type"],
    earliest_start_date: profile.earliest_start_date || null,
    industries: profile.industries,
    levels: profile.levels,
    locations: profile.locations,
    remote_ok: profile.remote_ok,
    gray_areas: (profile.gray_areas ?? null) as Database["public"]["Tables"]["profiles"]["Insert"]["gray_areas"],
    eeo: (profile.eeo ?? null) as Database["public"]["Tables"]["profiles"]["Insert"]["eeo"],
    resume_json: (resume ?? null) as Database["public"]["Tables"]["profiles"]["Insert"]["resume_json"],
    resume_url: profile.resume_url ?? null,
    major2: (profile as any).major2 || null,
    cover_letter_template: (profile as any).cover_letter_template
      ? clampText((profile as any).cover_letter_template, MAX_COVER_LETTER_CHARS)
      : null,
    weekly_availability_hours: (profile as any).weekly_availability_hours || null,
    target_role_families: (profile as any).target_role_families ?? profile.levels,
    target_terms: (profile as any).target_terms ?? [],
    target_years: (profile as any).target_years ?? [],
    graduation_year: graduationYear,
    graduation_term: graduationTerm,
    profile_match_preferences: taxonomy.matchPreferences as any,
    profile_application_facts: taxonomy.applicationFacts as any,
    profile_work_modality_allow: taxonomy.matchPreferences.work_modality_allow,
    profile_taxonomy_summary: taxonomy.summary as any,
    profile_geo_allow_node_ids: [],
    profile_industry_allow_node_ids: [],
    profile_job_function_allow_node_ids: [],
    profile_career_allow_node_ids: [],
    profile_degree_node_ids: [],
    profile_education_field_node_ids: [],
    profile_work_auth_node_ids: [],
    profile_employment_type_allow_node_ids: [],
    notification_pref: profile.phone ? "sms" : "email",
    sms_provider: profile.phone ? "plivo" : null,
    sms_opt_in: Boolean(profile.phone),
    onboarding_completed: Boolean(resume),
  }) as Database["public"]["Tables"]["profiles"]["Insert"];
}

export async function mapProfileToResolvedUpsertInput(args: {
  supabase: SupabaseClient<Database>;
  userId: string;
  userEmail: string;
  profile: PersistedProfile;
  resume: AnnotatedResume | null;
}) {
  const base = mapProfileToUpsertInput(args);
  const matchPreferences = (base.profile_match_preferences ?? {}) as Record<string, any>;
  const applicationFacts = (base.profile_application_facts ?? {}) as Record<string, any>;

  const resolved = await resolveTaxonomyNodeIds(args.supabase, {
    geo: [
      ...((matchPreferences.geo_preferences?.node_slugs ?? []) as string[]),
      ...((applicationFacts.current_location?.node_slugs ?? []) as string[]),
    ],
    industry: ((matchPreferences.industries?.node_slugs ?? []) as string[]),
    job_function: ((matchPreferences.job_functions?.node_slugs ?? []) as string[]),
    career_role: ((matchPreferences.career_roles?.node_slugs ?? []) as string[]),
    education_degree: (
      (applicationFacts.education_records ?? []) as Array<Record<string, any>>
    ).flatMap((record) => (record.degree_node_slugs ?? []) as string[]),
    education_field: (
      (applicationFacts.education_records ?? []) as Array<Record<string, any>>
    ).flatMap((record) => (record.major_node_slugs ?? []) as string[]),
    work_authorization: ((applicationFacts.work_authorization?.node_slugs ?? []) as string[]),
    employment_type: ((matchPreferences.employment_types?.node_slugs ?? []) as string[]),
  });

  return {
    ...base,
    profile_geo_allow_node_ids: resolved.geo?.ids ?? [],
    profile_industry_allow_node_ids: resolved.industry?.ids ?? [],
    profile_job_function_allow_node_ids: resolved.job_function?.ids ?? [],
    profile_career_allow_node_ids: resolved.career_role?.ids ?? [],
    profile_degree_node_ids: resolved.education_degree?.ids ?? [],
    profile_education_field_node_ids: resolved.education_field?.ids ?? [],
    profile_work_auth_node_ids: resolved.work_authorization?.ids ?? [],
    profile_employment_type_allow_node_ids: resolved.employment_type?.ids ?? [],
  } satisfies Database["public"]["Tables"]["profiles"]["Insert"];
}

export function extractResumeFromProfileRow(row: ProfileRow) {
  return (row.resume_json as AnnotatedResume | null) ?? null;
}
