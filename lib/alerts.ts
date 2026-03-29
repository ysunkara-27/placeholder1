import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { sendSms } from "@/lib/messaging/send";

type AlertRow = Database["public"]["Tables"]["alerts"]["Row"];
type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

// 24 hours
const ALERT_EXPIRY_MS = 24 * 60 * 60 * 1000;

function nowIso() {
  return new Date().toISOString();
}

function expiresAtIso() {
  return new Date(Date.now() + ALERT_EXPIRY_MS).toISOString();
}

export function formatAlertMessage(job: JobRow): string {
  const level = job.level.replace("_", "-");
  const location = job.remote ? `${job.location} / Remote` : job.location;

  return [
    `Twin found a match:`,
    ``,
    `${job.company} — ${job.title}`,
    `${location} | ${level}`,
    ``,
    `Reply YES to apply, NO to skip.`,
    `Reply STOP to pause alerts.`,
  ].join("\n");
}

export async function createAlert(
  supabase: SupabaseClient<Database>,
  userId: string,
  jobId: string
): Promise<AlertRow> {
  const existing = await supabase
    .from("alerts")
    .select("*")
    .eq("user_id", userId)
    .eq("job_id", jobId)
    .maybeSingle();

  if (existing.error) throw existing.error;

  if (existing.data) {
    return existing.data;
  }

  const { data, error } = await supabase
    .from("alerts")
    .insert({
      user_id: userId,
      job_id: jobId,
      status: "pending",
      alerted_at: nowIso(),
      expires_at: expiresAtIso(),
    })
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

export async function sendAlertSms(
  supabase: SupabaseClient<Database>,
  alertId: string
): Promise<{ sent: boolean; error?: string }> {
  const { data: alert, error: alertError } = await supabase
    .from("alerts")
    .select("*")
    .eq("id", alertId)
    .single();

  if (alertError || !alert) {
    return { sent: false, error: alertError?.message ?? "Alert not found" };
  }

  if (alert.status !== "pending") {
    return { sent: false, error: `Alert is ${alert.status}, not pending` };
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", alert.job_id)
    .single();

  if (jobError || !job) {
    return { sent: false, error: jobError?.message ?? "Job not found" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", alert.user_id)
    .single();

  if (profileError || !profile) {
    return { sent: false, error: profileError?.message ?? "Profile not found" };
  }

  if (!profile.sms_opt_in || !profile.phone) {
    return { sent: false, error: "User has not opted in to SMS or has no phone" };
  }

  const body = formatAlertMessage(job);
  const result = await sendSms(profile.phone, body);

  if (!result.success) {
    return { sent: false, error: result.error };
  }

  await supabase
    .from("alerts")
    .update({
      response_channel: "sms",
      metadata: { message_id: result.messageId ?? null } as Database["public"]["Tables"]["alerts"]["Update"]["metadata"],
    })
    .eq("id", alertId);

  return { sent: true };
}

export async function confirmAlert(
  supabase: SupabaseClient<Database>,
  alertId: string
): Promise<void> {
  const { error } = await supabase
    .from("alerts")
    .update({ status: "confirmed", replied_at: nowIso() })
    .eq("id", alertId);

  if (error) throw error;
}

export async function skipAlert(
  supabase: SupabaseClient<Database>,
  alertId: string
): Promise<void> {
  const { error } = await supabase
    .from("alerts")
    .update({ status: "skipped", replied_at: nowIso() })
    .eq("id", alertId);

  if (error) throw error;
}

export async function expireAlertsForUser(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<void> {
  await supabase
    .from("alerts")
    .update({ status: "expired" })
    .eq("user_id", userId)
    .eq("status", "pending");
}

export async function findLatestPendingAlert(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<AlertRow | null> {
  const { data, error } = await supabase
    .from("alerts")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("alerted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function findProfileByPhone(
  supabase: SupabaseClient<Database>,
  phone: string
): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  if (error) throw error;

  return data;
}
