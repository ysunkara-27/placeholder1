import type { Industry, JobLevel, JobRoleFamily, WorkModality } from "@/lib/types";

export interface JobTaxonomyInput {
  company: string;
  title: string;
  level: string;
  role_family?: string | null;
  target_term?: string | null;
  target_year?: number | null;
  location: string;
  remote: boolean;
  industries: string[];
  jd_summary?: string | null;
}

type IndustryResolutionSource =
  | "company_prior"
  | "pattern_match"
  | "legacy_fallback"
  | "branch_fallback";

const COMPANY_PRIORS: Record<string, { primary: string[]; secondary?: string[] }> = {
  stripe: { primary: ["industry.finance.fintech"], secondary: ["industry.finance.payments", "industry.technology.enterprise_software"] },
  scale_ai: { primary: ["industry.technology.ai_ml"], secondary: ["industry.research.applied_research", "industry.technology.data_infrastructure"] },
  figma: { primary: ["industry.technology.enterprise_software"], secondary: ["industry.technology.consumer_software"] },
  databricks: { primary: ["industry.technology.data_infrastructure"], secondary: ["industry.technology.ai_ml", "industry.technology.enterprise_software"] },
  coinbase: { primary: ["industry.finance.fintech"], secondary: ["industry.finance.payments"] },
  brex: { primary: ["industry.finance.fintech"], secondary: ["industry.finance.payments", "industry.technology.enterprise_software"] },
  benchling: { primary: ["industry.healthcare_biotech.biotech"], secondary: ["industry.technology.enterprise_software"] },
  ramp: { primary: ["industry.finance.fintech"], secondary: ["industry.finance.payments", "industry.technology.enterprise_software"] },
  plaid: { primary: ["industry.finance.fintech"], secondary: ["industry.finance.payments"] },
  airtable: { primary: ["industry.technology.enterprise_software"], secondary: ["industry.technology.consumer_software"] },
  duolingo: { primary: ["industry.technology.consumer_software"], secondary: ["industry.technology.ai_ml"] },
  robinhood: { primary: ["industry.finance.fintech"], secondary: ["industry.technology.consumer_software"] },
  doordash: { primary: ["industry.consumer.marketplaces"], secondary: ["industry.industrial.logistics_infrastructure"] },
  lyft: { primary: ["industry.consumer.mobility"], secondary: ["industry.consumer.marketplaces"] },
  notion: { primary: ["industry.technology.enterprise_software"], secondary: ["industry.technology.consumer_software"] },
  retool: { primary: ["industry.technology.devtools"], secondary: ["industry.technology.enterprise_software"] },
  rippling: { primary: ["industry.technology.enterprise_software"], secondary: ["industry.finance.fintech"] },
  lattice: { primary: ["industry.technology.enterprise_software"] },
  linear: { primary: ["industry.technology.enterprise_software"], secondary: ["industry.technology.devtools"] },
  verkada: { primary: ["industry.industrial"], secondary: ["industry.industrial.defense_technology", "industry.technology.enterprise_software"] },
  anduril: { primary: ["industry.industrial.defense_technology"], secondary: ["industry.industrial.robotics_autonomy", "industry.research.applied_research"] },
  openai: { primary: ["industry.technology.ai_ml"], secondary: ["industry.research.applied_research"] },
  anthropic: { primary: ["industry.technology.ai_ml"], secondary: ["industry.research.applied_research"] },
  twilio: { primary: ["industry.technology.enterprise_software"], secondary: ["industry.finance.payments"] },
  asana: { primary: ["industry.technology.enterprise_software"] },
  instacart: { primary: ["industry.consumer.marketplaces"], secondary: ["industry.industrial.logistics_infrastructure"] },
  squarespace: { primary: ["industry.technology.consumer_software"], secondary: ["industry.technology.enterprise_software"] },
  chime: { primary: ["industry.finance.fintech"], secondary: ["industry.technology.consumer_software"] },
  gusto: { primary: ["industry.technology.enterprise_software"], secondary: ["industry.finance.fintech"] },
  affirm: { primary: ["industry.finance.fintech"], secondary: ["industry.finance.payments"] },
  flexport: { primary: ["industry.industrial.logistics_infrastructure"], secondary: ["industry.consumer.marketplaces"] },
  cruise: { primary: ["industry.industrial.robotics_autonomy"], secondary: ["industry.consumer.mobility", "industry.research.applied_research"] },
  waymo: { primary: ["industry.industrial.robotics_autonomy"], secondary: ["industry.consumer.mobility", "industry.research.applied_research"] },
  reddit: { primary: ["industry.consumer.social_media"], secondary: ["industry.technology.consumer_software"] },
  pinterest: { primary: ["industry.consumer.social_media"], secondary: ["industry.technology.consumer_software"] },
  microsoft: { primary: ["industry.technology.enterprise_software"], secondary: ["industry.technology.ai_ml", "industry.technology.consumer_software"] },
  amazon: { primary: ["industry.consumer.ecommerce"], secondary: ["industry.technology.enterprise_software", "industry.technology.ai_ml", "industry.industrial.logistics_infrastructure"] },
  google: { primary: ["industry.technology.consumer_software"], secondary: ["industry.technology.ai_ml", "industry.technology.enterprise_software"] },
};

