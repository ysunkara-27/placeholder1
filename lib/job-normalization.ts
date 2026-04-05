import type {
  ExperienceBand,
  JobLevel,
  JobRoleFamily,
} from "@/lib/types";

export interface NormalizedQualificationTags {
  role_family: JobRoleFamily;
  target_term: string | null;
  target_year: number | null;
  experience_band: ExperienceBand;
  is_early_career: boolean;
}

function parseYear(text: string): number | null {
  const match = text.match(/\b(20\d{2})\b/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
}

function parseTerm(text: string): string | null {
  const season =
    /\bspring\b/.test(text) ? "Spring" :
    /\bsummer\b/.test(text) ? "Summer" :
    /\bfall\b|\bautumn\b/.test(text) ? "Fall" :
    /\bwinter\b/.test(text) ? "Winter" : null;

  const yearMatch = text.match(/\b(20\d{2})\b/);
  const year = yearMatch ? yearMatch[1] : null;

  if (season && year) return `${year} ${season}`;
  if (season) return season;
  if (/\bfull[\s-]?time\b/.test(text)) return "Full Time";
  return null;
}

function inferRoleFamily(text: string, fallbackLevel?: string): JobRoleFamily {
  if (/\bco[\s-]?op\b/.test(text)) return "co_op";
  if (/\bassociate\b/.test(text)) return "associate";
  if (/\bnew[\s-]?grad\b/.test(text) || /\bfresh[\s-]?grad\b/.test(text)) return "new_grad";
  if (/\bpart[\s-]?time\b/.test(text)) return "part_time";
  if (
    /\bintern\b/.test(text) ||
    /\binternship\b/.test(text) ||
    /\buniversity\b/.test(text) ||
    /\bcampus\b/.test(text)
  ) {
    return "internship";
  }

  if (fallbackLevel === "associate") return "associate";
  if (fallbackLevel === "co_op") return "co_op";
  if (fallbackLevel === "new_grad") return "new_grad";
  if (fallbackLevel === "part_time") return "part_time";
  return "internship";
}


function inferExperienceBand(roleFamily: JobRoleFamily): ExperienceBand {
  if (roleFamily === "new_grad") return "new_grad";
  if (roleFamily === "associate") return "early_career";
  return "student";
}

export function canonicalizeJobUrl(url: string) {
  const parsed = new URL(url);
  parsed.hash = "";

  if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }

  return parsed.toString();
}

export function inferJobLevel(title: string, notes = ""): JobLevel {
  const normalized = `${title} ${notes}`.toLowerCase();

  if (normalized.includes("co-op") || normalized.includes("coop")) {
    return "co_op";
  }
  if (
    normalized.includes("new grad") ||
    normalized.includes("new-grad") ||
    normalized.includes("fresh grad")
  ) {
    return "new_grad";
  }
  if (normalized.includes("associate")) {
    return "associate";
  }
  if (normalized.includes("part time") || normalized.includes("part-time")) {
    return "part_time";
  }

  return "internship";
}

export function inferQualificationTags(input: {
  title: string;
  jdSummary?: string | null;
  level?: string | null;
}): NormalizedQualificationTags {
  const normalized = `${input.title} ${input.jdSummary ?? ""}`.toLowerCase();
  const roleFamily = inferRoleFamily(normalized, input.level ?? undefined);
  const targetTerm = parseTerm(normalized);
  const targetYear = parseYear(normalized);

  return {
    role_family: roleFamily,
    target_term: targetTerm,
    target_year: targetYear,
    experience_band: inferExperienceBand(roleFamily),
    is_early_career: true,
  };
}
