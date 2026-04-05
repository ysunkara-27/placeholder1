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

async function main() {
  const limitArgIndex = process.argv.indexOf("--limit");
  const limit = limitArgIndex >= 0 ? Number(process.argv[limitArgIndex + 1]) : 250;

  const supabase = createClient(
    process.env.SUPABASE_URL || requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const [{ data: priorRows, error: priorError }, { data: jobRows, error: jobError }] = await Promise.all([
    supabase.from("company_taxonomy_priors").select("company_slug"),
    supabase
      .from("jobs")
      .select("id,company,title,job_taxonomy_summary,taxonomy_needs_review,created_at")
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  if (priorError) throw priorError;
  if (jobError) throw jobError;

  const knownCompanySlugs = new Set((priorRows || []).map((row) => row.company_slug));
  const grouped = new Map();

  for (const job of jobRows || []) {
    const summary = job.job_taxonomy_summary || {};
    const companySlug = summary.company_slug || "";
    const key = companySlug || String(job.company || "").toLowerCase();
    const entry = grouped.get(key) || {
      company_slug: companySlug || null,
      company: job.company,
      known_company_prior: companySlug ? knownCompanySlugs.has(companySlug) : false,
      review_job_count: 0,
      total_job_count: 0,
      latest_title: job.title,
      industry_resolution_sources: new Set(),
      fallback_branches: new Set(),
      industry_node_slugs: new Set(),
    };
    entry.total_job_count += 1;
    if (job.taxonomy_needs_review) entry.review_job_count += 1;
    for (const source of summary.industry_resolution_sources || []) {
      entry.industry_resolution_sources.add(source);
    }
    if (summary.industry_fallback_branch_slug) {
      entry.fallback_branches.add(summary.industry_fallback_branch_slug);
    }
    for (const slug of summary.industry_node_slugs || []) {
      entry.industry_node_slugs.add(slug);
    }
    grouped.set(key, entry);
  }

  const companies = [...grouped.values()]
    .filter((entry) => entry.review_job_count > 0 || !entry.known_company_prior)
    .map((entry) => ({
      company_slug: entry.company_slug,
      company: entry.company,
      known_company_prior: entry.known_company_prior,
      review_job_count: entry.review_job_count,
      total_job_count: entry.total_job_count,
      latest_title: entry.latest_title,
      industry_resolution_sources: uniq([...entry.industry_resolution_sources]),
      fallback_branches: uniq([...entry.fallback_branches]),
      industry_node_slugs: uniq([...entry.industry_node_slugs]),
    }))
    .sort((a, b) => b.review_job_count - a.review_job_count || b.total_job_count - a.total_job_count || a.company.localeCompare(b.company));

  console.log(JSON.stringify({
    scanned_jobs: (jobRows || []).length,
    known_company_priors: knownCompanySlugs.size,
    companies_needing_review: companies.length,
    companies,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