const INDUSTRY_PATTERNS: Array<{ slug: string; patterns: RegExp[] }> = [
  { slug: "industry.finance.investment_banking", patterns: [/\binvestment banking\b/i, /\bm&a\b/i, /\bcapital markets\b/i] },
  { slug: "industry.finance.private_equity", patterns: [/\bprivate equity\b/i] },
  { slug: "industry.finance.hedge_fund", patterns: [/\bhedge fund\b/i] },
  { slug: "industry.finance.asset_management", patterns: [/\basset management\b/i, /\bportfolio management\b/i] },
  { slug: "industry.finance.fintech", patterns: [/\bfintech\b/i, /\bfinancial technology\b/i] },
  { slug: "industry.finance.payments", patterns: [/\bpayments?\b/i, /\bcard issuing\b/i] },
  { slug: "industry.healthcare_biotech.biotech", patterns: [/\bbiotech\b/i, /\bdrug discovery\b/i, /\bgenomics\b/i, /\btherapeutics\b/i] },
  { slug: "industry.healthcare_biotech.pharma", patterns: [/\bpharma(ceutical)?\b/i] },
  { slug: "industry.healthcare_biotech.medical_devices", patterns: [/\bmedical devices?\b/i] },
  { slug: "industry.healthcare_biotech.healthcare_services", patterns: [/\bhealthcare services?\b/i, /\bclinical\b/i] },
  { slug: "industry.technology.ai_ml", patterns: [/\bmachine learning\b/i, /\bartificial intelligence\b/i, /\bai\b/i, /\bfoundation models?\b/i] },
  { slug: "industry.technology.data_infrastructure", patterns: [/\bdata platform\b/i, /\bdata infrastructure\b/i, /\bdata pipelines?\b/i] },
  { slug: "industry.technology.devtools", patterns: [/\bdevtools\b/i, /\bdeveloper tools\b/i] },
  { slug: "industry.technology.cybersecurity", patterns: [/\bcybersecurity\b/i, /\bsecurity platform\b/i] },
  { slug: "industry.technology.enterprise_software", patterns: [/\benterprise software\b/i, /\bsaas\b/i, /\bplatform\b/i] },
  { slug: "industry.research.applied_research", patterns: [/\bapplied research\b/i, /\bresearch lab\b/i] },
  { slug: "industry.industrial.defense_technology", patterns: [/\bdefense technology\b/i, /\bitar\b/i] },
  { slug: "industry.industrial.robotics_autonomy", patterns: [/\brobotics\b/i, /\bautonomy\b/i, /\bautonomous\b/i] },
  { slug: "industry.industrial.semiconductor", patterns: [/\bsemiconductor\b/i, /\bchip\b/i] },
  { slug: "industry.industrial.logistics_infrastructure", patterns: [/\blogistics\b/i, /\bsupply chain\b/i, /\bfreight\b/i] },
  { slug: "industry.consumer.marketplaces", patterns: [/\bmarketplace\b/i, /\bdelivery platform\b/i] },
  { slug: "industry.consumer.mobility", patterns: [/\bmobility\b/i, /\brideshare\b/i, /\bautonomous vehicle\b/i] },
  { slug: "industry.consumer.ecommerce", patterns: [/\be-?commerce\b/i, /\bonline retail\b/i] },
  { slug: "industry.consumer.social_media", patterns: [/\bsocial media\b/i, /\bcreator platform\b/i] },
];

