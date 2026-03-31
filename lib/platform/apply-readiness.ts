import { detectPortalFromUrl, type PortalKind } from "@/lib/portal";

export type ReadinessBucket =
  | "contact"
  | "resume"
  | "authorization"
  | "education"
  | "availability"
  | "eeo";

export type ReadinessIssue = {
  bucket: ReadinessBucket;
  field: string;
  label: string;
};

export type ApplyReadinessSummary = {
  ready: boolean;
  critical_issue_count: number;
  issue_count: number;
  bucket_counts: Record<ReadinessBucket, number>;
  critical_issues: ReadinessIssue[];
  issues: ReadinessIssue[];
};

export type PortalApplyReadinessSummary = ApplyReadinessSummary & {
  portal: PortalKind;
  risk_level: "ready" | "risky" | "blocked";
  likely_issue_count: number;
  likely_bucket_counts: Record<ReadinessBucket, number>;
  likely_issues: ReadinessIssue[];
  historical_issue_count: number;
  historical_bucket_counts: Record<ReadinessBucket, number>;
  historical_issues: ReadinessIssue[];
};

export type ApplyRunHistorySignal = {
  portal: string | null;
  summary?: {
    blocked_field_family?:
      | "contact"
      | "resume"
      | "authorization"
      | "education"
      | "availability"
      | "eeo"
      | "custom"
      | "unknown"
      | null;
    failure_source?: "profile_data" | "automation" | "mixed" | "unknown" | null;
    error_kind?: "none" | "auth" | "validation" | "execution";
  } | null;
};

export type ApplyReadinessProfile = {
  email: string;
  phone: string;
  resume_pdf_path: string;
  work_authorization: string;
  school: string;
  graduation: string;
  start_date: string;
  weekly_availability_hours: string;
  eeo?: Record<string, string>;
};

const FIELD_RULES: Array<ReadinessIssue & { check: (profile: ApplyReadinessProfile) => boolean }> = [
  {
    bucket: "contact",
    field: "email",
    label: "Email",
    check: (profile) => profile.email.trim().length > 0,
  },
  {
    bucket: "contact",
    field: "phone",
    label: "Phone",
    check: (profile) => profile.phone.trim().length > 0,
  },
  {
    bucket: "resume",
    field: "resume_pdf_path",
    label: "Resume PDF",
    check: (profile) => profile.resume_pdf_path.trim().length > 0,
  },
  {
    bucket: "authorization",
    field: "work_authorization",
    label: "Work authorization",
    check: (profile) => profile.work_authorization.trim().length > 0,
  },
  {
    bucket: "education",
    field: "school",
    label: "School",
    check: (profile) => profile.school.trim().length > 0,
  },
  {
    bucket: "education",
    field: "graduation",
    label: "Graduation",
    check: (profile) => profile.graduation.trim().length > 0,
  },
  {
    bucket: "availability",
    field: "start_date",
    label: "Start date",
    check: (profile) => profile.start_date.trim().length > 0,
  },
  {
    bucket: "availability",
    field: "weekly_availability_hours",
    label: "Weekly hours",
    check: (profile) => profile.weekly_availability_hours.trim().length > 0,
  },
  {
    bucket: "eeo",
    field: "eeo.gender",
    label: "EEO gender",
    check: (profile) => (profile.eeo?.gender ?? "").trim().length > 0,
  },
];

const PORTAL_LIKELY_BUCKETS: Record<PortalKind, ReadinessBucket[]> = {
  greenhouse: ["education", "availability", "eeo"],
  lever: ["education", "availability", "eeo"],
  workday: ["education", "availability", "eeo"],
  ashby: ["education", "availability", "eeo"],
  handshake: ["education", "availability"],
  vision: ["education", "availability", "eeo"],
};

const FAMILY_TO_BUCKET: Record<
  NonNullable<
    NonNullable<ApplyRunHistorySignal["summary"]>["blocked_field_family"]
  >,
  ReadinessBucket | null
> = {
  contact: "contact",
  resume: "resume",
  authorization: "authorization",
  education: "education",
  availability: "availability",
  eeo: "eeo",
  custom: null,
  unknown: null,
};

export function getApplyReadinessIssues(
  profile: ApplyReadinessProfile
): ReadinessIssue[] {
  return FIELD_RULES.filter((rule) => !rule.check(profile)).map(
    ({ bucket, field, label }) => ({
      bucket,
      field,
      label,
    })
  );
}

