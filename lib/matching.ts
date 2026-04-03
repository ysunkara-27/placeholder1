import type { Database } from "@/lib/supabase/database.types";
import type {
  GrayAreaSuggestion,
  Industry,
  JobLevel,
  JobRoleFamily,
  TargetTerm,
} from "@/lib/types";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export interface MatchResult {
  matched: boolean;
  score: number;
  reasons: string[];
  rejections: string[];
}

function normalizeRoleFamily(job: JobRow): JobRoleFamily {
  const raw = job.role_family;
  if (
    raw === "internship" ||
    raw === "co_op" ||
    raw === "new_grad" ||
    raw === "associate" ||
    raw === "part_time"
  ) {
    return raw;
  }

  return (job.level as JobRoleFamily) ?? "internship";
}

function normalizeTargetTerm(job: JobRow): TargetTerm | null {
  const raw = job.target_term;
  if (
    raw === "spring" ||
    raw === "summer" ||
    raw === "fall" ||
    raw === "winter" ||
    raw === "any"
  ) {
    return raw;
  }

  return null;
}

function roleFamilyMatches(
  targetRoleFamilies: JobRoleFamily[],
  profileLevels: JobLevel[],
  jobRoleFamily: JobRoleFamily,
  jobLevel: JobLevel
) {
  if (targetRoleFamilies.length === 0 && profileLevels.length === 0) {
    return true;
  }

  if (targetRoleFamilies.includes(jobRoleFamily)) {
    return true;
  }

  if (profileLevels.includes(jobLevel)) {
    return true;
  }

  if (jobRoleFamily === "associate" && targetRoleFamilies.includes("new_grad")) {
    return true;
  }

  return false;
}

function recruitingWindowMatches(
  targetTerms: TargetTerm[],
  targetYears: number[],
  graduationYear: number | null,
  jobTargetTerm: TargetTerm | null,
  jobTargetYear: number | null
) {
  const termMatches =
    targetTerms.length === 0 ||
    targetTerms.includes("any") ||
    jobTargetTerm === null ||
    targetTerms.includes(jobTargetTerm);

  const yearMatches =
    targetYears.length === 0 ||
    jobTargetYear === null ||
    targetYears.includes(jobTargetYear) ||
    graduationYear === jobTargetYear;

  return termMatches && yearMatches;
}

export function matchJobToProfile(job: JobRow, profile: ProfileRow): MatchResult {
  const reasons: string[] = [];
  const rejections: string[] = [];
  let score = 0;

  const profileIndustries = (profile.industries ?? []) as Industry[];
  const profileLevels = (profile.levels ?? []) as JobLevel[];
  const targetRoleFamilies = (profile.target_role_families ?? []) as JobRoleFamily[];
  const targetTerms = (profile.target_terms ?? []) as TargetTerm[];
  const targetYears = (profile.target_years ?? []) as number[];
  const profileLocations = (profile.locations ?? []) as string[];
  const remoteOk = profile.remote_ok ?? false;
  const grayAreas = (profile.gray_areas ?? null) as GrayAreaSuggestion | null;
  const graduationYear = profile.graduation_year ?? null;

  const jobIndustries = (job.industries ?? []) as string[];
  const jobLevel = job.level as JobLevel;
  const jobRoleFamily = normalizeRoleFamily(job);
  const jobTargetTerm = normalizeTargetTerm(job);
  const jobTargetYear = job.target_year ?? null;

  // 1. Industry match (40)
  if (profileIndustries.length === 0) {
    score += 40;
    reasons.push("Open to all industries");
  } else if (jobIndustries.length === 0) {
    score += 20;
    reasons.push("Job industry unspecified");
  } else {
    const overlap = profileIndustries.filter((industry) => jobIndustries.includes(industry));
    if (overlap.length > 0) {
      score += 40;
      reasons.push(`Industry match: ${overlap.join(", ")}`);
    } else {
      rejections.push(
        `Industry mismatch (want: ${profileIndustries.join(", ")}, got: ${jobIndustries.join(", ")})`
      );
    }
  }

  // 2. Role family / level match (20)
  if (roleFamilyMatches(targetRoleFamilies, profileLevels, jobRoleFamily, jobLevel)) {
    score += 20;
    reasons.push(`Role family match: ${jobRoleFamily}`);
  } else {
    const desired = targetRoleFamilies.length > 0 ? targetRoleFamilies : profileLevels;
    rejections.push(`Level mismatch (want: ${desired.join(", ")}, got: ${jobRoleFamily})`);
  }

  // 3. Recruiting window match (10)
  if (recruitingWindowMatches(targetTerms, targetYears, graduationYear, jobTargetTerm, jobTargetYear)) {
    score += 10;
    reasons.push(
      `Recruiting window match: ${jobTargetTerm ?? "any term"}${jobTargetYear ? ` ${jobTargetYear}` : ""}`.trim()
    );
  } else {
    rejections.push(
      `Recruiting window mismatch (want: ${(targetTerms.length ? targetTerms.join(", ") : "any term")}${targetYears.length ? ` / ${targetYears.join(", ")}` : ""}, got: ${(jobTargetTerm ?? "unspecified")}${jobTargetYear ? ` ${jobTargetYear}` : ""})`
    );
  }

  // 4. Location match (20)
  if (job.remote && remoteOk) {
    score += 20;
    reasons.push("Remote role, user is open to remote");
  } else if (profileLocations.length === 0 && remoteOk) {
    score += 20;
    reasons.push("Open to any location");
  } else if (profileLocations.length === 0 && !remoteOk && !job.remote) {
    score += 10;
    reasons.push("No location preference set");
  } else {
    const jobCity = job.location.toLowerCase();
    const locationMatch = profileLocations.some((loc) =>
      jobCity.includes(loc.toLowerCase()) || loc.toLowerCase().includes(jobCity)
    );
    if (locationMatch) {
      score += 20;
      reasons.push(`Location match: ${job.location}`);
    } else if (remoteOk && job.remote) {
      score += 20;
      reasons.push("Remote role accepted");
    } else {
      rejections.push(`Location mismatch (want: ${profileLocations.join(", ")}, got: ${job.location})`);
    }
  }

  // 5. Gray-area filters (10)
  if (grayAreas) {
    let grayPass = true;

    const excludedCompanies = (grayAreas.excluded_companies ?? []).map((company) =>
      company.toLowerCase()
    );
    if (
      excludedCompanies.length > 0 &&
      excludedCompanies.some((company) => job.company.toLowerCase().includes(company))
    ) {
      rejections.push(`Company excluded: ${job.company}`);
      grayPass = false;
    }

    const excludedIndustries = (grayAreas.excluded_industries ?? []).map((industry) =>
      industry.toLowerCase()
    );
    if (
      excludedIndustries.length > 0 &&
      jobIndustries.some((industry) =>
        excludedIndustries.some((excluded) => industry.toLowerCase().includes(excluded))
      )
    ) {
      rejections.push(`Industry excluded: ${jobIndustries.join(", ")}`);
      grayPass = false;
    }

    if (grayPass) {
      score += 10;
      reasons.push("Passes exclusion filters");
    }
  } else {
    score += 10;
    reasons.push("No exclusion filters set");
  }

  const matched = score >= 50 && rejections.length === 0;

  return { matched, score, reasons, rejections };
}
