import fs from "node:fs";
import path from "node:path";
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

async function resolveBaseUrl() {
  const envFile = loadDotEnvFile(path.join(process.cwd(), ".env.local"));
  const explicitBaseUrl =
    process.env.TWIN_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    envFile.TWIN_BASE_URL ||
    "";

  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/$/, "");
  }

  const candidates = ["http://127.0.0.1:3000", "http://127.0.0.1:3001"];

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, { method: "HEAD" });
      if (response.ok || response.status < 500) {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  return candidates[0];
}

async function main() {
  const envFile = loadDotEnvFile(path.join(process.cwd(), ".env.local"));
  const baseUrl = await resolveBaseUrl();
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    envFile.NEXT_PUBLIC_SUPABASE_URL ||
    envFile.SUPABASE_URL ||
    "";
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    envFile.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  const supabase =
    supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;
  const subject = "ip:unknown";
  const payload = {
    url: "https://boards.greenhouse.io/example/jobs/123456",
    profile: {
      first_name: "Test",
      last_name: "User",
      email: "test@example.com",
      phone: "",
      linkedin: "",
      website: "",
      github: "",
      resume_pdf_path: "",
      sponsorship_required: false,
      work_authorization: "",
      start_date: "",
      location_preference: "",
      salary_expectation: "",
      onsite_preference: "",
      weekly_availability_hours: "",
      graduation_window: "",
      commute_preference: "",
      city: "",
      state_region: "",
      country: "United States",
      school: "",
      major: "",
      gpa: "",
      graduation: "",
      visa_type: "",
      eeo: {},
      custom_answers: {},
    },
    runtime_hints: {
      historical_blocked_families: [],
    },
  };

  console.log(`[plan-rate-limit] base=${baseUrl}`);
  console.log(`[plan-rate-limit] scope=apply_plan subject=${subject}`);

  for (let i = 1; i <= 12; i += 1) {
    const response = await fetch(`${baseUrl}/api/apply/plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    let body;
    let rawText = null;
    try {
      rawText = await response.text();
      body = rawText ? JSON.parse(rawText) : null;
    } catch {
      body = null;
    }

    console.log(
      JSON.stringify(
        {
          attempt: i,
          status: response.status,
          remaining: response.headers.get("x-ratelimit-remaining"),
          reset: response.headers.get("x-ratelimit-reset"),
          error: body?.error ?? null,
          body_preview:
            body === null && rawText
              ? rawText.slice(0, 240)
              : null,
        },
        null,
        2
      )
    );

    if (response.status === 429) {
      console.log("[plan-rate-limit] rate limit reached as expected");
      return;
    }
  }

  if (supabase) {
    const { data: limitRow, error: limitError } = await supabase
      .from("request_rate_limits")
      .select("scope,subject,hit_count,window_started_at,updated_at")
      .eq("scope", "apply_plan")
      .eq("subject", subject)
      .maybeSingle();

    if (limitError) {
      throw limitError;
    }

    console.log(
      JSON.stringify(
        {
          db_observed_row: limitRow,
        },
        null,
        2
      )
    );
  }

  console.log("[plan-rate-limit] no 429 received within 12 attempts");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[plan-rate-limit] failed:", message);
  process.exitCode = 1;
});
