import { NextRequest, NextResponse } from "next/server";
import { selectCandidateJobsForProfile } from "@/lib/candidate-routing";
import { getApplyQueueEnv } from "@/lib/env";
import { buildRateLimitHeaders, consumeRateLimit } from "@/lib/request-controls";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  formatProspectiveListSms,
  getSupabaseAdminClientUntyped,
  localDateStringInTimeZone,
  localMinutesInTimeZone,
  parseTimeLocalHHMM,
  rankProspectiveJobs,
  sendProspectiveListSms,
} from "@/lib/prospective-lists";

export const runtime = "nodejs";

function isAuthorized(req: NextRequest): boolean {
  const { workerSecret } = getApplyQueueEnv();
  if (!workerSecret) return false;

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  return token === workerSecret;
}

function nowIso(): string {
  return new Date().toISOString();
}

// POST /api/internal/cron/send-prospective-lists
// Builds + sends a numbered shortlist SMS at the user's configured local time.
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const typedSupabase = getSupabaseAdminClient();
  const routeRateLimit = await consumeRateLimit(typedSupabase, {
    scope: "cron_send_prospective_lists",
    subject: "worker",
    windowSeconds: 60,
    limit: 6,
  });

  if (!routeRateLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded for prospective-list sends" },
      { status: 429, headers: buildRateLimitHeaders(routeRateLimit) }
    );
  }

  const untypedSupabase = getSupabaseAdminClientUntyped();

  const now = new Date();
  const nowUtcIso = now.toISOString();

  const sinceIso = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  const { data: profiles, error: profilesError } = await typedSupabase
    .from("profiles")
    .select("*")
    .eq("onboarding_completed", true)
    .eq("daily_digest_enabled", true)
    .eq("sms_opt_in", true)
    .not("phone", "is", null);

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const maxItems = 5;

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const rawProfile of profiles ?? []) {
    const profile = rawProfile as unknown as {
      id: string;
      phone: string | null;
      sms_opt_in: boolean;
      daily_digest_enabled: boolean;
      daily_digest_time_local: string;
      daily_digest_timezone: string;
      daily_review_window_minutes?: number;
      daily_digest_shortlist_time_local?: string;
      daily_digest_cutoff_time_local?: string;
      daily_digest_goal_submit_time_local?: string;
    };

    if (!profile.daily_digest_enabled || !profile.sms_opt_in || !profile.phone) {
      skipped += 1;
      continue;
    }

    const tz = profile.daily_digest_timezone || "UTC";
    const shortlistRaw =
      profile.daily_digest_shortlist_time_local ||
      profile.daily_digest_time_local ||
      "18:00";
    const cutoffRaw =
      profile.daily_digest_cutoff_time_local || "19:00";
    const goalRaw =
      profile.daily_digest_goal_submit_time_local || "21:00";

    const shortlistParts = parseTimeLocalHHMM(shortlistRaw);
    const cutoffParts = parseTimeLocalHHMM(cutoffRaw);
    const goalParts = parseTimeLocalHHMM(goalRaw);

    if (!shortlistParts || !cutoffParts || !goalParts) {
      skipped += 1;
      continue;
    }

    const shortlistMinutes = shortlistParts.hour * 60 + shortlistParts.minute;
    const cutoffMinutes = cutoffParts.hour * 60 + cutoffParts.minute;
    const goalMinutes = goalParts.hour * 60 + goalParts.minute;

    // Require strict ordering and at least 60 minutes between cutoff and goal.
    if (
      !(shortlistMinutes < cutoffMinutes && cutoffMinutes < goalMinutes) ||
      goalMinutes - cutoffMinutes < 60
    ) {
      skipped += 1;
      continue;
    }

    const localMinutes = localMinutesInTimeZone(now, tz);
    // Cron runs every ~5 minutes; allow a small local-time drift around shortlist time.
    if (Math.abs(localMinutes - shortlistMinutes) > 2) {
      continue;
    }

    const digestDate = localDateStringInTimeZone(now, tz);

    // Idempotency: don't send another list if one already exists for this digest date.
    const existing = await untypedSupabase
      .from("prospective_lists")
      .select("id,status")
      .eq("user_id", profile.id)
      .eq("digest_date", digestDate)
      .in("status", ["sent", "finalized", "applied"]);

    if ((existing.data?.length ?? 0) > 0) {
      continue;
    }

    const candidateJobs = await selectCandidateJobsForProfile(
      typedSupabase,
      { id: profile.id },
      sinceIso
    ).catch(() => []);

    const selected = rankProspectiveJobs(
      profile as any,
      candidateJobs as any,
      maxItems
    );

    if (selected.length === 0) {
      // No matches: we don't spam with empty lists.
      continue;
    }

    // Compute cutoff datetime in UTC from today's date + cutoffMinutes in user's timezone.
    const [year, month, day] = digestDate.split("-").map((v) => Number(v));
    const cutoffUtcBase = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    cutoffUtcBase.setUTCMinutes(cutoffUtcBase.getUTCMinutes() + cutoffMinutes);
    const cutoffAtIso = cutoffUtcBase.toISOString();

    // Create list + items first; send SMS after persistence so inbound replies can map cleanly.
    const listInsert = await untypedSupabase
      .from("prospective_lists")
      .insert({
        user_id: profile.id,
        digest_date: digestDate,
        status: "pending",
        cutoff_at: cutoffAtIso,
      })
      .select("*")
      .single();

    if (listInsert.error) {
      errors.push(`${profile.id}: ${listInsert.error.message}`);
      continue;
    }

    const listId = listInsert.data?.id as string;

    const itemRows = selected.map((it, index) => ({
      list_id: listId,
      job_id: it.job.id,
      rank: index + 1,
      match_score: it.score,
      match_reasons: it.reasons,
      match_rejections: it.rejections,
      user_decision: "pending",
    }));

    const itemsInsert = await untypedSupabase
      .from("prospective_list_items")
      .insert(itemRows);

    if (itemsInsert.error) {
      errors.push(`${profile.id}: ${itemsInsert.error.message}`);
      continue;
    }

    const body = formatProspectiveListSms({
      digestDateLabel: digestDate,
      items: selected.map((it, index) => ({
        rank: index + 1,
        job: {
          company: it.job.company,
          title: it.job.title,
          location: it.job.location,
          level: it.job.level,
          remote: it.job.remote,
        },
      })),
    });

    const smsResult = await sendProspectiveListSms(profile.phone, body);
    if (!smsResult.success) {
      errors.push(`${profile.id}: SMS failed: ${smsResult.error ?? "unknown"}`);
      // Keep list as non-active until it is successfully sent.
      await untypedSupabase
        .from("prospective_lists")
        .update({ status: "pending", sent_at: null })
        .eq("id", listId);
      continue;
    }

    const sentUpdate = await untypedSupabase
      .from("prospective_lists")
      .update({
        status: "sent",
        sent_at: nowUtcIso,
      })
      .eq("id", listId);

    if (sentUpdate.error) {
      errors.push(`${profile.id}: update sent status failed: ${sentUpdate.error.message}`);
      continue;
    }

    sent += 1;
  }

  return NextResponse.json({ sent, skipped, errors });
}