const JOB_FUNCTION_PATTERNS: Array<{ slug: string; patterns: RegExp[] }> = [
  { slug: "job_function.engineering.software_engineering.backend", patterns: [/\bbackend\b/i, /\bserver-side\b/i] },
  { slug: "job_function.engineering.software_engineering.frontend", patterns: [/\bfrontend\b/i, /\bui engineer\b/i] },
  { slug: "job_function.engineering.software_engineering.full_stack", patterns: [/\bfull[\s-]?stack\b/i] },
  { slug: "job_function.engineering.software_engineering.mobile", patterns: [/\bmobile\b/i, /\bios\b/i, /\bandroid\b/i] },
  { slug: "job_function.engineering.software_engineering.infra_platform", patterns: [/\binfrastructure\b/i, /\bplatform engineer\b/i, /\bdistributed systems\b/i] },
  { slug: "job_function.engineering.software_engineering.ml_engineering", patterns: [/\bml engineer\b/i, /\bmachine learning engineer\b/i] },
  { slug: "job_function.data.data_engineering", patterns: [/\bdata engineer\b/i, /\bdata pipeline\b/i] },
  { slug: "job_function.data.data_science", patterns: [/\bdata scientist\b/i, /\bdata science\b/i] },
  { slug: "job_function.data.quantitative_research", patterns: [/\bquant\b/i, /\bquantitative research\b/i] },
  { slug: "job_function.product.product_management", patterns: [/\bproduct manager\b/i, /\bproduct management\b/i] },
  { slug: "job_function.product.technical_product_management", patterns: [/\btechnical product manager\b/i] },
  { slug: "job_function.business.business_analyst", patterns: [/\bbusiness analyst\b/i] },
  { slug: "job_function.business.finance_analysis", patterns: [/\bfinancial analyst\b/i, /\bfinance analyst\b/i] },
  { slug: "job_function.business.strategy", patterns: [/\bstrategy\b/i, /\bstrategic\b/i] },
  { slug: "job_function.business.sales", patterns: [/\bsales\b/i, /\bbusiness development\b/i] },
  { slug: "job_function.research.research_science", patterns: [/\bresearch scientist\b/i] },
  { slug: "job_function.research.applied_science", patterns: [/\bapplied scientist\b/i, /\bresearch engineer\b/i] },
  { slug: "job_function.research.lab_research", patterns: [/\blab research\b/i, /\bresearch associate\b/i] },
  { slug: "job_function.design.ux_design", patterns: [/\bux\b/i, /\bproduct design\b/i, /\bdesigner\b/i] },
  { slug: "job_function.operations.supply_chain", patterns: [/\bsupply chain\b/i] },
  { slug: "job_function.operations.logistics", patterns: [/\blogistics\b/i] },
  { slug: "job_function.operations.operations_general", patterns: [/\boperations\b/i] },
];

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function splitLocationOptions(raw: string): string[] {
  return uniq(
    raw
      .split(/\s*(?:\||;|\n|\/)\s*/g)
      .flatMap((part) => part.split(/\s+\bor\b\s+/i))
      .map((part) => part.trim())
      .filter(Boolean)
  );
}

