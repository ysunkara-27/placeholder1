import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const contents = fs.readFileSync(filePath, "utf8");
  const env = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalsIndex = line.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

function getEnv() {
  const envFile = loadDotEnvFile(path.join(process.cwd(), ".env.local"));
  return {
    supabaseUrl:
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      envFile.NEXT_PUBLIC_SUPABASE_URL ||
      envFile.SUPABASE_URL ||
      "",
    serviceRoleKey:
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      envFile.SUPABASE_SERVICE_ROLE_KEY ||
      "",
  };
}

function ensureEnv(value, label) {
  if (!value) {
    throw new Error(`Missing ${label}. Add it to .env.local before queueing vetted jobs.`);
  }

  return value;
}

function loadVettedJobs() {
  const filePath = path.join(
    process.cwd(),
    "data",
    "job-seeds",
    "vetted-live-mvp.json"
  );
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureOperatorResumePdf() {
  const resumePath = "/tmp/resume.pdf";
  if (fs.existsSync(resumePath)) {
    return resumePath;
  }

  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Count 1 /Kids [3 0 R] >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 68 >>
stream
BT
/F1 12 Tf
36 96 Td
(Twin Operator Resume Placeholder) Tj
0 -18 Td
(Used for local MVP apply runs.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000241 00000 n 
0000000360 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
430
%%EOF
`;

  fs.writeFileSync(resumePath, pdf, "utf8");
  return resumePath;
}

function splitName(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}

function mapProfileToApplicantDraft(profile) {
  const { firstName, lastName } = splitName(profile.full_name || "");
  const email = profile.email || "";
  const grayAreas =
    profile.gray_areas && typeof profile.gray_areas === "object"
      ? profile.gray_areas
      : {};
  const eeo =
    profile.eeo && typeof profile.eeo === "object"
      ? profile.eeo
      : {};
  const locations = Array.isArray(profile.locations) ? profile.locations : [];

  return {
    first_name: firstName,
    last_name: lastName,
    email,
    phone: profile.phone || "",
    city: profile.city || "",
    state_region: profile.state_region || "",
    country: profile.country || "United States",
    linkedin_url: profile.linkedin_url || "",
    website_url: profile.website_url || "",
    github_url: profile.github_url || "",
    linkedin: profile.linkedin_url || "",
    website: profile.website_url || "",
    github: profile.github_url || "",
    resume_pdf_path: ensureOperatorResumePdf(),
    school: profile.school || "",
    major: profile.major || "",
    gpa: profile.gpa || "",
    graduation: profile.graduation || "",
    authorized_to_work: Boolean(profile.authorized_to_work),
    visa_type: profile.visa_type || "",
    earliest_start_date: profile.earliest_start_date || "",
    sponsorship_required:
      !profile.authorized_to_work || Boolean(grayAreas.sponsorship_required),
    work_authorization: profile.authorized_to_work
      ? "Authorized to work in the United States"
      : "Requires sponsorship",
    start_date: profile.earliest_start_date || "",
    location_preference: locations[0] || "",
    salary_expectation:
      grayAreas.salary_min && grayAreas.salary_unit
        ? grayAreas.salary_unit === "hourly"
          ? `$${grayAreas.salary_min}/hour`
          : `$${grayAreas.salary_min}/year`
        : "",
    onsite_preference: profile.remote_ok
      ? "Remote or hybrid preferred"
      : "Open to onsite",
    weekly_availability_hours: "",
    graduation_window: profile.graduation || "",
    commute_preference: profile.remote_ok ? "Prefer remote-friendly roles" : "",
    eeo: Object.fromEntries(
      Object.entries(eeo).filter(([, value]) => typeof value === "string")
    ),
    custom_answers: {
      ...(profile.school
        ? { school: profile.school, university: profile.school }
        : {}),
      ...(profile.major ? { major: profile.major } : {}),
      ...(profile.degree ? { degree: profile.degree } : {}),
      ...(profile.graduation
        ? {
            graduation_date: profile.graduation,
            graduation: profile.graduation,
          }
        : {}),
      ...(profile.gpa ? { gpa: profile.gpa } : {}),
      ...(locations[0]
        ? { relocation: profile.remote_ok ? "no" : "yes" }
        : {}),
    },
  };
}

function inferLevel(title) {
  const normalized = String(title || "").toLowerCase();
  if (normalized.includes("intern")) return "internship";
  if (normalized.includes("co-op") || normalized.includes("coop")) return "co_op";
  if (normalized.includes("new grad")) return "new_grad";
  if (normalized.includes("part time")) return "part_time";
  return "internship";
}

function inferIndustries(title, notes) {
  const normalized = `${title || ""} ${notes || ""}`.toLowerCase();
  const industries = new Set();
  if (
    normalized.includes("software") ||
    normalized.includes("engineer") ||
    normalized.includes("developer")
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

function isStaleRunningApplication(application) {
  if (!application || application.status !== "running") {
    return false;
  }

  const startedAt = application.started_at || application.updated_at || application.queued_at;
  if (!startedAt) {
    return true;
  }

  const elapsedMs = Date.now() - new Date(startedAt).getTime();
  return elapsedMs >= 20 * 60 * 1000;
}

function mapSeedJobToInsert(seed) {
  const postedAt = new Date(`${seed.retrieved_on}T00:00:00.000Z`).toISOString();
  return {
    company: seed.company,
    title: seed.title,
    level: inferLevel(seed.title),
    location: seed.location,
    remote: /remote/i.test(seed.location),
    industries: inferIndustries(seed.title, seed.notes),
    portal: seed.portal,
    url: seed.source_url,
    application_url: seed.apply_url,
    jd_summary: seed.notes,
    status: "active",
    metadata: {
      seed_id: seed.id,
      portal: seed.portal,
      source: "vetted_live_mvp",
      verification_status: seed.verification_status || "vetted",
    },
    posted_at: postedAt,
  };
}

async function ensureJobForSeed(supabase, seed) {
  const existing = await supabase
    .from("jobs")
    .select("*")
    .or(`application_url.eq.${seed.apply_url},url.eq.${seed.source_url}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  if (existing.data) {
    return existing.data;
  }

  const inserted = await supabase
    .from("jobs")
    .insert(mapSeedJobToInsert(seed))
    .select("*")
    .single();

  if (inserted.error) {
    throw inserted.error;
  }

  return inserted.data;
}

async function queueApplicationForSeed(supabase, userId, seed, applicantDraft) {
  const job = await ensureJobForSeed(supabase, seed);

  const existing = await supabase
    .from("applications")
    .select("*")
    .eq("user_id", userId)
    .eq("job_id", job.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  if (existing.data && existing.data.status === "running") {
    const reclaimed = await supabase
      .from("applications")
      .update({
        status: "queued",
        confirmation_text: null,
        last_error: isStaleRunningApplication(existing.data)
          ? "Reclaimed stale running application for vetted MVP rerun."
          : "Requeued active running application for vetted MVP rerun.",
        queued_at: new Date().toISOString(),
        started_at: null,
        completed_at: null,
        worker_id: null,
        last_run_id: null,
        browsing_task_id: null,
        applied_at: null,
      })
      .eq("id", existing.data.id)
      .select("*")
      .single();

    if (reclaimed.error) {
      throw reclaimed.error;
    }

    return {
      application: reclaimed.data,
      disposition: isStaleRunningApplication(existing.data)
        ? "requeued_stale_running"
        : "requeued_running",
      job,
    };
  }

  if (existing.data && existing.data.status === "queued") {
    return {
      application: existing.data,
      disposition: existing.data.status,
      job,
    };
  }

  const requestPayload = {
    url: seed.apply_url,
    dry_run: false,
    runtime_hints: {
      historical_blocked_families: [],
    },
    profile: applicantDraft,
  };

  if (existing.data) {
    const updated = await supabase
      .from("applications")
      .update({
        status: "queued",
        request_payload: requestPayload,
        confirmation_text: null,
        last_error: null,
        queued_at: new Date().toISOString(),
        started_at: null,
        completed_at: null,
        worker_id: null,
        last_run_id: null,
        browsing_task_id: null,
        applied_at: null,
      })
      .eq("id", existing.data.id)
      .select("*")
      .single();

    if (updated.error) {
      throw updated.error;
    }

    return {
      application: updated.data,
      disposition:
        existing.data.status === "applied"
          ? "requeued_applied"
          : existing.data.status === "requires_auth"
            ? "requeued_requires_auth"
            : existing.data.status === "failed"
              ? "requeued_failed"
              : "queued",
      job,
    };
  }

  const inserted = await supabase
    .from("applications")
    .insert({
      user_id: userId,
      job_id: job.id,
      status: "queued",
      request_payload: requestPayload,
      queued_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (inserted.error) {
    throw inserted.error;
  }

  return {
    application: inserted.data,
    disposition: "queued",
    job,
  };
}

async function loadLatestCompletedProfile(supabase) {
  const result = await supabase
    .from("profiles")
    .select("*")
    .eq("onboarding_completed", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  return result.data;
}

async function createOperatorProfile(supabase) {
  const timestamp = Date.now();
  const email = `operator-${timestamp}@local.twin`;
  const password = crypto.randomBytes(24).toString("hex");

  const createdUser = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: "Twin Operator",
      twin_seeded: true,
    },
  });

  if (createdUser.error || !createdUser.data.user) {
    throw createdUser.error || new Error("Failed to create operator auth user.");
  }

  const profileInsert = await supabase
    .from("profiles")
    .insert({
      id: createdUser.data.user.id,
      full_name: "Twin Operator",
      email,
      phone: "5550000000",
      school: "Stanford University",
      degree: "Bachelor's Degree",
      graduation: "2027-06-15",
      gpa: "3.9",
      industries: ["SWE"],
      levels: ["internship"],
      locations: ["San Francisco, CA"],
      remote_ok: true,
      gray_areas: {
        sponsorship_required: false,
        salary_min: 45,
        salary_unit: "hourly",
      },
      resume_json: {},
      notification_pref: "email",
      sms_opt_in: false,
      onboarding_completed: true,
      subscription_tier: "free",
      city: "San Francisco",
      state_region: "CA",
      country: "United States",
      linkedin_url: "https://linkedin.com/in/twin-operator",
      github_url: "https://github.com/twin-operator",
      major: "Computer Science",
      authorized_to_work: true,
      visa_type: "citizen",
      earliest_start_date: "2026-06-01",
      eeo: {
        gender: "Woman",
        race_ethnicity: "Asian",
        veteran_status: "I am not a protected veteran",
        disability_status: "No, I do not have a disability",
      },
    })
    .select("*")
    .single();

  if (profileInsert.error) {
    throw profileInsert.error;
  }

  console.log(
    `[Twin queue] bootstrapped operator profile ${profileInsert.data.id} (${email})`
  );
  return profileInsert.data;
}

async function main() {
  const { supabaseUrl, serviceRoleKey } = getEnv();
  const supabase = createClient(
    ensureEnv(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL"),
    ensureEnv(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY")
  );

  const profile = await loadLatestCompletedProfile(supabase);
  const activeProfile = profile || (await createOperatorProfile(supabase));

  const applicantDraft = mapProfileToApplicantDraft(activeProfile);
  const vettedJobs = loadVettedJobs();

  console.log(
    `[Twin queue] using profile ${activeProfile.id} (${activeProfile.email || activeProfile.full_name || "unknown"})`
  );

  for (const seed of vettedJobs) {
    const result = await queueApplicationForSeed(
      supabase,
      activeProfile.id,
      seed,
      applicantDraft
    );
    console.log(
      `[Twin queue] ${seed.portal} ${seed.company} — ${seed.title}: ${result.disposition}`
    );
  }
}

main().catch((error) => {
  console.error(
    "[Twin queue] failed:",
    error instanceof Error ? error.message : String(error)
  );
  process.exitCode = 1;
});
