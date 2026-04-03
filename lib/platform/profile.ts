import type {
  AnnotatedResume,
  EEOData,
  GrayAreaSuggestion,
  Industry,
  JobLevel,
  JobRoleFamily,
  TargetTerm,
} from "@/lib/types";
import type { Database } from "@/lib/supabase/database.types";
import { clampText, MAX_COVER_LETTER_CHARS } from "@/lib/upload-limits";

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
    notification_pref: profile.phone ? "sms" : "email",
    sms_provider: profile.phone ? "plivo" : null,
    sms_opt_in: Boolean(profile.phone),
    onboarding_completed: Boolean(resume),
  }) as Database["public"]["Tables"]["profiles"]["Insert"];
}

export function extractResumeFromProfileRow(row: ProfileRow) {
  return (row.resume_json as AnnotatedResume | null) ?? null;
}
