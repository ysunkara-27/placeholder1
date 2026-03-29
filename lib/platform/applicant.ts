import type { EEOData } from "@/lib/types";
import type { PersistedProfile } from "@/lib/platform/profile";

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
  resume_pdf_path: string;
  major: string;
  authorized_to_work: boolean;
  visa_type: string;
  earliest_start_date: string;
  sponsorship_required: boolean;
  work_authorization: string;
  start_date: string;
  location_preference: string;
  salary_expectation: string;
  onsite_preference: string;
  weekly_availability_hours: string;
  graduation_window: string;
  commute_preference: string;
  eeo: EEOData | null;
  custom_answers: Record<string, string>;
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

export function mapPersistedProfileToApplicantDraft(
  profile: PersistedProfile,
  userEmail: string
): ApplicantProfileDraft {
  const { firstName, lastName } = splitName(profile.name);

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
    resume_pdf_path: "/tmp/resume.pdf",
    major: profile.major,
    authorized_to_work: profile.authorized_to_work,
    visa_type: profile.visa_type,
    earliest_start_date: profile.earliest_start_date,
    sponsorship_required: !profile.authorized_to_work || (profile.gray_areas?.sponsorship_required ?? false),
    work_authorization: profile.authorized_to_work
      ? "Authorized to work in the United States"
      : "Requires sponsorship",
    start_date: profile.earliest_start_date,
    location_preference: profile.locations[0] ?? "",
    salary_expectation:
      profile.gray_areas?.salary_min && profile.gray_areas?.salary_unit
        ? profile.gray_areas.salary_unit === "hourly"
          ? `$${profile.gray_areas.salary_min}/hour`
          : `$${profile.gray_areas.salary_min}/year`
        : "",
    onsite_preference: profile.remote_ok ? "Remote or hybrid preferred" : "Open to onsite",
    weekly_availability_hours: "",
    graduation_window: profile.graduation,
    commute_preference: profile.remote_ok ? "Prefer remote-friendly roles" : "",
    eeo: profile.eeo,
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
      ...(profile.gpa ? { gpa: profile.gpa } : {}),
      ...(profile.locations[0]
        ? { relocation: profile.remote_ok ? "no" : "yes" }
        : {}),
    },
  };
}
