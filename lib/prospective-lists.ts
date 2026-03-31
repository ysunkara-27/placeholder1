import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";
import { sendSms } from "@/lib/messaging/send";
import { matchJobToProfile } from "@/lib/matching";
import type { Database } from "@/lib/supabase/database.types";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export type ProspectiveListCommand =
  | { kind: "apply_all" }
  | { kind: "skip_all" }
  | { kind: "skip_indices"; indices: number[] }
  | { kind: "help" };

export function parseProspectiveListReply(
  rawText: string
): { command: ProspectiveListCommand | null; debug?: string } {
  const text = rawText
    .trim()
    .toUpperCase()
    // Mirror `normalizeReplyText` so punctuation like "YES!" still works.
    .replace(/[.!,]+$/, "");

  if (text.length === 0) return { command: null };

  // Help
  if (
    text === "HELP" ||
    text === "?" ||
    text === "WHAT" ||
    text.includes("HOW") ||
    text.includes("COMMAND")
  ) {
    return { command: { kind: "help" } };
  }

  // Apply-all (also accept YES)
  if (
    text === "YES" ||
    text === "APPLY" ||
    text === "APPLY ALL" ||
    text === "APPLYEVERYTHING" ||
    text === "CONFIRM" ||
    text === "APPLY ALL."
  ) {
    return { command: { kind: "apply_all" } };
  }

  // Skip-all (also accept NO)
  if (
    text === "NO" ||
    text === "SKIP" ||
    text === "SKIP ALL" ||
    text === "SKIPEVERYTHING" ||
    text === "DECLINE"
  ) {
    // Only treat "SKIP" as skip-all if it's exactly "SKIP".
    // If someone says "SKIP 2", that is handled below.
    if (text === "SKIP") return { command: { kind: "skip_all" } };
    return { command: { kind: "skip_all" } };
  }

  // SKIP N / SKIP 1,2,3
  const skipMatch = text.match(/^SKIP\s+(.+)$/);
  if (skipMatch) {
    const tail = skipMatch[1] ?? "";
    const nums = tail
      .split(/[^0-9]+/g)
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n) && n >= 1);
    if (nums.length > 0) {
      return { command: { kind: "skip_indices", indices: Array.from(new Set(nums)) } };
    }
  }

  // Bare index: "2" (skip item #2)
  const bare = text.match(/^\s*([0-9]{1,3})\s*$/);
  if (bare) {
    const idx = Number(bare[1]);
    if (Number.isFinite(idx) && idx >= 1) {
      return { command: { kind: "skip_indices", indices: [idx] } };
    }
  }

  return { command: null };
}

export function formatProspectiveListHelpSms(): string {
  return [
    "Reply commands for today's Twin list:",
    "",
    "1) Reply `APPLY ALL` (or `YES`) to apply to everything.",
    "2) Reply `SKIP ALL` (or `NO`) to skip everything.",
    "3) Reply `SKIP 2` (or just `2`) to skip a specific number.",
    "   You can also do `SKIP 1,3`.",
    "4) Reply `STOP` to pause SMS alerts.",
  ].join("\n");
}

export function getSupabaseAdminClientUntyped() {
  const { url, serviceRoleKey } = getSupabaseEnv();
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function findActiveProspectiveList(
  supabaseAdminUntyped: ReturnType<typeof getSupabaseAdminClientUntyped>,
  userId: string,
  nowIso: string
) {
  const { data, error } = await supabaseAdminUntyped
    .from("prospective_lists")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "sent")
    .gt("cutoff_at", nowIso)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function getProspectiveListItems(
  supabaseAdminUntyped: ReturnType<typeof getSupabaseAdminClientUntyped>,
  listId: string
) {
  const { data, error } = await supabaseAdminUntyped
    .from("prospective_list_items")
    .select("*")
    .eq("list_id", listId)
    .order("rank", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Array<{
    id: string;
    job_id: string;
    rank: number;
    user_decision: string;
  }>;
}

export async function applyProspectiveListCommand(
  supabaseAdminUntyped: ReturnType<typeof getSupabaseAdminClientUntyped>,
  listId: string,
  command: ProspectiveListCommand
) {
  if (command.kind === "help") return;

  if (command.kind === "apply_all") {
    const { error } = await supabaseAdminUntyped
      .from("prospective_list_items")
      .update({ user_decision: "confirmed" })
      .eq("list_id", listId);
    if (error) throw error;
    return;
  }

  if (command.kind === "skip_all") {
    const { error } = await supabaseAdminUntyped
      .from("prospective_list_items")
      .update({ user_decision: "skip" })
      .eq("list_id", listId);
    if (error) throw error;
    return;
  }

  if (command.kind === "skip_indices") {
    const { error } = await supabaseAdminUntyped
      .from("prospective_list_items")
      .update({ user_decision: "skip" })
      .eq("list_id", listId)
      .in("rank", command.indices);
    if (error) throw error;
  }
}

export function localDateStringInTimeZone(date: Date, timeZone: string): string {
  // `YYYY-MM-DD` in the target timezone.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const yyyy = get("year");
  const mm = get("month");
  const dd = get("day");
  return `${yyyy}-${mm}-${dd}`;
}

export function localMinutesInTimeZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export function parseTimeLocalHHMM(v: string): { hour: number; minute: number } | null {
  const m = v.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export function formatProspectiveListSms(opts: {
  digestDateLabel: string;
  items: Array<{
    rank: number;
    job: Pick<JobRow, "company" | "title" | "location" | "level" | "remote">;
  }>;
}) {
  const lines: string[] = [];
  lines.push(`Twin daily shortlist (${opts.digestDateLabel}).`);
  lines.push("");
  lines.push("Reply to confirm or skip:");
  lines.push("");

  for (const it of opts.items.slice(0, 10)) {
    const level = it.job.level.replace("_", "-");
    const location = it.job.remote ? `${it.job.location} / Remote` : it.job.location;
    lines.push(`${it.rank}) ${it.job.company} — ${it.job.title}`);
    lines.push(`   ${location} | ${level}`);
  }

  lines.push("");
  lines.push("Commands:");
  lines.push("- Reply `APPLY ALL` (or `YES`) to apply to everything.");
  lines.push("- Reply `SKIP ALL` (or `NO`) to skip everything.");
  lines.push("- Reply `SKIP 2` (or `2`) to skip a number.");
  lines.push("- Reply `HELP` for options.");
  lines.push("- Reply `STOP` to pause SMS.");

  return lines.join("\n").slice(0, 1200);
}

export async function sendProspectiveListSms(phone: string, body: string) {
  return sendSms(phone, body);
}

export function rankProspectiveJobs(profile: ProfileRow, jobs: JobRow[], maxItems: number) {
  const scored: Array<{
    job: JobRow;
    score: number;
    reasons: string[];
    rejections: string[];
  }> = [];

  for (const job of jobs) {
    const match = matchJobToProfile(job as unknown as JobRow, profile as unknown as ProfileRow);
    if (!match.matched) continue;
    scored.push({
      job,
      score: match.score,
      reasons: match.reasons,
      rejections: match.rejections,
    });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const at = Date.parse(String(a.job.posted_at ?? 0)) || 0;
    const bt = Date.parse(String(b.job.posted_at ?? 0)) || 0;
    return bt - at; // most recently posted first for equal scores
  });

  return scored.slice(0, maxItems);
}

