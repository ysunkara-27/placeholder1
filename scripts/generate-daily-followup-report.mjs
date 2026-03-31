import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
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
      envFile.NEXT_PUBLIC_SUPABASE_URL ||
      "",
    serviceRoleKey:
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      envFile.SUPABASE_SERVICE_ROLE_KEY ||
      "",
  };
}

function ensureEnv(value, label) {
  if (!value) {
    throw new Error(`Missing ${label}. Add it to .env.local before generating the follow-up report.`);
  }
  return value;
}

function toSummary(run) {
  const resultPayload =
    run.result_payload && typeof run.result_payload === "object" ? run.result_payload : {};
  return resultPayload.summary && typeof resultPayload.summary === "object"
    ? resultPayload.summary
    : {};
}

function normalizePromptKey(value) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getStoredFollowupAnswers(profile) {
  const grayAreas =
    profile?.gray_areas && typeof profile.gray_areas === "object" ? profile.gray_areas : {};
  const followUpAnswers =
    grayAreas.follow_up_answers && typeof grayAreas.follow_up_answers === "object"
      ? grayAreas.follow_up_answers
      : {};

  return Object.fromEntries(
    Object.entries(followUpAnswers)
      .filter(([key, value]) => typeof key === "string" && typeof value === "string" && value.trim().length > 0)
      .map(([key, value]) => [normalizePromptKey(key), value.trim()])
  );
}

function formatRun(run, followUpItems) {
  const summary = toSummary(run);

  return [
    `## ${run.portal || "unknown"} — ${run.status}`,
    ``,
    `- Run ID: \`${run.id}\``,
    `- Created: ${run.created_at}`,
    `- URL: ${run.url || "n/a"}`,
    `- Blocked step: ${summary.blocked_step || "n/a"}`,
    `- Blocked family: ${summary.blocked_field_family || "n/a"}`,
    `- Failure source: ${summary.failure_source || "n/a"}`,
    `- Error: ${run.error || "n/a"}`,
    ``,
    `### User follow-up needed`,
    ...(followUpItems.length > 0
      ? followUpItems.map((item) => `- ${item}`)
      : ["- Review this application manually before sending a confirmation text."]),
  ].join("\n");
}

async function main() {
  const { supabaseUrl, serviceRoleKey } = getEnv();
  const supabase = createClient(
    ensureEnv(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL"),
    ensureEnv(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY")
  );

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("apply_runs")
    .select("id, user_id, created_at, portal, status, url, error, result_payload")
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const actionableRuns = (data || []).filter((run) => toSummary(run).follow_up_required === true);
  const userIds = [...new Set(actionableRuns.map((run) => run.user_id).filter(Boolean))];
  const { data: profiles, error: profilesError } = userIds.length
    ? await supabase.from("profiles").select("id, gray_areas").in("id", userIds)
    : { data: [], error: null };

  if (profilesError) throw profilesError;

  const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
  const actionableEntries = actionableRuns
    .map((run) => {
      const summary = toSummary(run);
      const profile = profileMap.get(run.user_id);
      const storedAnswers = profile ? getStoredFollowupAnswers(profile) : {};
      const followUpItems = (Array.isArray(summary.follow_up_items) ? summary.follow_up_items : [])
        .filter((item) => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
        .filter((item) => !storedAnswers[normalizePromptKey(item)]);
      return { run, followUpItems };
    })
    .filter((entry) => entry.followUpItems.length > 0);

  const reportDate = new Date().toISOString().slice(0, 10);
  const reportDir = path.join(process.cwd(), "reports");
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `daily-followups-${reportDate}.md`);

  const contents = [
    `# Twin Daily Follow-ups`,
    ``,
    `Generated: ${new Date().toISOString()}`,
    `Window: last 24 hours`,
    `Runs needing user input: ${actionableEntries.length}`,
    ``,
    actionableEntries.length > 0
      ? actionableEntries
          .map(({ run, followUpItems }) => formatRun(run, followUpItems))
          .join("\n\n")
      : `No unresolved follow-up items in the last 24 hours.`,
    ``,
    `## Nightly SMS guidance`,
    ``,
    `If follow-up items exist, send a short daily text asking how Twin should answer them before submitting any new application.`,
  ].join("\n");

  fs.writeFileSync(reportPath, contents, "utf8");
  console.log(`[Twin report] wrote ${reportPath}`);
}

main().catch((error) => {
  console.error("[Twin report] failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
