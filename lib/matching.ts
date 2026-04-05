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

function sharedPrefixDepth(a: string, b: string) {
  const left = a.split(".");
  const right = b.split(".");
  let depth = 0;
  while (depth < left.length && depth < right.length && left[depth] === right[depth]) {
    depth += 1;
  }
  return depth;
}

function taxonomyOverlapScore(jobSlugs: string[], profileSlugs: string[]) {
  if (jobSlugs.length === 0 || profileSlugs.length === 0) {
    return { exact: 0, branch: 0, any: false };
  }
  let exact = 0;
  let branch = 0;
  for (const jobSlug of jobSlugs) {
    for (const profileSlug of profileSlugs) {
      const depth = sharedPrefixDepth(jobSlug, profileSlug);
      if (depth >= Math.max(jobSlug.split(".").length, profileSlug.split(".").length)) {
        exact += 1;
      } else if (depth >= 2) {
        branch += 1;
      }
    }
  }
  return { exact, branch, any: exact > 0 || branch > 0 };
}

function readTaxonomyProfile(profile: ProfileRow) {
  return (profile.profile_match_preferences ?? {}) as Record<string, any>;
}

function readTaxonomyJob(job: JobRow) {
  return (job.job_taxonomy_summary ?? {}) as Record<string, any>;
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
  const profileTaxonomy = readTaxonomyProfile(profile);
  const jobTaxonomy = readTaxonomyJob(job);

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

  const profileIndustryNodes = ((profileTaxonomy.industries?.node_slugs ?? []) as string[]).filter(Boolean);
  const profileCareerNodes = ((profileTaxonomy.career_roles?.node_slugs ?? []) as string[]).filter(Boolean);
  const profileGeoNodes = ((profileTaxonomy.geo_preferences?.node_slugs ?? []) as string[]).filter(Boolean);
  const profileWorkModalities = ((profile.profile_work_modality_allow ?? []) as string[]).filter(Boolean);

  const jobIndustryNodes = ((jobTaxonomy.industry_node_slugs ?? []) as string[]).filter(Boolean);
  const jobCareerNodes = ((jobTaxonomy.career_node_slugs ?? []) as string[]).filter(Boolean);
  const jobGeoNodes = ((jobTaxonomy.geo_node_slugs ?? []) as string[]).filter(Boolean);
  const jobWorkModality = (job.work_modality ?? jobTaxonomy.work_modality ?? null) as string | null;

  // 1. Industry match (40)
  if (profileIndustryNodes.length > 0 && jobIndustryNodes.length > 0) {
    const overlap = taxonomyOverlapScore(jobIndustryNodes, profileIndustryNodes);
    if (overlap.exact > 0) {
      score += 40;
      reasons.push("Industry taxonomy exact match");
    } else if (overlap.branch > 0) {
      score += 26;
      reasons.push("Industry taxonomy branch match");
    } else {
      rejections.push("Industry taxonomy mismatch");
    }
  } else if (profileIndustries.length === 0) {
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
  if (profileCareerNodes.length > 0 && jobCareerNodes.length > 0) {
    const overlap = taxonomyOverlapScore(jobCareerNodes, profileCareerNodes);
    if (overlap.exact > 0) {
      score += 20;
      reasons.push("Career-role taxonomy exact match");
    } else if (overlap.branch > 0) {
      score += 12;
      reasons.push("Career-role taxonomy branch match");
    } else {
      rejections.push("Career-role taxonomy mismatch");
    }
  } else if (roleFamilyMatches(targetRoleFamilies, profileLevels, jobRoleFamily, jobLevel)) {
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
  if (jobWorkModality && profileWorkModalities.length > 0 && !profileWorkModalities.includes(jobWorkModality)) {
    rejections.push(`Work setup mismatch (want: ${profileWorkModalities.join(", ")}, got: ${jobWorkModality})`);
  } else if (job.remote && remoteOk) {
    score += 20;
    reasons.push("Remote role, user is open to remote");
  } else if (jobGeoNodes.length > 0 && profileGeoNodes.length > 0 && jobWorkModality !== "remote") {
    const overlap = taxonomyOverlapScore(jobGeoNodes, profileGeoNodes);
    if (overlap.exact > 0) {
      score += 20;
      reasons.push("Location taxonomy exact match");
    } else if (overlap.branch > 0) {
      score += 12;
      reasons.push("Location taxonomy branch match");
    } else if (remoteOk && job.remote) {
      score += 20;
      reasons.push("Remote role accepted");
    } else {
      rejections.push("Location taxonomy mismatch");
    }
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
