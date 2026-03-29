import type { AnnotatedResume, GrayAreaSuggestion, Industry, JobLevel } from "@/lib/types";
import type { Database } from "@/lib/supabase/database.types";

export interface PersistedProfile {
  name: string;
  email: string;
  school: string;
  degree: string;
  graduation: string;
  gpa: string;
  industries: Industry[];
  levels: JobLevel[];
  locations: string[];
  remote_ok: boolean;
  gray_areas: GrayAreaSuggestion | null;
  phone: string;
}

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type { ProfileRow };

export function mapProfileRowToPersistedProfile(row: ProfileRow): PersistedProfile {
  return {
    name: row.full_name ?? "",
    email: row.email ?? "",
    school: row.school ?? "",
    degree: row.degree ?? "",
    graduation: row.graduation ?? "",
    gpa: row.gpa ?? "",
    industries: row.industries as Industry[],
    levels: row.levels as JobLevel[],
    locations: row.locations,
    remote_ok: row.remote_ok,
    gray_areas: (row.gray_areas as GrayAreaSuggestion | null) ?? null,
    phone: row.phone ?? "",
  };
}

export function mapProfileToUpsertInput(args: {
  userId: string;
  profile: PersistedProfile;
  resume: AnnotatedResume | null;
}): Database["public"]["Tables"]["profiles"]["Insert"] {
  const { userId, profile, resume } = args;

  return {
    id: userId,
    full_name: profile.name,
    email: profile.email,
    phone: profile.phone || null,
    school: profile.school,
    degree: profile.degree,
    graduation: profile.graduation,
    gpa: profile.gpa || null,
    industries: profile.industries,
    levels: profile.levels,
    locations: profile.locations,
    remote_ok: profile.remote_ok,
    gray_areas: (profile.gray_areas ?? null) as Database["public"]["Tables"]["profiles"]["Insert"]["gray_areas"],
    resume_json: (resume ?? null) as Database["public"]["Tables"]["profiles"]["Insert"]["resume_json"],
    notification_pref: profile.phone ? "sms" : "email",
    sms_provider: profile.phone ? "plivo" : null,
    sms_opt_in: Boolean(profile.phone),
    onboarding_completed: Boolean(resume),
  };
}

export function extractResumeFromProfileRow(row: ProfileRow) {
  return (row.resume_json as AnnotatedResume | null) ?? null;
}
