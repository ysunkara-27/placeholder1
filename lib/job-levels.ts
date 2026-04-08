import type { JobLevel } from "@/lib/types";

const JOB_LEVEL_ALIASES: Record<string, JobLevel> = {
  internship: "internship",
  intern: "internship",
  new_grad: "new_grad",
  newgrad: "new_grad",
  co_op: "co_op",
  coop: "co_op",
  part_time: "part_time",
  parttime: "part_time",
  associate: "associate",
};

export function normalizeJobLevel(value: string | null | undefined): JobLevel | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const compact = normalized.replace(/_/g, "");

  return JOB_LEVEL_ALIASES[normalized] ?? JOB_LEVEL_ALIASES[compact] ?? null;
}

export function normalizeJobLevelOrDefault(
  value: string | null | undefined,
  fallback: JobLevel = "internship"
): JobLevel {
  return normalizeJobLevel(value) ?? fallback;
}

export function formatJobLevelLabel(value: string | null | undefined): string {
  const normalized = normalizeJobLevel(value);
  if (normalized === "new_grad") return "New Grad";
  if (normalized === "co_op") return "Co-op";
  if (normalized === "part_time") return "Part-time";
  if (normalized === "associate") return "Associate";
  return "Internship";
}
