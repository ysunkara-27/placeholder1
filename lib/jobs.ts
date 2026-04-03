import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  inferJobLevel,
  inferQualificationTags,
} from "@/lib/job-normalization";
import type { Database } from "@/lib/supabase/database.types";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type JobInsert = Database["public"]["Tables"]["jobs"]["Insert"];

interface SeedJobRecord {
  id: string;
  portal: string;
  company: string;
  title: string;
  location: string;
  apply_url: string;
  source_url: string;
  notes: string;
  retrieved_on: string;
}

let cachedSeedJobs: SeedJobRecord[] | null = null;

function inferIndustries(title: string, notes: string): string[] {
  const normalized = `${title} ${notes}`.toLowerCase();
  const industries = new Set<string>();

  if (
    normalized.includes("software") ||
    normalized.includes("engineer") ||
    normalized.includes("developer") ||
    normalized.includes("swe")
  ) {
    industries.add("SWE");
  }
  if (normalized.includes("data") || normalized.includes("ml")) {
    industries.add("Data");
  }
  if (normalized.includes("product")) {
    industries.add("PM");
  }
  if (normalized.includes("research")) {
    industries.add("Research");
  }

  return industries.size > 0 ? [...industries] : ["SWE"];
}

function mapSeedJobToInsert(seed: SeedJobRecord): JobInsert {
  const postedAt = new Date(`${seed.retrieved_on}T00:00:00.000Z`).toISOString();
  const level = inferJobLevel(seed.title, seed.notes);
  const qualification = inferQualificationTags({
    title: seed.title,
    jdSummary: seed.notes,
    level,
  });

  return {
    company: seed.company,
    title: seed.title,
    level,
    location: seed.location,
    remote: /remote/i.test(seed.location),
    industries: inferIndustries(seed.title, seed.notes),
    portal: seed.portal,
    url: seed.source_url,
    application_url: seed.apply_url,
    canonical_url: seed.source_url,
    canonical_application_url: seed.apply_url,
    role_family: qualification.role_family,
    target_term: qualification.target_term,
    target_year: qualification.target_year,
    experience_band: qualification.experience_band,
    is_early_career: qualification.is_early_career,
    jd_summary: seed.notes,
    status: "active",
    metadata: {
      seed_id: seed.id,
      portal: seed.portal,
      source: "repo_seed",
    },
    posted_at: postedAt,
  };
}

export async function getSeedJobs(): Promise<SeedJobRecord[]> {
  if (cachedSeedJobs) {
    return cachedSeedJobs;
  }

  const filePath = path.join(process.cwd(), "data", "job-seeds", "live-openings-2026.json");
  const file = await readFile(filePath, "utf8");
  cachedSeedJobs = JSON.parse(file) as SeedJobRecord[];
  return cachedSeedJobs;
}

export async function findSeedJobByUrl(url: string): Promise<SeedJobRecord | null> {
  const jobs = await getSeedJobs();

  return (
    jobs.find(
      (job) => job.apply_url === url || job.source_url === url
    ) ?? null
  );
}

export async function ensureJobForApplicationUrl(
  supabase: SupabaseClient<Database>,
  url: string
): Promise<JobRow | null> {
  const existingByApplicationUrl = await supabase
    .from("jobs")
    .select("*")
    .eq("application_url", url)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingByApplicationUrl.error) {
    throw existingByApplicationUrl.error;
  }

  if (existingByApplicationUrl.data) {
    return existingByApplicationUrl.data;
  }

  const existingBySourceUrl = await supabase
    .from("jobs")
    .select("*")
    .eq("url", url)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingBySourceUrl.error) {
    throw existingBySourceUrl.error;
  }

  if (existingBySourceUrl.data) {
    return existingBySourceUrl.data;
  }

  const seedJob = await findSeedJobByUrl(url);
  if (!seedJob) {
    return null;
  }

  const inserted = await supabase
    .from("jobs")
    .insert(mapSeedJobToInsert(seedJob))
    .select("*")
    .single();

  if (inserted.error) {
    throw inserted.error;
  }

  return inserted.data;
}