function normalizeSlug(raw: string) {
  return raw
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function companySlug(company: string) {
  return normalizeSlug(company);
}

function workModality(input: Pick<JobTaxonomyInput, "location" | "remote" | "jd_summary">): {
  value: WorkModality | "unknown";
  confidence: "high" | "medium" | "low";
} {
  if (input.remote) return { value: "remote", confidence: "high" };
  const text = `${input.location} ${input.jd_summary ?? ""}`.toLowerCase();
  if (/\bhybrid\b/.test(text)) return { value: "hybrid", confidence: "medium" };
  if (/\bonsite\b|\bin office\b|\bon-site\b/.test(text)) return { value: "onsite", confidence: "medium" };
  return { value: "unknown", confidence: "low" };
}

function geoNodeSlugs(location: string): string[] {
  const slugs: string[] = [];
  const cityMap: Record<string, string> = {
    "san francisco": "geo.usa.west.california.san_francisco_bay_area",
    "bay area": "geo.usa.west.california.san_francisco_bay_area",
    "los angeles": "geo.usa.west.california.los_angeles",
    "san diego": "geo.usa.west.california.san_diego",
    seattle: "geo.usa.west.washington.seattle",
    denver: "geo.usa.west.colorado.denver",
    "new york city": "geo.usa.northeast.new_york.new_york_city",
    nyc: "geo.usa.northeast.new_york.new_york_city",
    boston: "geo.usa.northeast.massachusetts.boston",
    pittsburgh: "geo.usa.northeast.pennsylvania.pittsburgh",
    austin: "geo.usa.south.texas.austin",
    dallas: "geo.usa.south.texas.dallas",
    houston: "geo.usa.south.texas.houston",
    atlanta: "geo.usa.south.georgia.atlanta",
    miami: "geo.usa.south.florida.miami",
    raleigh: "geo.usa.south.north_carolina.raleigh",
    chicago: "geo.usa.midwest.illinois.chicago",
    detroit: "geo.usa.midwest.michigan.detroit",
    columbus: "geo.usa.midwest.ohio.columbus",
    toronto: "geo.canada.ontario.toronto",
  };
  const stateMap: Record<string, string> = {
    "ct": "geo.usa.northeast.connecticut",
    "connecticut": "geo.usa.northeast.connecticut",
    "me": "geo.usa.northeast.maine",
    "maine": "geo.usa.northeast.maine",
    "ca": "geo.usa.west.california",
    "california": "geo.usa.west.california",
    "hi": "geo.usa.west.hawaii",
    "hawaii": "geo.usa.west.hawaii",
    "id": "geo.usa.west.idaho",
    "idaho": "geo.usa.west.idaho",
    "mt": "geo.usa.west.montana",
    "montana": "geo.usa.west.montana",
    "nv": "geo.usa.west.nevada",
    "nevada": "geo.usa.west.nevada",
    "nm": "geo.usa.west.new_mexico",
    "new mexico": "geo.usa.west.new_mexico",
    "or": "geo.usa.west.oregon",
    "oregon": "geo.usa.west.oregon",
    "ut": "geo.usa.west.utah",
    "utah": "geo.usa.west.utah",
    "wa": "geo.usa.west.washington",
    "washington": "geo.usa.west.washington",
    "co": "geo.usa.west.colorado",
    "colorado": "geo.usa.west.colorado",
    "ak": "geo.usa.west.alaska",
    "alaska": "geo.usa.west.alaska",
    "az": "geo.usa.west.arizona",
    "arizona": "geo.usa.west.arizona",
    "wy": "geo.usa.west.wyoming",
    "wyoming": "geo.usa.west.wyoming",
    "ny": "geo.usa.northeast.new_york",
    "new york": "geo.usa.northeast.new_york",
    "ma": "geo.usa.northeast.massachusetts",
    "massachusetts": "geo.usa.northeast.massachusetts",
    "nh": "geo.usa.northeast.new_hampshire",
    "new hampshire": "geo.usa.northeast.new_hampshire",
    "pa": "geo.usa.northeast.pennsylvania",
    "pennsylvania": "geo.usa.northeast.pennsylvania",
    "nj": "geo.usa.northeast.new_jersey",
    "new jersey": "geo.usa.northeast.new_jersey",
    "ri": "geo.usa.northeast.rhode_island",
    "rhode island": "geo.usa.northeast.rhode_island",
    "vt": "geo.usa.northeast.vermont",
    "vermont": "geo.usa.northeast.vermont",
    "al": "geo.usa.south.alabama",
    "alabama": "geo.usa.south.alabama",
    "ar": "geo.usa.south.arkansas",
    "arkansas": "geo.usa.south.arkansas",
    "de": "geo.usa.south.delaware",
    "delaware": "geo.usa.south.delaware",
    "tx": "geo.usa.south.texas",
    "texas": "geo.usa.south.texas",
    "ga": "geo.usa.south.georgia",
    "georgia": "geo.usa.south.georgia",
    "fl": "geo.usa.south.florida",
    "florida": "geo.usa.south.florida",
    "ky": "geo.usa.south.kentucky",
    "kentucky": "geo.usa.south.kentucky",
    "la": "geo.usa.south.louisiana",
    "louisiana": "geo.usa.south.louisiana",
    "md": "geo.usa.south.maryland",
    "maryland": "geo.usa.south.maryland",
    "ms": "geo.usa.south.mississippi",
    "mississippi": "geo.usa.south.mississippi",
    "nc": "geo.usa.south.north_carolina",
    "north carolina": "geo.usa.south.north_carolina",
    "ok": "geo.usa.south.oklahoma",
    "oklahoma": "geo.usa.south.oklahoma",
    "sc": "geo.usa.south.south_carolina",
    "south carolina": "geo.usa.south.south_carolina",
    "tn": "geo.usa.south.tennessee",
    "tennessee": "geo.usa.south.tennessee",
    "va": "geo.usa.south.virginia",
    "virginia": "geo.usa.south.virginia",
    "wv": "geo.usa.south.west_virginia",
    "west virginia": "geo.usa.south.west_virginia",
    "il": "geo.usa.midwest.illinois",
    "illinois": "geo.usa.midwest.illinois",
    "in": "geo.usa.midwest.indiana",
    "indiana": "geo.usa.midwest.indiana",
    "ia": "geo.usa.midwest.iowa",
    "iowa": "geo.usa.midwest.iowa",
    "ks": "geo.usa.midwest.kansas",
    "kansas": "geo.usa.midwest.kansas",
    "mi": "geo.usa.midwest.michigan",
    "michigan": "geo.usa.midwest.michigan",
    "mn": "geo.usa.midwest.minnesota",
    "minnesota": "geo.usa.midwest.minnesota",
    "mo": "geo.usa.midwest.missouri",
    "missouri": "geo.usa.midwest.missouri",
    "ne": "geo.usa.midwest.nebraska",
    "nebraska": "geo.usa.midwest.nebraska",
    "nd": "geo.usa.midwest.north_dakota",
    "north dakota": "geo.usa.midwest.north_dakota",
    "oh": "geo.usa.midwest.ohio",
    "ohio": "geo.usa.midwest.ohio",
    "sd": "geo.usa.midwest.south_dakota",
    "south dakota": "geo.usa.midwest.south_dakota",
    "wi": "geo.usa.midwest.wisconsin",
    "wisconsin": "geo.usa.midwest.wisconsin",
    "ab": "geo.canada.alberta",
    "alberta": "geo.canada.alberta",
    "bc": "geo.canada.british_columbia",
    "british columbia": "geo.canada.british_columbia",
    "mb": "geo.canada.manitoba",
    "manitoba": "geo.canada.manitoba",
    "nb": "geo.canada.new_brunswick",
    "new brunswick": "geo.canada.new_brunswick",
    "nl": "geo.canada.newfoundland_and_labrador",
    "newfoundland and labrador": "geo.canada.newfoundland_and_labrador",
    "nt": "geo.canada.northwest_territories",
    "northwest territories": "geo.canada.northwest_territories",
    "ns": "geo.canada.nova_scotia",
    "nova scotia": "geo.canada.nova_scotia",
    "nu": "geo.canada.nunavut",
    "nunavut": "geo.canada.nunavut",
    "on": "geo.canada.ontario",
    "ontario": "geo.canada.ontario",
    "pe": "geo.canada.prince_edward_island",
    "pei": "geo.canada.prince_edward_island",
    "prince edward island": "geo.canada.prince_edward_island",
    "qc": "geo.canada.quebec",
    "quebec": "geo.canada.quebec",
    "sk": "geo.canada.saskatchewan",
    "saskatchewan": "geo.canada.saskatchewan",
    "yk": "geo.canada.yukon",
    "yukon": "geo.canada.yukon",
  };
  const options = splitLocationOptions(location);
  for (const option of options.length > 0 ? options : [location]) {
    const text = option.toLowerCase();
    for (const [match, slug] of Object.entries(cityMap)) {
      if (text.includes(match)) slugs.push(slug);
    }
    for (const [match, slug] of Object.entries(stateMap)) {
      if (new RegExp(`(^|[\\s,\\-])${match}($|[\\s,])`, "i").test(text)) slugs.push(slug);
    }
    slugs.push(text.includes("canada") ? "geo.canada" : "geo.usa");
  }
  return uniq(slugs);
}

function careerNodeSlugs(input: Pick<JobTaxonomyInput, "title" | "level" | "role_family" | "target_term">): string[] {
  const slugs: string[] = [];
  const raw = `${input.title} ${input.level} ${input.role_family ?? ""}`.toLowerCase();
  if (raw.includes("co-op") || raw.includes("coop") || input.role_family === "co_op" || input.level === "co_op") {
    slugs.push("career_role.student.co_op", "employment_type.temporary.co_op");
  } else if (raw.includes("new grad") || raw.includes("new graduate") || input.role_family === "new_grad" || input.level === "new_grad") {
    slugs.push("career_role.early_career.new_grad", "employment_type.permanent.full_time");
  } else if (raw.includes("associate") || input.role_family === "associate" || input.level === "associate") {
    slugs.push("career_role.early_career.associate", "employment_type.permanent.full_time");
  } else if (raw.includes("part-time") || raw.includes("part time") || input.role_family === "part_time" || input.level === "part_time") {
    slugs.push("career_role.student.part_time_student", "employment_type.permanent.part_time");
  } else {
    slugs.push("career_role.student.internship", "employment_type.temporary.internship");
  }
  const term = (input.target_term ?? "").toLowerCase();
  if (term && ["spring", "summer", "fall", "winter"].includes(term)) {
    slugs.push(`career_role.student.internship.${term}`);
  }
  return uniq(slugs);
}

function taxonomyIndustries(input: JobTaxonomyInput): string[] {
  return resolveIndustryTaxonomy(input).slugs;
}

function resolveIndustryTaxonomy(input: JobTaxonomyInput): {
  slugs: string[];
  company_slug: string;
  company_prior_known: boolean;
  sources: IndustryResolutionSource[];
  matched_pattern_slugs: string[];
  fallback_branch_slug: string | null;
} {
  const text = `${input.company} ${input.title} ${input.jd_summary ?? ""}`.toLowerCase();
  const slug = companySlug(input.company);
  const prior = COMPANY_PRIORS[slug];
  const slugs = [...(prior?.primary ?? []), ...(prior?.secondary ?? [])];
  const sources: IndustryResolutionSource[] = prior ? ["company_prior"] : [];
  const matchedPatternSlugs: string[] = [];
  let fallbackBranchSlug: string | null = null;
  for (const entry of INDUSTRY_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(text))) {
      slugs.push(entry.slug);
      matchedPatternSlugs.push(entry.slug);
    }
  }
  if (matchedPatternSlugs.length > 0) {
    sources.push("pattern_match");
  }
  if (slugs.length === 0) {
    const existing = input.industries.map((industry) => industry.toLowerCase());
    if (existing.includes("finance")) fallbackBranchSlug = "industry.finance";
    else if (existing.includes("consulting")) fallbackBranchSlug = "industry.consulting";
    else if (existing.includes("research")) fallbackBranchSlug = "industry.research";
    else if (existing.includes("healthcare")) fallbackBranchSlug = "industry.healthcare_biotech";
    if (fallbackBranchSlug) {
      slugs.push(fallbackBranchSlug);
      sources.push("legacy_fallback");
    } else {
      fallbackBranchSlug = "industry.technology";
      slugs.push(fallbackBranchSlug);
      sources.push("branch_fallback");
    }
  }
  return {
    slugs: uniq(slugs),
    company_slug: slug,
    company_prior_known: Boolean(prior),
    sources: Array.from(new Set(sources)),
    matched_pattern_slugs: uniq(matchedPatternSlugs),
    fallback_branch_slug: fallbackBranchSlug,
  };
}

