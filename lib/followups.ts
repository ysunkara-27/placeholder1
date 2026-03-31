import type { SupabaseClient } from "@supabase/supabase-js";
import { sendSms } from "@/lib/messaging/send";
import type { Database } from "@/lib/supabase/database.types";

type ApplyRunRow = Database["public"]["Tables"]["apply_runs"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export type DailyFollowupItem = {
  runId: string;
  portal: string | null;
  url: string;
  jobTitle: string | null;
  company: string | null;
  blockedStep: string | null;
  followUpItems: string[];
};

export type DailyFollowupRecipient = {
  profile: ProfileRow;
  items: DailyFollowupItem[];
};

function toSummary(run: ApplyRunRow): Record<string, unknown> {
  const resultPayload =
    run.result_payload && typeof run.result_payload === "object" ? run.result_payload : {};
  const summary =
    "summary" in resultPayload && resultPayload.summary && typeof resultPayload.summary === "object"
      ? resultPayload.summary
      : {};
  return summary as Record<string, unknown>;
}

function getFollowupItems(summary: Record<string, unknown>): string[] {
  const items = summary.follow_up_items;
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
}

function normalizePromptKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getStoredFollowupAnswers(profile: ProfileRow): Record<string, string> {
  const grayAreas =
    profile.gray_areas && typeof profile.gray_areas === "object"
      ? (profile.gray_areas as Record<string, unknown>)
      : {};
  const followupAnswers =
    grayAreas.follow_up_answers && typeof grayAreas.follow_up_answers === "object"
      ? (grayAreas.follow_up_answers as Record<string, unknown>)
      : {};

  const answers: Record<string, string> = {};
  for (const [key, value] of Object.entries(followupAnswers)) {
    if (typeof key === "string" && typeof value === "string" && value.trim().length > 0) {
      answers[normalizePromptKey(key)] = value.trim();
    }
  }
  return answers;
}

function isFollowupRun(run: ApplyRunRow): boolean {
  const summary = toSummary(run);
  return summary.follow_up_required === true && getFollowupItems(summary).length > 0;
}

export function formatDailyFollowupMessage(items: DailyFollowupItem[]): string {
  const first = items[0];
  const prompts = items
    .flatMap((item) => item.followUpItems.map((question) => ({ item, question })))
    .slice(0, 3);

  const lines = [
    `Twin paused before sending ${items.length} application${items.length === 1 ? "" : "s"}.`,
    ``,
  ];

  if (first?.company || first?.jobTitle) {
    lines.push(`Top blocker: ${first.company || "Company"} — ${first.jobTitle || "Role"}`);
    lines.push("");
  }

  prompts.forEach(({ item, question }, index) => {
    const prefix = `${index + 1}.`;
    const context = item.company || item.jobTitle ? ` (${item.company || ""}${item.jobTitle ? ` — ${item.jobTitle}` : ""})` : "";
    lines.push(`${prefix} ${question}${context}`);
  });

  lines.push("");
  lines.push(`Reply with answers in order, like: 1) ... 2) ...`);
  lines.push(`Twin will use them before the next submit attempt.`);

  return lines.join("\n");
}

export async function getDailyFollowupRecipients(
  supabase: SupabaseClient<Database>,
  sinceIso: string
): Promise<DailyFollowupRecipient[]> {
  const { data: runs, error: runsError } = await supabase
    .from("apply_runs")
    .select("*")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false });

  if (runsError) {
    throw runsError;
  }

  const actionableRuns = (runs ?? []).filter(isFollowupRun);
  if (actionableRuns.length === 0) {
    return [];
  }

  const userIds = [...new Set(actionableRuns.map((run) => run.user_id))];
  const jobIds = [...new Set(actionableRuns.map((run) => run.job_id).filter(Boolean))] as string[];

  const [{ data: profiles, error: profilesError }, { data: jobs, error: jobsError }] = await Promise.all([
    supabase.from("profiles").select("*").in("id", userIds),
    jobIds.length > 0 ? supabase.from("jobs").select("id, company, title").in("id", jobIds) : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesError) {
    throw profilesError;
  }
  if (jobsError) {
    throw jobsError;
  }

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const jobMap = new Map((jobs ?? []).map((job) => [job.id, job]));

  const grouped = new Map<string, DailyFollowupItem[]>();

  for (const run of actionableRuns) {
    const profile = profileMap.get(run.user_id);
    if (!profile) {
      continue;
    }
    const summary = toSummary(run);
    const storedAnswers = getStoredFollowupAnswers(profile);
    const followUpItems = getFollowupItems(summary).filter(
      (item) => !storedAnswers[normalizePromptKey(item)]
    );
    if (followUpItems.length === 0) {
      continue;
    }
    const job = run.job_id ? jobMap.get(run.job_id) : null;
    const item: DailyFollowupItem = {
      runId: run.id,
      portal: run.portal,
      url: run.url,
      jobTitle: job?.title ?? null,
      company: job?.company ?? null,
      blockedStep: typeof summary.blocked_step === "string" ? summary.blocked_step : null,
      followUpItems,
    };

    const existing = grouped.get(run.user_id) ?? [];
    existing.push(item);
    grouped.set(run.user_id, existing);
  }

  const recipients: DailyFollowupRecipient[] = [];
  for (const [userId, items] of grouped.entries()) {
    const profile = profileMap.get(userId);
    if (!profile || !profile.sms_opt_in || !profile.phone) {
      continue;
    }
    recipients.push({ profile, items });
  }

  return recipients;
}

