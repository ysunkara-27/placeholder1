const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnv(filePath) {
  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .filter((line) => !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [
          line.slice(0, index),
          line.slice(index + 1).replace(/^['"]|['"]$/g, ""),
        ];
      })
  );
}

async function main() {
  const applicationId = process.argv[2];
  if (!applicationId) {
    throw new Error("Usage: node scripts/check_application_logs.js <application-id>");
  }

  const env = loadEnv(path.join(process.cwd(), ".env.local"));
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );

  const [applicationRes, runsRes, eventsRes] = await Promise.all([
    supabase
      .from("applications")
      .select(
        "id,status,queued_at,started_at,completed_at,last_error,last_run_id,attempt_count,updated_at,worker_id,execution_status,log_events,preview_screenshot"
      )
      .eq("id", applicationId)
      .single(),
    supabase
      .from("apply_runs")
      .select("*")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("application_events")
      .select("*")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (applicationRes.error) throw applicationRes.error;
  if (runsRes.error) throw runsRes.error;
  if (eventsRes.error) throw eventsRes.error;

  console.log(
    JSON.stringify(
      {
        application: applicationRes.data,
        runs: runsRes.data,
        events: eventsRes.data,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