function taxonomyJobFunctions(input: JobTaxonomyInput): string[] {
  const text = `${input.title} ${input.jd_summary ?? ""}`.toLowerCase();
  const slugs: string[] = [];
  for (const entry of JOB_FUNCTION_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(text))) slugs.push(entry.slug);
  }
  if (slugs.length === 0) {
    if (/\bengineer|developer|software\b/.test(text)) slugs.push("job_function.engineering.software_engineering");
    else if (/\bdata|analytics|science\b/.test(text)) slugs.push("job_function.data");
    else if (/\bproduct\b/.test(text)) slugs.push("job_function.product");
    else if (/\bresearch\b/.test(text)) slugs.push("job_function.research");
    else if (/\bdesign\b/.test(text)) slugs.push("job_function.design");
    else if (/\boperations\b/.test(text)) slugs.push("job_function.operations");
    else slugs.push("job_function.other");
  }
  return uniq(slugs);
}

function legacyIndustriesFromTaxonomy(slugs: string[]): Industry[] {
  const result: Industry[] = [];
  if (slugs.some((slug) => slug.includes(".finance"))) result.push("Finance");
  if (slugs.some((slug) => slug.includes(".consulting"))) result.push("Consulting");
  if (slugs.some((slug) => slug.includes(".biotech") || slug.includes(".healthcare"))) result.push("Healthcare");
  if (slugs.some((slug) => slug.includes(".research"))) result.push("Research");
  if (slugs.some((slug) => slug.includes(".ai_ml") || slug.includes(".data_infrastructure"))) result.push("Data");
  if (slugs.some((slug) => slug.includes(".enterprise_software") || slug.includes(".devtools") || slug.includes(".consumer_software"))) result.push("SWE");
  return uniq(result) as Industry[];
}

