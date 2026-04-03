import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function loadDotEnvFile(filename) {
  const fullPath = path.join(process.cwd(), filename);
  if (!existsSync(fullPath)) {
    return;
  }

  const contents = readFileSync(fullPath, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadDotEnvFile(".env.local");
loadDotEnvFile(".env");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function canonicalize(url) {
  const parsed = new URL(url);
  parsed.hash = "";
  if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }
  return parsed.toString();
}

function inferIndustries(title = "", summary = "") {
  const text = `${title} ${summary}`.toLowerCase();
  const industries = new Set();

  if (
    text.includes("software") ||
    text.includes("engineer") ||
    text.includes("developer") ||
    text.includes("swe") ||
    text.includes("frontend") ||
    text.includes("backend")
  ) {
    industries.add("SWE");
  }
  if (text.includes("data") || text.includes("ml") || text.includes("analytics")) {
    industries.add("Data");
  }
  if (text.includes("product")) {
    industries.add("PM");
  }
  if (text.includes("research")) {
    industries.add("Research");
  }

  return [...industries];
}

async function main() {
  const shouldFix = process.argv.includes("--fix");
  const supabase = createClient(
    process.env.SUPABASE_URL || requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("id, company, title, status, posted_at, url, application_url, canonical_url, canonical_application_url, portal, industries, role_family, target_term, target_year, experience_band");

  if (error) {
    throw error;
  }

  const duplicateGroups = new Map();
  const missingMetadata = [];
  const canonicalDrift = [];
  const fixesApplied = [];

  for (const job of jobs ?? []) {
    const expectedCanonicalUrl = canonicalize(job.url);
    const expectedCanonicalApplicationUrl = canonicalize(job.application_url);
    const key = job.canonical_url || expectedCanonicalUrl;
    const group = duplicateGroups.get(key) || [];
    group.push(job);
    duplicateGroups.set(key, group);

    if (
      !job.portal ||
      !Array.isArray(job.industries) ||
      job.industries.length === 0 ||
      !job.role_family ||
      !job.experience_band
    ) {
      missingMetadata.push(job);
    }

    if (
      job.canonical_url !== expectedCanonicalUrl ||
      job.canonical_application_url !== expectedCanonicalApplicationUrl
    ) {
      canonicalDrift.push({
        id: job.id,
        title: job.title,
        canonical_url: job.canonical_url,
        expectedCanonicalUrl,
        canonical_application_url: job.canonical_application_url,
        expectedCanonicalApplicationUrl,
      });
    }

    if (shouldFix) {
      const update = {};

      if (job.canonical_url !== expectedCanonicalUrl) {
        update.canonical_url = expectedCanonicalUrl;
      }

      if (job.canonical_application_url !== expectedCanonicalApplicationUrl) {
        update.canonical_application_url = expectedCanonicalApplicationUrl;
      }

      if (!Array.isArray(job.industries) || job.industries.length === 0) {
        const inferredIndustries = inferIndustries(job.title, "");
        if (inferredIndustries.length > 0) {
          update.industries = inferredIndustries;
        }
      }

      if (Object.keys(update).length > 0) {
        const { error: updateError } = await supabase
          .from("jobs")
          .update(update)
          .eq("id", job.id);

        if (updateError) {
          throw updateError;
        }

        fixesApplied.push({
          id: job.id,
          title: job.title,
          update,
        });
      }
    }
  }

  const duplicates = [...duplicateGroups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([canonicalUrl, group]) => ({ canonicalUrl, ids: group.map((job) => job.id), count: group.length }));

  console.log(JSON.stringify({
    totalJobs: jobs?.length ?? 0,
    fixesAppliedCount: fixesApplied.length,
    fixesApplied: fixesApplied.slice(0, 20),
    duplicateGroups: duplicates,
    duplicateGroupCount: duplicates.length,
    missingMetadataCount: missingMetadata.length,
    canonicalDriftCount: canonicalDrift.length,
    sampleMissingMetadata: missingMetadata.slice(0, 10),
    sampleCanonicalDrift: canonicalDrift.slice(0, 10),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
