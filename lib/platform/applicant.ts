import type { PersistedProfile } from "@/lib/platform/profile";
import { getGeoSearchTerms } from "@/lib/profile-geo";
import type { Database } from "@/lib/supabase/database.types";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];

type ApplicantEEO = Record<string, string>;

export interface ApplicantProfileDraft {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  city: string;
  state_region: string;
  country: string;
  linkedin_url: string;
  website_url: string;
  github_url: string;
  linkedin: string;
  website: string;
  github: string;
  resume_pdf_path: string;
  school: string;
  major: string;
  gpa: string;
  graduation: string;
  authorized_to_work: boolean;
  visa_type: string;
  earliest_start_date: string;
  sponsorship_required: boolean;
  work_authorization: string;
  start_date: string;
  location_preference: string;
  location_preferences: string[];
  job_location_options: string[];
  salary_expectation: string;
  onsite_preference: string;
  weekly_availability_hours: string;
  graduation_window: string;
  commute_preference: string;
  eeo: ApplicantEEO;
  custom_answers: Record<string, string>;
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function extractStoredFollowupAnswers(profile: PersistedProfile): Record<string, string> {
  const followUpAnswers = profile.gray_areas?.follow_up_answers;
  if (!followUpAnswers || typeof followUpAnswers !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(followUpAnswers).filter(
      (entry): entry is [string, string] =>
        typeof entry[0] === "string" && typeof entry[1] === "string"
    )
  );
}

function uniq(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function splitLocationOptions(raw: string | null | undefined) {
  return uniq(
    String(raw ?? "")
      .split(/\s*(?:\||;|\n|\/)\s*/g)
      .flatMap((part) => part.split(/\s+\bor\b\s+/i))
      .map((part) => part.trim())
      .filter(Boolean)
  );
}

function locationMatchScore(left: string, right: string) {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  if (a === b) return 4;
  if (a.includes(b) || b.includes(a)) return 3;
  const cityA = a.split(",")[0]?.trim() ?? a;
  const cityB = b.split(",")[0]?.trim() ?? b;
  if (cityA && cityB && (cityA === cityB || cityA.includes(cityB) || cityB.includes(cityA))) {
    return 2;
  }
  return 0;
}

function rankJobLocations(profile: PersistedProfile, job: JobRow | null | undefined) {
  const jobLocationOptions = uniq([
    ...((job?.locations_text ?? []) as string[]),
    ...splitLocationOptions(job?.location),
  ]);
  const profileLocationPreferences = uniq(
    (profile.locations ?? []).flatMap((location) => getGeoSearchTerms(location))
  );
  const rankedMatches = jobLocationOptions
    .map((jobLocation) => ({
      jobLocation,
      score: Math.max(
        0,
        ...profileLocationPreferences.map((profileLocation) =>
          locationMatchScore(jobLocation, profileLocation)
        )
      ),
    }))
    .sort((a, b) => b.score - a.score || a.jobLocation.localeCompare(b.jobLocation))
    .map((entry) => entry.jobLocation);

  const selected = uniq([
    ...rankedMatches.filter((location) =>
      profileLocationPreferences.some((preferred) => locationMatchScore(location, preferred) > 0)
    ),
    ...(profile.open_to_relocate || profileLocationPreferences.length === 0 ? rankedMatches : []),
  ]);

  return {
    jobLocationOptions,
    rankedLocationPreferences: selected.length > 0 ? selected : rankedMatches,
  };
}

export function mapPersistedProfileToApplicantDraft(
  profile: PersistedProfile,
  userEmail: string,
  job?: JobRow | null
): ApplicantProfileDraft {
  const { firstName, lastName } = splitName(profile.name);
  const storedFollowupAnswers = extractStoredFollowupAnswers(profile);
  const { jobLocationOptions, rankedLocationPreferences } = rankJobLocations(profile, job);
  const primaryLocationPreference =
    rankedLocationPreferences[0] ??
    profile.locations[0] ??
    jobLocationOptions[0] ??
    "";

  return {
    first_name: firstName,
    last_name: lastName,
    email: userEmail,
    phone: profile.phone,
    city: profile.city,
    state_region: profile.state_region,
    country: profile.country,
    linkedin_url: profile.linkedin_url,
    website_url: profile.website_url,
    github_url: profile.github_url,
    linkedin: profile.linkedin_url,
    website: profile.website_url,
    github: profile.github_url,
    resume_pdf_path: profile.resume_url ?? "",
    school: profile.school,
    major: profile.major,
    gpa: profile.gpa,
    graduation: profile.graduation,
    authorized_to_work: profile.authorized_to_work,
    visa_type: profile.visa_type,
    earliest_start_date: profile.earliest_start_date,
    sponsorship_required: !profile.authorized_to_work || (profile.gray_areas?.sponsorship_required ?? false),
    work_authorization: profile.authorized_to_work
      ? "Authorized to work in the United States"
      : "Requires sponsorship",
    start_date: profile.earliest_start_date,
    location_preference: primaryLocationPreference,
    location_preferences: rankedLocationPreferences,
    job_location_options: jobLocationOptions,
    salary_expectation:
      profile.gray_areas?.salary_min && profile.gray_areas?.salary_unit
        ? profile.gray_areas.salary_unit === "hourly"
          ? `$${profile.gray_areas.salary_min}/hour`
          : `$${profile.gray_areas.salary_min}/year`
        : "",
    onsite_preference: profile.remote_ok ? "Remote or hybrid preferred" : "Open to onsite",
    weekly_availability_hours: profile.weekly_availability_hours ?? "",
    graduation_window: profile.graduation,
    commute_preference: profile.remote_ok ? "Prefer remote-friendly roles" : "",
    eeo: Object.fromEntries(
      Object.entries(profile.eeo ?? {}).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
      )
    ),
    custom_answers: {
      ...(profile.school ? { school: profile.school, university: profile.school } : {}),
      ...(profile.major ? { major: profile.major } : {}),
      ...(profile.degree ? { degree: profile.degree } : {}),
      ...(profile.graduation
        ? {
            graduation_date: profile.graduation,
            graduation: profile.graduation,
          }
        : {}),
      ...(profile.graduation_year
        ? {
            graduation_year: String(profile.graduation_year),
          }
        : {}),
      ...(profile.graduation_term
        ? {
            graduation_term: profile.graduation_term,
          }
        : {}),
      ...(profile.gpa ? { gpa: profile.gpa } : {}),
      ...(primaryLocationPreference
        ? {
            location_preference: primaryLocationPreference,
            preferred_location: primaryLocationPreference,
            office_location: primaryLocationPreference,
            work_location: primaryLocationPreference,
            ranked_location_preferences: rankedLocationPreferences.join(" | "),
            available_job_locations: jobLocationOptions.join(" | "),
            ...(rankedLocationPreferences[0] ? { location_preference_rank_1: rankedLocationPreferences[0], preferred_location_1: rankedLocationPreferences[0] } : {}),
            ...(rankedLocationPreferences[1] ? { location_preference_rank_2: rankedLocationPreferences[1], preferred_location_2: rankedLocationPreferences[1] } : {}),
            ...(rankedLocationPreferences[2] ? { location_preference_rank_3: rankedLocationPreferences[2], preferred_location_3: rankedLocationPreferences[2] } : {}),
          }
        : {}),
      ...(profile.locations[0]
        ? { relocation: profile.remote_ok ? "no" : "yes" }
        : {}),
      ...storedFollowupAnswers,
    },
  };
}
