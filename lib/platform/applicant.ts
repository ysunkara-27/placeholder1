import type { PersistedProfile } from "@/lib/platform/profile";

export interface ApplicantProfileDraft {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  linkedin: string;
  website: string;
  resume_pdf_path: string;
  sponsorship_required: boolean;
  work_authorization: string;
  start_date: string;
  location_preference: string;
  salary_expectation: string;
  onsite_preference: string;
  weekly_availability_hours: string;
  graduation_window: string;
  commute_preference: string;
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
  profile: PersistedProfile
): ApplicantProfileDraft {
  const { firstName, lastName } = splitName(profile.name);

  return {
    first_name: firstName,
    last_name: lastName,
    email: profile.email,
    phone: profile.phone,
    linkedin: "",
    website: "",
    resume_pdf_path: "/tmp/resume.pdf",
    sponsorship_required: profile.gray_areas?.sponsorship_required ?? false,
    work_authorization:
      profile.gray_areas?.sponsorship_required === true
        ? "Requires sponsorship"
        : "Authorized to work in the United States",
    start_date: "",
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
    custom_answers: {
      ...(profile.school ? { school: profile.school, university: profile.school } : {}),
      ...(profile.degree ? { degree: profile.degree, major: profile.degree } : {}),
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