export function getCriticalReadinessIssues(
  profile: ApplyReadinessProfile
): ReadinessIssue[] {
  const criticalBuckets: ReadinessBucket[] = ["contact", "resume", "authorization"];
  return getApplyReadinessIssues(profile).filter((issue) =>
    criticalBuckets.includes(issue.bucket)
  );
}

export function summarizeReadinessBuckets(issues: ReadinessIssue[]): Record<ReadinessBucket, number> {
  return issues.reduce<Record<ReadinessBucket, number>>(
    (accumulator, issue) => {
      accumulator[issue.bucket] += 1;
      return accumulator;
    },
    {
      contact: 0,
      resume: 0,
      authorization: 0,
      education: 0,
      availability: 0,
      eeo: 0,
    }
  );
}

export function buildApplyReadinessSummary(
  profile: ApplyReadinessProfile
): ApplyReadinessSummary {
  const issues = getApplyReadinessIssues(profile);
  const criticalIssues = getCriticalReadinessIssues(profile);

  return {
    ready: criticalIssues.length === 0,
    critical_issue_count: criticalIssues.length,
    issue_count: issues.length,
    bucket_counts: summarizeReadinessBuckets(issues),
    critical_issues: criticalIssues,
    issues,
  };
}

export function getPortalLikelyReadinessIssues(
  profile: ApplyReadinessProfile,
  portal: PortalKind
): ReadinessIssue[] {
  const likelyBuckets = new Set<ReadinessBucket>([
    "contact",
    "resume",
    "authorization",
    ...PORTAL_LIKELY_BUCKETS[portal],
  ]);

  return getApplyReadinessIssues(profile).filter((issue) =>
    likelyBuckets.has(issue.bucket)
  );
}

export function getHistoricalLikelyReadinessIssues(
  profile: ApplyReadinessProfile,
  portal: PortalKind,
  runs: ApplyRunHistorySignal[]
): ReadinessIssue[] {
  const historicalBuckets = new Set<ReadinessBucket>();

  for (const run of runs) {
    if (run.portal !== portal) {
      continue;
    }

    const family = run.summary?.blocked_field_family;
    const source = run.summary?.failure_source;
    const kind = run.summary?.error_kind;

    if (!family || family === "unknown" || family === "custom") {
      continue;
    }

    if (kind === "auth" || kind === "none") {
      continue;
    }

    if (source !== "profile_data" && source !== "mixed" && source !== "automation") {
      continue;
    }

    const bucket = FAMILY_TO_BUCKET[family];
    if (bucket) {
      historicalBuckets.add(bucket);
    }
  }

  if (historicalBuckets.size === 0) {
    return [];
  }

  return getApplyReadinessIssues(profile).filter((issue) =>
    historicalBuckets.has(issue.bucket)
  );
}

function dedupeReadinessIssues(issues: ReadinessIssue[]): ReadinessIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.bucket}:${issue.field}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function buildPortalApplyReadinessSummary(
  profile: ApplyReadinessProfile,
  portal: PortalKind,
  runs: ApplyRunHistorySignal[] = []
): PortalApplyReadinessSummary {
  const base = buildApplyReadinessSummary(profile);
  const staticLikelyIssues = getPortalLikelyReadinessIssues(profile, portal);
  const historicalIssues = getHistoricalLikelyReadinessIssues(profile, portal, runs);
  const likelyIssues = dedupeReadinessIssues([...staticLikelyIssues, ...historicalIssues]);

  return {
    ...base,
    portal,
    risk_level:
      base.critical_issue_count > 0
        ? "blocked"
        : likelyIssues.length > 0
        ? "risky"
        : "ready",
    likely_issue_count: likelyIssues.length,
    likely_bucket_counts: summarizeReadinessBuckets(likelyIssues),
    likely_issues: likelyIssues,
    historical_issue_count: historicalIssues.length,
    historical_bucket_counts: summarizeReadinessBuckets(historicalIssues),
    historical_issues: historicalIssues,
  };
}

export function buildUrlApplyReadinessSummary(
  profile: ApplyReadinessProfile,
  url: string,
  runs: ApplyRunHistorySignal[] = []
): PortalApplyReadinessSummary {
  return buildPortalApplyReadinessSummary(profile, detectPortalFromUrl(url), runs);
}
