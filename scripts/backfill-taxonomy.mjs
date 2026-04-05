import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function loadDotEnvFile(filename) {
  const fullPath = path.join(process.cwd(), filename);
  if (!existsSync(fullPath)) return;
  const contents = readFileSync(fullPath, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnvFile(".env.local");
loadDotEnvFile(".env");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeSlug(raw) {
  return raw
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function modalitySelection(remoteOk, workModalityAllow) {
  if (Array.isArray(workModalityAllow) && workModalityAllow.length > 0) return uniq(workModalityAllow);
  return remoteOk ? ["remote", "hybrid", "onsite"] : ["hybrid", "onsite"];
}

const INDUSTRY_SLUGS = {
  SWE: ["industry.technology.enterprise_software"],
  Data: ["industry.technology.data_infrastructure", "industry.technology.ai_ml"],
  PM: ["job_function.product.product_management"],
  Design: ["job_function.design.ux_design"],
  Hardware: ["industry.industrial.semiconductor", "job_function.engineering.hardware_engineering"],
  MechEng: ["education_field.engineering.mechanical_engineering"],
  CivilEng: ["education_field.engineering"],
  ChemEng: ["education_field.natural_sciences.chemistry"],
  AeroEng: ["industry.industrial.defense_technology", "education_field.engineering"],
  LifeSci: ["industry.healthcare_biotech.biotech", "education_field.natural_sciences.biology"],
  Research: ["industry.research.applied_research", "job_function.research.research_science"],
  Healthcare: ["industry.healthcare_biotech.healthcare_services"],
  Finance: ["industry.finance.fintech"],
  Consulting: ["industry.consulting.management_consulting"],
  Marketing: ["education_field.business.marketing"],
  Legal: ["industry.public_sector"],
  Operations: ["job_function.operations.operations_general"],
  Sales: ["job_function.business.sales"],
  Policy: ["industry.public_sector"],
  Education: ["industry.public_sector"],
};

const CAREER_ROLE_SLUGS = {
  internship: ["career_role.student.internship"],
  new_grad: ["career_role.early_career.new_grad"],
  part_time: ["career_role.student.part_time_student"],
  co_op: ["career_role.student.co_op"],
  associate: ["career_role.early_career.associate"],
};

const TERM_TO_CAREER_SLUG = {
  spring: "career_role.student.internship.spring",
  summer: "career_role.student.internship.summer",
  fall: "career_role.student.internship.fall",
  winter: "career_role.student.internship.winter",
};

const DEGREE_MAP = [
  { match: /\b(mba)\b/i, slug: "education_degree.graduate.mba" },
  { match: /\b(ph\.?d|doctor)/i, slug: "education_degree.graduate.doctorate" },
  { match: /\b(m\.?s|master|meng)\b/i, slug: "education_degree.graduate.masters" },
  { match: /\b(b\.?s|bachelor|beng|b\.?a)\b/i, slug: "education_degree.undergraduate.bachelors" },
  { match: /\bassociate\b/i, slug: "education_degree.undergraduate.associates" },
];

const EDU_FIELD_MAP = [
  { match: /computer science|software|informatics/i, slug: "education_field.engineering.computer_science" },
  { match: /electrical/i, slug: "education_field.engineering.electrical_engineering" },
  { match: /mechanical/i, slug: "education_field.engineering.mechanical_engineering" },
  { match: /bio(engineering|medical)|biomedical/i, slug: "education_field.engineering.bioengineering" },
  { match: /\bfinance\b/i, slug: "education_field.business.finance" },
  { match: /\baccounting\b/i, slug: "education_field.business.accounting" },
  { match: /\bmarketing\b/i, slug: "education_field.business.marketing" },
  { match: /\beconomics\b/i, slug: "education_field.humanities_social_sciences.economics" },
  { match: /\bmath|mathematics\b/i, slug: "education_field.math_statistics.mathematics" },
  { match: /\bstatistics|stat\b/i, slug: "education_field.math_statistics.statistics" },
  { match: /\bbiology|biological\b/i, slug: "education_field.natural_sciences.biology" },
  { match: /\bchemistry|chemical\b/i, slug: "education_field.natural_sciences.chemistry" },
  { match: /\bphysics\b/i, slug: "education_field.natural_sciences.physics" },
];

const VISA_TO_AUTH = {
  citizen: ["work_authorization.eligible_to_work.us_citizen", "work_authorization.sponsorship.no_sponsorship_needed"],
  green_card: ["work_authorization.eligible_to_work.permanent_resident", "work_authorization.sponsorship.no_sponsorship_needed"],
  opt: ["work_authorization.eligible_to_work.student_work_auth", "work_authorization.visa_program.f1_opt", "work_authorization.sponsorship.future_sponsorship_needed"],
  cpt: ["work_authorization.eligible_to_work.student_work_auth", "work_authorization.visa_program.cpt", "work_authorization.sponsorship.future_sponsorship_needed"],
  h1b: ["work_authorization.visa_program.h1b", "work_authorization.sponsorship.current_sponsorship_needed"],
  tn: ["work_authorization.eligible_to_work.unrestricted_work_auth", "work_authorization.sponsorship.current_sponsorship_needed"],
  other: ["work_authorization.sponsorship.current_sponsorship_needed"],
};

const CITY_SLUGS = {
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

const STATE_SLUGS = {
  ct: "geo.usa.northeast.connecticut",
  connecticut: "geo.usa.northeast.connecticut",
  me: "geo.usa.northeast.maine",
  maine: "geo.usa.northeast.maine",
  ca: "geo.usa.west.california",
  california: "geo.usa.west.california",
  hi: "geo.usa.west.hawaii",
  hawaii: "geo.usa.west.hawaii",
  id: "geo.usa.west.idaho",
  idaho: "geo.usa.west.idaho",
  mt: "geo.usa.west.montana",
  montana: "geo.usa.west.montana",
  nv: "geo.usa.west.nevada",
  nevada: "geo.usa.west.nevada",
  nm: "geo.usa.west.new_mexico",
  "new mexico": "geo.usa.west.new_mexico",
  or: "geo.usa.west.oregon",
  oregon: "geo.usa.west.oregon",
  ut: "geo.usa.west.utah",
  utah: "geo.usa.west.utah",
  wa: "geo.usa.west.washington",
  washington: "geo.usa.west.washington",
  co: "geo.usa.west.colorado",
  colorado: "geo.usa.west.colorado",
  ak: "geo.usa.west.alaska",
  alaska: "geo.usa.west.alaska",
  az: "geo.usa.west.arizona",
  arizona: "geo.usa.west.arizona",
  wy: "geo.usa.west.wyoming",
  wyoming: "geo.usa.west.wyoming",
  ny: "geo.usa.northeast.new_york",
  "new york": "geo.usa.northeast.new_york",
  ma: "geo.usa.northeast.massachusetts",
  massachusetts: "geo.usa.northeast.massachusetts",
  nh: "geo.usa.northeast.new_hampshire",
  "new hampshire": "geo.usa.northeast.new_hampshire",
  pa: "geo.usa.northeast.pennsylvania",
  pennsylvania: "geo.usa.northeast.pennsylvania",
  nj: "geo.usa.northeast.new_jersey",
  "new jersey": "geo.usa.northeast.new_jersey",
  ri: "geo.usa.northeast.rhode_island",
  "rhode island": "geo.usa.northeast.rhode_island",
  vt: "geo.usa.northeast.vermont",
  vermont: "geo.usa.northeast.vermont",
  al: "geo.usa.south.alabama",
  alabama: "geo.usa.south.alabama",
  ar: "geo.usa.south.arkansas",
  arkansas: "geo.usa.south.arkansas",
  de: "geo.usa.south.delaware",
  delaware: "geo.usa.south.delaware",
  tx: "geo.usa.south.texas",
  texas: "geo.usa.south.texas",
  ga: "geo.usa.south.georgia",
  georgia: "geo.usa.south.georgia",
  fl: "geo.usa.south.florida",
  florida: "geo.usa.south.florida",
  ky: "geo.usa.south.kentucky",
  kentucky: "geo.usa.south.kentucky",
  la: "geo.usa.south.louisiana",
  louisiana: "geo.usa.south.louisiana",
  md: "geo.usa.south.maryland",
  maryland: "geo.usa.south.maryland",
  ms: "geo.usa.south.mississippi",
  mississippi: "geo.usa.south.mississippi",
  nc: "geo.usa.south.north_carolina",
  "north carolina": "geo.usa.south.north_carolina",
  ok: "geo.usa.south.oklahoma",
  oklahoma: "geo.usa.south.oklahoma",
  sc: "geo.usa.south.south_carolina",
  "south carolina": "geo.usa.south.south_carolina",
  tn: "geo.usa.south.tennessee",
  tennessee: "geo.usa.south.tennessee",
  va: "geo.usa.south.virginia",
  virginia: "geo.usa.south.virginia",
  wv: "geo.usa.south.west_virginia",
  "west virginia": "geo.usa.south.west_virginia",
  il: "geo.usa.midwest.illinois",
  illinois: "geo.usa.midwest.illinois",
  in: "geo.usa.midwest.indiana",
  indiana: "geo.usa.midwest.indiana",
  ia: "geo.usa.midwest.iowa",
  iowa: "geo.usa.midwest.iowa",
  ks: "geo.usa.midwest.kansas",
  kansas: "geo.usa.midwest.kansas",
  mi: "geo.usa.midwest.michigan",
  michigan: "geo.usa.midwest.michigan",
  mn: "geo.usa.midwest.minnesota",
  minnesota: "geo.usa.midwest.minnesota",
  mo: "geo.usa.midwest.missouri",
  missouri: "geo.usa.midwest.missouri",
  ne: "geo.usa.midwest.nebraska",
  nebraska: "geo.usa.midwest.nebraska",
  nd: "geo.usa.midwest.north_dakota",
  "north dakota": "geo.usa.midwest.north_dakota",
  oh: "geo.usa.midwest.ohio",
  ohio: "geo.usa.midwest.ohio",
  sd: "geo.usa.midwest.south_dakota",
  "south dakota": "geo.usa.midwest.south_dakota",
  wi: "geo.usa.midwest.wisconsin",
  wisconsin: "geo.usa.midwest.wisconsin",
  ontario: "geo.canada.ontario",
};

function inferGeoSlugs(values, country, stateRegion) {
  const normalizedValues = uniq([...values, stateRegion, country].map((v) => String(v || "").trim().toLowerCase()));
  const cities = normalizedValues.map((v) => CITY_SLUGS[v]).filter(Boolean);
  const states = normalizedValues.map((v) => STATE_SLUGS[v]).filter(Boolean);
  const countrySlug = String(country || "").trim().toLowerCase() === "canada" ? "geo.canada" : "geo.usa";
  return uniq([...cities, ...states, countrySlug]);
}

function inferProfileTaxonomy(profile) {
  const workModalityAllow = modalitySelection(profile.remote_ok, profile.profile_work_modality_allow);
  const industryNodeSlugs = uniq((profile.industries || []).flatMap((value) => INDUSTRY_SLUGS[value] || []));
  const careerNodeSlugs = uniq([
    ...(profile.levels || []).flatMap((value) => CAREER_ROLE_SLUGS[value] || []),
    ...(profile.target_role_families || []).flatMap((value) => CAREER_ROLE_SLUGS[value] || []),
    ...(profile.target_terms || []).flatMap((term) => {
      const normalized = String(term || "").toLowerCase();
      return Object.entries(TERM_TO_CAREER_SLUG).flatMap(([key, slug]) => normalized.includes(key) ? [slug] : []);
    }),
  ]);
  const employmentTypeNodeSlugs = uniq((profile.levels || []).map((level) => {
    if (level === "internship") return "employment_type.temporary.internship";
    if (level === "co_op") return "employment_type.temporary.co_op";
    if (level === "part_time") return "employment_type.permanent.part_time";
    return "employment_type.permanent.full_time";
  }));
  const geoPreferenceSlugs = inferGeoSlugs(profile.locations || [], profile.country || "United States", profile.state_region || "");
  const degreeNode = DEGREE_MAP.find((entry) => entry.match.test(String(profile.degree || "")));
  const educationFieldNodeSlugs = uniq([profile.major, profile.major2].filter(Boolean).flatMap((value) =>
    EDU_FIELD_MAP.filter((entry) => entry.match.test(String(value))).map((entry) => entry.slug)
  ));
  const workAuthNodeSlugs = uniq([
    ...(VISA_TO_AUTH[profile.visa_type] || []),
    profile.authorized_to_work
      ? "work_authorization.eligible_to_work.unrestricted_work_auth"
      : "work_authorization.sponsorship.current_sponsorship_needed",
  ]);
  return {
    matchPreferences: {
      version: "taxonomy-mvp-v1",
      work_modality_allow: workModalityAllow,
      open_to_relocate: Boolean(profile.profile_match_preferences?.open_to_relocate || false),
      geo_preferences: { raw_locations: profile.locations || [], node_slugs: geoPreferenceSlugs },
      industries: { legacy_values: profile.industries || [], node_slugs: industryNodeSlugs },
      career_roles: {
        legacy_levels: profile.levels || [],
        target_role_families: profile.target_role_families || [],
        target_terms: profile.target_terms || [],
        target_years: profile.target_years || [],
        node_slugs: careerNodeSlugs,
      },
      employment_types: { node_slugs: employmentTypeNodeSlugs },
    },
    applicationFacts: {
      version: "taxonomy-mvp-v1",
      current_location: {
        city: profile.city || "",
        state_region: profile.state_region || "",
        country: profile.country || "United States",
        node_slugs: inferGeoSlugs([profile.city || ""], profile.country || "United States", profile.state_region || ""),
      },
      education_records: [{
        school: profile.school || "",
        degree: profile.degree || "",
        degree_node_slugs: degreeNode ? [degreeNode.slug] : [],
        major: profile.major || "",
        secondary_major_or_minor: profile.major2 || "",
        major_node_slugs: educationFieldNodeSlugs,
        gpa: profile.gpa || "",
        graduation: profile.graduation || "",
      }],
      work_authorization: {
        authorized_to_work: profile.authorized_to_work,
        visa_type: profile.visa_type || "",
        requires_sponsorship: !profile.authorized_to_work || ["opt", "cpt", "h1b", "tn", "other"].includes(profile.visa_type || ""),
        node_slugs: workAuthNodeSlugs,
      },
      disclosure_policies: {
        gpa: profile.profile_application_facts?.disclosure_policies?.gpa || "required_only",
        demographics: profile.profile_application_facts?.disclosure_policies?.demographics || "required_only",
      },
    },
  };
}

const COMPANY_PRIORS = {
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
};

const INDUSTRY_PATTERNS = [
  { slug: "industry.finance.investment_banking", patterns: [/\binvestment banking\b/i, /\bm&a\b/i, /\bcapital markets\b/i] },
  { slug: "industry.finance.private_equity", patterns: [/\bprivate equity\b/i] },
  { slug: "industry.finance.hedge_fund", patterns: [/\bhedge fund\b/i] },
  { slug: "industry.finance.asset_management", patterns: [/\basset management\b/i, /\bportfolio management\b/i] },
  { slug: "industry.finance.fintech", patterns: [/\bfintech\b/i] },
  { slug: "industry.finance.payments", patterns: [/\bpayments?\b/i] },
  { slug: "industry.healthcare_biotech.biotech", patterns: [/\bbiotech\b/i, /\bdrug discovery\b/i, /\bgenomics\b/i, /\btherapeutics\b/i] },
  { slug: "industry.healthcare_biotech.pharma", patterns: [/\bpharma(ceutical)?\b/i] },
  { slug: "industry.technology.ai_ml", patterns: [/\bmachine learning\b/i, /\bartificial intelligence\b/i, /\bai\b/i, /\bfoundation models?\b/i] },
  { slug: "industry.technology.data_infrastructure", patterns: [/\bdata platform\b/i, /\bdata infrastructure\b/i, /\bdata pipelines?\b/i] },
  { slug: "industry.technology.devtools", patterns: [/\bdevtools\b/i, /\bdeveloper tools\b/i] },
  { slug: "industry.technology.enterprise_software", patterns: [/\benterprise software\b/i, /\bsaas\b/i] },
  { slug: "industry.research.applied_research", patterns: [/\bapplied research\b/i, /\bresearch lab\b/i] },
  { slug: "industry.industrial.defense_technology", patterns: [/\bdefense technology\b/i, /\bitar\b/i] },
  { slug: "industry.industrial.robotics_autonomy", patterns: [/\brobotics\b/i, /\bautonomy\b/i, /\bautonomous\b/i] },
  { slug: "industry.industrial.semiconductor", patterns: [/\bsemiconductor\b/i, /\bchip\b/i] },
  { slug: "industry.industrial.logistics_infrastructure", patterns: [/\blogistics\b/i, /\bsupply chain\b/i, /\bfreight\b/i] },
  { slug: "industry.consumer.marketplaces", patterns: [/\bmarketplace\b/i] },
  { slug: "industry.consumer.mobility", patterns: [/\bmobility\b/i, /\brideshare\b/i] },
  { slug: "industry.consumer.ecommerce", patterns: [/\be-?commerce\b/i] },
  { slug: "industry.consumer.social_media", patterns: [/\bsocial media\b/i] },
];

const JOB_FUNCTION_PATTERNS = [
  { slug: "job_function.engineering.software_engineering.backend", patterns: [/\bbackend\b/i] },
  { slug: "job_function.engineering.software_engineering.frontend", patterns: [/\bfrontend\b/i] },
  { slug: "job_function.engineering.software_engineering.full_stack", patterns: [/\bfull[\s-]?stack\b/i] },
  { slug: "job_function.engineering.software_engineering.mobile", patterns: [/\bmobile\b/i, /\bios\b/i, /\bandroid\b/i] },
  { slug: "job_function.engineering.software_engineering.infra_platform", patterns: [/\binfrastructure\b/i, /\bplatform engineer\b/i] },
  { slug: "job_function.engineering.software_engineering.ml_engineering", patterns: [/\bml engineer\b/i, /\bmachine learning engineer\b/i] },
  { slug: "job_function.data.data_engineering", patterns: [/\bdata engineer\b/i] },
  { slug: "job_function.data.data_science", patterns: [/\bdata scientist\b/i, /\bdata science\b/i] },
  { slug: "job_function.data.quantitative_research", patterns: [/\bquant\b/i, /\bquantitative research\b/i] },
  { slug: "job_function.product.product_management", patterns: [/\bproduct manager\b/i, /\bproduct management\b/i] },
  { slug: "job_function.business.business_analyst", patterns: [/\bbusiness analyst\b/i] },
  { slug: "job_function.business.finance_analysis", patterns: [/\bfinancial analyst\b/i, /\bfinance analyst\b/i] },
  { slug: "job_function.business.strategy", patterns: [/\bstrategy\b/i] },
  { slug: "job_function.business.sales", patterns: [/\bsales\b/i, /\bbusiness development\b/i] },
  { slug: "job_function.research.research_science", patterns: [/\bresearch scientist\b/i] },
  { slug: "job_function.research.applied_science", patterns: [/\bapplied scientist\b/i, /\bresearch engineer\b/i] },
  { slug: "job_function.design.ux_design", patterns: [/\bux\b/i, /\bdesigner\b/i, /\bproduct design\b/i] },
  { slug: "job_function.operations.supply_chain", patterns: [/\bsupply chain\b/i] },
  { slug: "job_function.operations.logistics", patterns: [/\blogistics\b/i] },
  { slug: "job_function.operations.operations_general", patterns: [/\boperations\b/i] },
];

function inferJobTaxonomy(job) {
  const text = `${job.company || ""} ${job.title || ""} ${job.jd_summary || ""}`.toLowerCase();
  const slug = normalizeSlug(job.company || "");
  const prior = COMPANY_PRIORS[slug];
  const industryNodeSlugs = uniq([...(prior?.primary || []), ...(prior?.secondary || [])]);
  for (const entry of INDUSTRY_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(text))) industryNodeSlugs.push(entry.slug);
  }
  if (industryNodeSlugs.length === 0) {
    const legacy = (job.industries || []).map((value) => String(value).toLowerCase());
    if (legacy.includes("finance")) industryNodeSlugs.push("industry.finance");
    else if (legacy.includes("consulting")) industryNodeSlugs.push("industry.consulting");
    else if (legacy.includes("research")) industryNodeSlugs.push("industry.research");
    else if (legacy.includes("healthcare")) industryNodeSlugs.push("industry.healthcare_biotech");
    else industryNodeSlugs.push("industry.technology");
  }

  const jobFunctionNodeSlugs = [];
  for (const entry of JOB_FUNCTION_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(text))) jobFunctionNodeSlugs.push(entry.slug);
  }
  if (jobFunctionNodeSlugs.length === 0) {
    if (/\bengineer|developer|software\b/.test(text)) jobFunctionNodeSlugs.push("job_function.engineering.software_engineering");
    else if (/\bdata|analytics|science\b/.test(text)) jobFunctionNodeSlugs.push("job_function.data");
    else if (/\bproduct\b/.test(text)) jobFunctionNodeSlugs.push("job_function.product");
    else if (/\bresearch\b/.test(text)) jobFunctionNodeSlugs.push("job_function.research");
    else if (/\bdesign\b/.test(text)) jobFunctionNodeSlugs.push("job_function.design");
    else if (/\boperations\b/.test(text)) jobFunctionNodeSlugs.push("job_function.operations");
    else jobFunctionNodeSlugs.push("job_function.other");
  }

  const rawCareer = `${job.title || ""} ${job.level || ""} ${job.role_family || ""}`.toLowerCase();
  const careerNodeSlugs = [];
  const employmentTypeNodeSlugs = [];
  if (rawCareer.includes("co-op") || rawCareer.includes("coop") || job.role_family === "co_op" || job.level === "co_op") {
    careerNodeSlugs.push("career_role.student.co_op");
    employmentTypeNodeSlugs.push("employment_type.temporary.co_op");
  } else if (rawCareer.includes("new grad") || rawCareer.includes("new graduate") || job.role_family === "new_grad" || job.level === "new_grad") {
    careerNodeSlugs.push("career_role.early_career.new_grad");
    employmentTypeNodeSlugs.push("employment_type.permanent.full_time");
  } else if (rawCareer.includes("associate") || job.role_family === "associate" || job.level === "associate") {
    careerNodeSlugs.push("career_role.early_career.associate");
    employmentTypeNodeSlugs.push("employment_type.permanent.full_time");
  } else if (rawCareer.includes("part-time") || rawCareer.includes("part time") || job.role_family === "part_time" || job.level === "part_time") {
    careerNodeSlugs.push("career_role.student.part_time_student");
    employmentTypeNodeSlugs.push("employment_type.permanent.part_time");
  } else {
    careerNodeSlugs.push("career_role.student.internship");
    employmentTypeNodeSlugs.push("employment_type.temporary.internship");
  }
  const targetTerm = String(job.target_term || "").toLowerCase();
  if (["spring", "summer", "fall", "winter"].includes(targetTerm)) {
    careerNodeSlugs.push(`career_role.student.internship.${targetTerm}`);
  }

  const workModality = job.work_modality || (job.remote ? "remote" : "unknown");
  const workModalityConfidence = job.work_modality_confidence || (job.remote ? "high" : "low");

  return {
    summary: {
      version: "taxonomy-mvp-v1",
      company_slug: slug,
      industry_node_slugs: uniq(industryNodeSlugs),
      job_function_node_slugs: uniq(jobFunctionNodeSlugs),
      career_node_slugs: uniq(careerNodeSlugs),
      geo_node_slugs: inferGeoSlugs([job.location || ""], "United States", ""),
      employment_type_node_slugs: uniq(employmentTypeNodeSlugs),
      work_modality: workModality,
      work_modality_confidence: workModalityConfidence,
    },
    locations_text: uniq(String(job.location || "").split(/[;/|]/g).map((part) => part.trim())),
    work_modality: workModality,
    work_modality_confidence: workModalityConfidence,
    taxonomy_needs_review: uniq(industryNodeSlugs).includes("industry.technology") || uniq(industryNodeSlugs).includes("industry.other"),
    taxonomy_resolution_version: "taxonomy-mvp-v1",
  };
}

