import type {
  DisclosurePolicy,
  Industry,
  JobLevel,
  JobRoleFamily,
  TargetTerm,
  WorkModality,
} from "@/lib/types";

export interface ProfileTaxonomyInput {
  city: string;
  state_region: string;
  country: string;
  school: string;
  major: string;
  major2: string;
  degree: string;
  graduation: string;
  gpa: string;
  industries: Industry[];
  levels: JobLevel[];
  target_role_families: JobRoleFamily[];
  target_terms: TargetTerm[];
  target_years: number[];
  locations: string[];
  remote_ok: boolean;
  work_modality_allow?: WorkModality[];
  open_to_relocate?: boolean;
  authorized_to_work: boolean;
  visa_type: string;
  earliest_start_date: string;
  weekly_availability_hours: string;
  linkedin_url: string;
  website_url: string;
  github_url: string;
  gpa_disclosure_policy?: DisclosurePolicy;
  eeo_disclosure_policy?: DisclosurePolicy;
}

export interface ProfileTaxonomyHydration {
  work_modality_allow: WorkModality[];
  open_to_relocate: boolean;
  gpa_disclosure_policy: DisclosurePolicy;
  eeo_disclosure_policy: DisclosurePolicy;
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const INDUSTRY_SLUGS: Record<Industry, string[]> = {
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

const CAREER_ROLE_SLUGS: Record<JobLevel | JobRoleFamily, string[]> = {
  internship: ["career_role.student.internship"],
  new_grad: ["career_role.early_career.new_grad"],
  part_time: ["career_role.student.part_time_student"],
  co_op: ["career_role.student.co_op"],
  associate: ["career_role.early_career.associate"],
};

const TERM_TO_CAREER_SLUG: Record<string, string> = {
  spring: "career_role.student.internship.spring",
  summer: "career_role.student.internship.summer",
  fall: "career_role.student.internship.fall",
  winter: "career_role.student.internship.winter",
};

const DEGREE_SLUG_MAP: Array<{ match: RegExp; slug: string; label: string }> = [
  { match: /\b(mba)\b/i, slug: "education_degree.graduate.mba", label: "MBA" },
  { match: /\b(ph\.?d|doctor)/i, slug: "education_degree.graduate.doctorate", label: "Doctorate" },
  { match: /\b(m\.?s|master|meng)\b/i, slug: "education_degree.graduate.masters", label: "Master's" },
  { match: /\b(b\.?s|bachelor|beng)\b/i, slug: "education_degree.undergraduate.bachelors", label: "Bachelor's" },
  { match: /\b(b\.?a)\b/i, slug: "education_degree.undergraduate.bachelors", label: "Bachelor's" },
  { match: /\bassociate\b/i, slug: "education_degree.undergraduate.associates", label: "Associate's" },
];

const EDUCATION_FIELD_MAP: Array<{ match: RegExp; slug: string; label: string }> = [
  { match: /computer science|software|informatics/i, slug: "education_field.engineering.computer_science", label: "Computer Science" },
  { match: /electrical/i, slug: "education_field.engineering.electrical_engineering", label: "Electrical Engineering" },
  { match: /mechanical/i, slug: "education_field.engineering.mechanical_engineering", label: "Mechanical Engineering" },
  { match: /bio(engineering|medical)|biomedical/i, slug: "education_field.engineering.bioengineering", label: "Bioengineering" },
  { match: /\bfinance\b/i, slug: "education_field.business.finance", label: "Finance" },
  { match: /\baccounting\b/i, slug: "education_field.business.accounting", label: "Accounting" },
  { match: /\bmarketing\b/i, slug: "education_field.business.marketing", label: "Marketing" },
  { match: /\beconomics\b/i, slug: "education_field.humanities_social_sciences.economics", label: "Economics" },
  { match: /\bmath|mathematics\b/i, slug: "education_field.math_statistics.mathematics", label: "Mathematics" },
  { match: /\bstatistics|stat\b/i, slug: "education_field.math_statistics.statistics", label: "Statistics" },
  { match: /\bbiology|biological\b/i, slug: "education_field.natural_sciences.biology", label: "Biology" },
  { match: /\bchemistry|chemical\b/i, slug: "education_field.natural_sciences.chemistry", label: "Chemistry" },
  { match: /\bphysics\b/i, slug: "education_field.natural_sciences.physics", label: "Physics" },
];

const VISA_TO_AUTH_SLUGS: Record<string, string[]> = {
  citizen: ["work_authorization.eligible_to_work.us_citizen", "work_authorization.sponsorship.no_sponsorship_needed"],
  green_card: ["work_authorization.eligible_to_work.permanent_resident", "work_authorization.sponsorship.no_sponsorship_needed"],
  opt: ["work_authorization.eligible_to_work.student_work_auth", "work_authorization.visa_program.f1_opt", "work_authorization.sponsorship.future_sponsorship_needed"],
  cpt: ["work_authorization.eligible_to_work.student_work_auth", "work_authorization.visa_program.cpt", "work_authorization.sponsorship.future_sponsorship_needed"],
  h1b: ["work_authorization.visa_program.h1b", "work_authorization.sponsorship.current_sponsorship_needed"],
  tn: ["work_authorization.eligible_to_work.unrestricted_work_auth", "work_authorization.sponsorship.current_sponsorship_needed"],
  other: ["work_authorization.sponsorship.current_sponsorship_needed"],
};

const STATE_SLUGS: Record<string, string> = {
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
  on: "geo.canada.ontario",
  ontario: "geo.canada.ontario",
};

const CITY_SLUGS: Record<string, string> = {
  "san francisco": "geo.usa.west.california.san_francisco_bay_area",
  "bay area": "geo.usa.west.california.san_francisco_bay_area",
  "los angeles": "geo.usa.west.california.los_angeles",
  "san diego": "geo.usa.west.california.san_diego",
  seattle: "geo.usa.west.washington.seattle",
  denver: "geo.usa.west.colorado.denver",
  nyc: "geo.usa.northeast.new_york.new_york_city",
  "new york city": "geo.usa.northeast.new_york.new_york_city",
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

function modalitySelection(input?: WorkModality[], remoteOk?: boolean): WorkModality[] {
  if (input && input.length > 0) return input;
  return remoteOk ? ["remote", "hybrid", "onsite"] : ["hybrid", "onsite"];
}

function inferDegreeNode(degree: string) {
  return DEGREE_SLUG_MAP.find((entry) => entry.match.test(degree));
}

function inferEducationFieldNodes(values: string[]): Array<{ slug: string; label: string }> {
  const matches = values
    .flatMap((value) =>
      EDUCATION_FIELD_MAP.filter((entry) => entry.match.test(value)).map((entry) => ({
        slug: entry.slug,
        label: entry.label,
      }))
    )
    .filter(Boolean);
  return matches.filter(
    (entry, index, all) => all.findIndex((candidate) => candidate.slug === entry.slug) === index
  );
}

function inferGeoSlugs(values: string[], country: string, stateRegion: string): string[] {
  const normalizedValues = uniq(
    [
      ...values,
      stateRegion,
      country === "United States" ? "United States" : country,
    ].map((value) => value.trim().toLowerCase())
  );

  const cityMatches = normalizedValues
    .map((value) => CITY_SLUGS[value])
    .filter(Boolean) as string[];
  const stateMatches = normalizedValues
    .map((value) => STATE_SLUGS[value])
    .filter(Boolean) as string[];

  const countrySlug =
    country.trim().toLowerCase() === "canada"
      ? "geo.canada"
      : "geo.usa";

  return uniq([...cityMatches, ...stateMatches, countrySlug]);
}

function labelsFromSlugs(slugs: string[]): string[] {
  return slugs.map((slug) =>
    slug
      .split(".")
      .slice(1)
      .map((part) => part.replace(/_/g, " "))
      .join(" > ")
  );
}

export function buildProfileTaxonomy(input: ProfileTaxonomyInput) {
  const workModalityAllow = modalitySelection(input.work_modality_allow, input.remote_ok);
  const industryNodeSlugs = uniq(input.industries.flatMap((industry) => INDUSTRY_SLUGS[industry] ?? []));
  const careerNodeSlugs = uniq(
    [
      ...input.levels.flatMap((level) => CAREER_ROLE_SLUGS[level] ?? []),
      ...input.target_role_families.flatMap((role) => CAREER_ROLE_SLUGS[role] ?? []),
      ...input.target_terms.flatMap((term) => {
        const normalized = term.toLowerCase();
        return Object.entries(TERM_TO_CAREER_SLUG).flatMap(([key, slug]) =>
          normalized.includes(key) ? [slug] : []
        );
      }),
    ]
  );
  const employmentTypeNodeSlugs = uniq(
    input.levels.map((level) => {
      if (level === "internship") return "employment_type.temporary.internship";
      if (level === "co_op") return "employment_type.temporary.co_op";
      if (level === "part_time") return "employment_type.permanent.part_time";
      return "employment_type.permanent.full_time";
    })
  );
  const geoPreferenceSlugs = inferGeoSlugs(input.locations, input.country, input.state_region);

  const degreeNode = inferDegreeNode(input.degree);
  const educationFieldNodes = inferEducationFieldNodes([input.major, input.major2].filter(Boolean));
  const workAuthNodeSlugs = uniq(
    [
      ...(VISA_TO_AUTH_SLUGS[input.visa_type] ?? []),
      input.authorized_to_work
        ? "work_authorization.eligible_to_work.unrestricted_work_auth"
        : "work_authorization.sponsorship.current_sponsorship_needed",
    ]
  );
  const currentAddressGeoSlugs = inferGeoSlugs(
    [input.city, input.state_region, input.country].filter(Boolean),
    input.country,
    input.state_region
  );

  const summary = {
    version: "taxonomy-mvp-v1",
    work_modality_allow: workModalityAllow,
    industry_node_slugs: industryNodeSlugs,
    career_node_slugs: careerNodeSlugs,
    employment_type_node_slugs: employmentTypeNodeSlugs,
    geo_preference_node_slugs: geoPreferenceSlugs,
    current_address_geo_node_slugs: currentAddressGeoSlugs,
    degree_node_slugs: degreeNode ? [degreeNode.slug] : [],
    education_field_node_slugs: educationFieldNodes.map((entry) => entry.slug),
    work_auth_node_slugs: workAuthNodeSlugs,
  };

  return {
    matchPreferences: {
      version: "taxonomy-mvp-v1",
      work_modality_allow: workModalityAllow,
      open_to_relocate: Boolean(input.open_to_relocate),
      geo_preferences: {
        raw_locations: input.locations,
        node_slugs: geoPreferenceSlugs,
        labels: labelsFromSlugs(geoPreferenceSlugs),
      },
      industries: {
        legacy_values: input.industries,
        node_slugs: industryNodeSlugs,
        labels: labelsFromSlugs(industryNodeSlugs),
      },
      career_roles: {
        legacy_levels: input.levels,
        target_role_families: input.target_role_families,
        target_terms: input.target_terms,
        target_years: input.target_years,
        node_slugs: careerNodeSlugs,
        labels: labelsFromSlugs(careerNodeSlugs),
      },
      employment_types: {
        node_slugs: employmentTypeNodeSlugs,
        labels: labelsFromSlugs(employmentTypeNodeSlugs),
      },
    },
    applicationFacts: {
      version: "taxonomy-mvp-v1",
      current_location: {
        city: input.city,
        state_region: input.state_region,
        country: input.country,
        node_slugs: currentAddressGeoSlugs,
        labels: labelsFromSlugs(currentAddressGeoSlugs),
      },
      relocation_preferences: {
        open_to_relocate: Boolean(input.open_to_relocate),
        desired_locations: input.locations,
      },
      education_records: [
        {
          school: input.school,
          degree: input.degree,
          degree_node_slugs: degreeNode ? [degreeNode.slug] : [],
          major: input.major,
          secondary_major_or_minor: input.major2,
          major_node_slugs: educationFieldNodes.map((entry) => entry.slug),
          gpa: input.gpa,
          graduation: input.graduation,
        },
      ],
      work_authorization: {
        authorized_to_work: input.authorized_to_work,
        visa_type: input.visa_type,
        requires_sponsorship: !input.authorized_to_work || ["opt", "cpt", "h1b", "tn", "other"].includes(input.visa_type),
        node_slugs: workAuthNodeSlugs,
        labels: labelsFromSlugs(workAuthNodeSlugs),
      },
      availability: {
        earliest_start_date: input.earliest_start_date,
        weekly_availability_hours: input.weekly_availability_hours,
      },
      links: {
        linkedin_url: input.linkedin_url,
        website_url: input.website_url,
        github_url: input.github_url,
      },
      disclosure_policies: {
        gpa: input.gpa_disclosure_policy ?? "required_only",
        demographics: input.eeo_disclosure_policy ?? "required_only",
      },
    },
    summary,
  };
}

export function hydrateProfileTaxonomy(matchPreferences: unknown, applicationFacts: unknown): ProfileTaxonomyHydration {
  const match = (matchPreferences ?? {}) as Record<string, any>;
  const facts = (applicationFacts ?? {}) as Record<string, any>;
  const workModalityAllow = Array.isArray(match.work_modality_allow)
    ? (match.work_modality_allow.filter(Boolean) as WorkModality[])
    : [];
  const disclosurePolicies = (facts.disclosure_policies ?? {}) as Record<string, any>;
  return {
    work_modality_allow:
      workModalityAllow.length > 0 ? workModalityAllow : ["hybrid", "onsite"],
    open_to_relocate: Boolean(
      match.open_to_relocate ?? facts.relocation_preferences?.open_to_relocate ?? false
    ),
    gpa_disclosure_policy:
      disclosurePolicies.gpa === "always" ? "always" : "required_only",
    eeo_disclosure_policy:
      disclosurePolicies.demographics === "always" ? "always" : "required_only",
  };
}

export function guessCompanySlug(companyName: string): string {
  return normalizeSlug(companyName);
}
