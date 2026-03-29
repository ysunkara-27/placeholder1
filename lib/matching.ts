import type { Database } from "@/lib/supabase/database.types";
import type { GrayAreaSuggestion, Industry, JobLevel } from "@/lib/types";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export interface MatchResult {
  matched: boolean;
  score: number; // 0–100, higher = stronger match
  reasons: string[];
  rejections: string[];
}

/**
 * Determines whether a job matches a user profile and returns a scored result.
 *
 * Scoring breakdown (100 pts total):
 *   40 pts — industry overlap
 *   30 pts — level match
 *   20 pts — location / remote match
 *   10 pts — passes gray-area filters (salary, exclusions, company size)
 *
 * A job is considered matched if score >= 50 AND no hard rejections.
 */
export function matchJobToProfile(job: JobRow, profile: ProfileRow): MatchResult {
  const reasons: string[] = [];
  const rejections: string[] = [];
  let score = 0;

  const profileIndustries = (profile.industries ?? []) as Industry[];
  const profileLevels = (profile.levels ?? []) as JobLevel[];
  const profileLocations = (profile.locations ?? []) as string[];
  const remoteOk = profile.remote_ok ?? false;
  const grayAreas = (profile.gray_areas ?? null) as GrayAreaSuggestion | null;

  // ── 1. Industry match (40 pts) ─────────────────────────────────────────────
  const jobIndustries = (job.industries ?? []) as string[];

  if (profileIndustries.length === 0) {
    // No preference set — treat as open to all
    score += 40;
    reasons.push("Open to all industries");
  } else if (jobIndustries.length === 0) {
    // Job didn't specify industry — partial credit
    score += 20;
    reasons.push("Job industry unspecified");
  } else {
    const overlap = profileIndustries.filter((i) => jobIndustries.includes(i));
    if (overlap.length > 0) {
      score += 40;
      reasons.push(`Industry match: ${overlap.join(", ")}`);
    } else {
      rejections.push(`Industry mismatch (want: ${profileIndustries.join(", ")}, got: ${jobIndustries.join(", ")})`);
    }
  }

  // ── 2. Level match (30 pts) ───────────────────────────────────────────────
  const jobLevel = job.level as JobLevel;

  if (profileLevels.length === 0) {
    score += 30;
    reasons.push("Open to all levels");
  } else if (profileLevels.includes(jobLevel)) {
    score += 30;
    reasons.push(`Level match: ${jobLevel}`);
  } else {
    rejections.push(`Level mismatch (want: ${profileLevels.join(", ")}, got: ${jobLevel})`);
  }

  // ── 3. Location match (20 pts) ────────────────────────────────────────────
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

  // ── 4. Gray-area filters (10 pts, hard rejections possible) ───────────────
  if (grayAreas) {
    let grayPass = true;

    // Excluded companies
    const excludedCompanies = (grayAreas.excluded_companies ?? []).map((c) =>
      c.toLowerCase()
    );
    if (
      excludedCompanies.length > 0 &&
      excludedCompanies.some((c) => job.company.toLowerCase().includes(c))
    ) {
      rejections.push(`Company excluded: ${job.company}`);
      grayPass = false;
    }

    // Excluded industries
    const excludedIndustries = (grayAreas.excluded_industries ?? []).map((i) =>
      i.toLowerCase()
    );
    if (
      excludedIndustries.length > 0 &&
      jobIndustries.some((i) =>
        excludedIndustries.some((ex) => i.toLowerCase().includes(ex))
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