async function loadNodeMap(supabase) {
  const { data, error } = await supabase
    .from("taxonomy_nodes")
    .select("id,dimension,slug");
  if (error) throw error;
  const map = new Map();
  for (const row of data || []) {
    map.set(`${row.dimension}:${row.slug}`, row.id);
  }
  return map;
}

function resolveIds(nodeMap, dimension, slugs) {
  return uniq(slugs.map((slug) => nodeMap.get(`${dimension}:${slug}`)).filter(Boolean));
}

async function main() {
  const mode = process.argv.includes("--profiles") ? "profiles" : "jobs";
  const dryRun = process.argv.includes("--dry-run");
  const limitArgIndex = process.argv.indexOf("--limit");
  const limit = limitArgIndex >= 0 ? Number(process.argv[limitArgIndex + 1]) : 100;

  const supabase = createClient(
    process.env.SUPABASE_URL || requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const nodeMap = await loadNodeMap(supabase);

  if (mode === "profiles") {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .limit(limit);
    if (error) throw error;
    const rows = data || [];
    const updates = [];
    for (const row of rows) {
      const taxonomy = inferProfileTaxonomy(row);
      updates.push({
        id: row.id,
        profile_match_preferences: taxonomy.matchPreferences,
        profile_application_facts: taxonomy.applicationFacts,
        profile_taxonomy_summary: { version: "taxonomy-mvp-v1" },
        profile_work_modality_allow: taxonomy.matchPreferences.work_modality_allow || [],
        profile_geo_allow_node_ids: resolveIds(nodeMap, "geo", [
          ...(taxonomy.matchPreferences.geo_preferences?.node_slugs || []),
          ...(taxonomy.applicationFacts.current_location?.node_slugs || []),
        ]),
        profile_industry_allow_node_ids: resolveIds(nodeMap, "industry", taxonomy.matchPreferences.industries?.node_slugs || []),
        profile_job_function_allow_node_ids: [],
        profile_career_allow_node_ids: resolveIds(nodeMap, "career_role", taxonomy.matchPreferences.career_roles?.node_slugs || []),
        profile_degree_node_ids: resolveIds(nodeMap, "education_degree", (taxonomy.applicationFacts.education_records || []).flatMap((record) => record.degree_node_slugs || [])),
        profile_education_field_node_ids: resolveIds(nodeMap, "education_field", (taxonomy.applicationFacts.education_records || []).flatMap((record) => record.major_node_slugs || [])),
        profile_work_auth_node_ids: resolveIds(nodeMap, "work_authorization", taxonomy.applicationFacts.work_authorization?.node_slugs || []),
        profile_employment_type_allow_node_ids: resolveIds(nodeMap, "employment_type", taxonomy.matchPreferences.employment_types?.node_slugs || []),
      });
    }
    if (!dryRun) {
      for (const update of updates) {
        const { error: updateError } = await supabase.from("profiles").update(update).eq("id", update.id);
        if (updateError) throw updateError;
      }
    }
    console.log(JSON.stringify({ mode, dryRun, total: rows.length, sample: updates.slice(0, 5) }, null, 2));
    return;
  }

  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .limit(limit);
  if (error) throw error;
  const rows = data || [];
  const updates = [];
  for (const row of rows) {
    const taxonomy = inferJobTaxonomy(row);
    updates.push({
      id: row.id,
      locations_text: taxonomy.locations_text,
      work_modality: taxonomy.work_modality,
      work_modality_confidence: taxonomy.work_modality_confidence,
      job_taxonomy_summary: taxonomy.summary,
      taxonomy_resolution_version: taxonomy.taxonomy_resolution_version,
      taxonomy_needs_review: taxonomy.taxonomy_needs_review,
      job_geo_node_ids: resolveIds(nodeMap, "geo", taxonomy.summary.geo_node_slugs || []),
      job_industry_node_ids: resolveIds(nodeMap, "industry", taxonomy.summary.industry_node_slugs || []),
      job_function_node_ids: resolveIds(nodeMap, "job_function", taxonomy.summary.job_function_node_slugs || []),
      job_career_node_ids: resolveIds(nodeMap, "career_role", taxonomy.summary.career_node_slugs || []),
      job_degree_requirement_node_ids: [],
      job_education_field_node_ids: [],
      job_work_auth_node_ids: [],
      job_employment_type_node_ids: resolveIds(nodeMap, "employment_type", taxonomy.summary.employment_type_node_slugs || []),
    });
  }
  if (!dryRun) {
    for (const update of updates) {
      const { error: updateError } = await supabase.from("jobs").update(update).eq("id", update.id);
      if (updateError) throw updateError;
    }
  }
  console.log(JSON.stringify({ mode, dryRun, total: rows.length, sample: updates.slice(0, 5) }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
