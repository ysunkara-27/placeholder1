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
  const queuedAt = process.argv[3] || "2026-01-01T00:00:00.000Z";
  if (!applicationId) {
    throw new Error(
      "Usage: node scripts/requeue_application.js <application-id> [queued-at-iso]"
    );
  }

  const env = loadEnv(path.join(process.cwd(), ".env.local"));
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabase
    .from("applications")
    .update({
      status: "queued",
      queued_at: queuedAt,
      started_at: null,
      completed_at: null,
      worker_id: null,
      last_error: null,
      last_run_id: null,
      execution_status: null,
      log_events: [],
      preview_screenshot: null,
    })
    .eq("id", applicationId)
    .select("id,status,queued_at,attempt_count")
    .single();

  if (error) throw error;
  console.log(JSON.stringify(data, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