export async function getDailyFollowupItemsForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
  sinceIso: string
): Promise<DailyFollowupItem[]> {
  const recipients = await getDailyFollowupRecipients(supabase, sinceIso);
  const recipient = recipients.find((entry) => entry.profile.id === userId);
  return recipient?.items ?? [];
}

export async function storeFollowupAnswersForUser(
  supabase: SupabaseClient<Database>,
  profile: ProfileRow,
  items: DailyFollowupItem[],
  answers: string[]
): Promise<{ stored: boolean; count: number }> {
  if (items.length === 0 || answers.length === 0) {
    return { stored: false, count: 0 };
  }

  const prompts = items
    .flatMap((item) => item.followUpItems)
    .filter((item) => typeof item === "string" && item.trim().length > 0);

  const pairedCount = Math.min(prompts.length, answers.length);
  if (pairedCount === 0) {
    return { stored: false, count: 0 };
  }

  const existingGrayAreas =
    profile.gray_areas && typeof profile.gray_areas === "object"
      ? (profile.gray_areas as Record<string, unknown>)
      : {};
  const existingFollowupAnswers =
    existingGrayAreas.follow_up_answers &&
    typeof existingGrayAreas.follow_up_answers === "object"
      ? (existingGrayAreas.follow_up_answers as Record<string, unknown>)
      : {};

  const mergedFollowupAnswers: Record<string, string> = {};
  for (const [key, value] of Object.entries(existingFollowupAnswers)) {
    if (typeof value === "string") {
      mergedFollowupAnswers[key] = value;
    }
  }

  for (let index = 0; index < pairedCount; index += 1) {
    const prompt = prompts[index];
    const answer = answers[index]?.trim();
    if (!prompt || !answer) continue;
    mergedFollowupAnswers[prompt] = answer;
  }

  const nextGrayAreas = {
    ...existingGrayAreas,
    follow_up_answers: mergedFollowupAnswers,
    last_follow_up_response_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("profiles")
    .update({
      gray_areas: nextGrayAreas as Database["public"]["Tables"]["profiles"]["Update"]["gray_areas"],
    })
    .eq("id", profile.id);

  if (error) {
    throw error;
  }

  return { stored: true, count: pairedCount };
}

export async function sendDailyFollowupSms(
  supabase: SupabaseClient<Database>,
  sinceIso: string
): Promise<{ sent: number; skipped: number; errors: string[] }> {
  const recipients = await getDailyFollowupRecipients(supabase, sinceIso);
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const recipient of recipients) {
    const body = formatDailyFollowupMessage(recipient.items);
    const result = await sendSms(recipient.profile.phone as string, body);
    if (result.success) {
      sent += 1;
    } else {
      skipped += 1;
      errors.push(
        `${recipient.profile.id}: ${result.error || "Unknown SMS failure"}`
      );
    }
  }

  return { sent, skipped, errors };
}
