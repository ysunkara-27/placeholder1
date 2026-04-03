import type { Industry } from "@/lib/types";

const INDUSTRY_KEYWORDS: Array<{ industry: Industry; patterns: RegExp[] }> = [
  {
    industry: "SWE",
    patterns: [
      /\bsoftware\b/,
      /\bengineer(?:ing)?\b/,
      /\bdeveloper\b/,
      /\bswe\b/,
      /\bfrontend\b/,
      /\bbackend\b/,
      /\bfull[\s-]?stack\b/,
      /\bplatform\b/,
      /\binfrastructure\b/,
      /\bmobile\b/,
      /\bweb\b/,
    ],
  },
  {
    industry: "Data",
    patterns: [
      /\bdata\b/,
      /\bmachine learning\b/,
      /\bml\b/,
      /\banalytics\b/,
      /\bai\b/,
      /\bscience\b/,
    ],
  },
  {
    industry: "PM",
    patterns: [/\bproduct\b/, /\bpm\b/, /\bproduct manager\b/],
  },
  {
    industry: "Research",
    patterns: [/\bresearch\b/, /\bresearcher\b/],
  },
  {
    industry: "Finance",
    patterns: [/\bfinance\b/, /\bfinancial\b/, /\binvestment\b/, /\btrading\b/, /\bquant\b/],
  },
  {
    industry: "Consulting",
    patterns: [/\bconsult(?:ing|ant)?\b/, /\badvisory\b/, /\bstrategy\b/],
  },
  {
    industry: "Design",
    patterns: [/\bdesign\b/, /\bdesigner\b/, /\bux\b/, /\bui\b/, /\bgraphic\b/],
  },
  {
    industry: "Marketing",
    patterns: [/\bmarketing\b/, /\bgrowth\b/, /\bbrand\b/, /\bcontent\b/],
  },
  {
    industry: "Operations",
    patterns: [/\boperations?\b/, /\bbusiness ops\b/, /\bprogram manager\b/],
  },
  {
    industry: "Sales",
    patterns: [/\bsales\b/, /\baccount executive\b/, /\bbusiness development\b/],
  },
];

function dedupe(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function inferIndustriesFromJobText(title = "", summary = ""): Industry[] {
  const text = `${title} ${summary}`.toLowerCase();
  const matched = INDUSTRY_KEYWORDS
    .filter(({ patterns }) => patterns.some((pattern) => pattern.test(text)))
    .map(({ industry }) => industry);

  if (matched.length > 0) {
    return matched;
  }

  return /\bintern\b|\bengineer\b|\bdeveloper\b/.test(text) ? ["SWE"] : [];
}

export function normalizeJobIndustries(
  industries: string[] | null | undefined,
  title = "",
  summary = ""
): string[] {
  const normalizedExisting = dedupe(industries ?? []);
  if (normalizedExisting.length > 0) {
    return normalizedExisting;
  }

  return inferIndustriesFromJobText(title, summary);
}