export function buildJobTaxonomy(input: JobTaxonomyInput) {
  const modality = workModality(input);
  const industryResolution = resolveIndustryTaxonomy(input);
  const industrySlugs = industryResolution.slugs;
  const jobFunctionSlugs = taxonomyJobFunctions(input);
  const careerSlugs = careerNodeSlugs(input);
  const geoSlugs = geoNodeSlugs(input.location);
  const needsReview =
    industrySlugs.some((slug) => slug === "industry.technology" || slug === "industry.other")
    || !industryResolution.company_prior_known
    || industryResolution.sources.includes("branch_fallback");

  const employmentTypeNodeSlugs = careerSlugs.filter((slug) => slug.startsWith("employment_type."));
  const careerNodeSlugsOnly = careerSlugs.filter((slug) => slug.startsWith("career_role."));
  return {
    work_modality: modality.value,
    work_modality_confidence: modality.confidence,
    locations_text: splitLocationOptions(input.location),
    industry_node_slugs: industrySlugs,
    job_function_node_slugs: jobFunctionSlugs,
    career_node_slugs: careerNodeSlugsOnly,
    geo_node_slugs: geoSlugs,
    employment_type_node_slugs: employmentTypeNodeSlugs,
    work_auth_node_slugs: [] as string[],
    degree_requirement_node_slugs: [] as string[],
    education_field_node_slugs: [] as string[],
    taxonomy_needs_review: needsReview,
    taxonomy_resolution_version: "taxonomy-mvp-v1",
    legacy_industries: uniq([...input.industries, ...legacyIndustriesFromTaxonomy(industrySlugs)]) as string[],
    summary: {
      version: "taxonomy-mvp-v1",
      company_slug: industryResolution.company_slug,
      company_prior_known: industryResolution.company_prior_known,
      industry_resolution_sources: industryResolution.sources,
      industry_pattern_matches: industryResolution.matched_pattern_slugs,
      industry_fallback_branch_slug: industryResolution.fallback_branch_slug,
      industry_node_slugs: industrySlugs,
      job_function_node_slugs: jobFunctionSlugs,
      career_node_slugs: careerNodeSlugsOnly,
      geo_node_slugs: geoSlugs,
      location_options_text: splitLocationOptions(input.location),
      employment_type_node_slugs: employmentTypeNodeSlugs,
      work_modality: modality.value,
      work_modality_confidence: modality.confidence,
    },
  };
}
