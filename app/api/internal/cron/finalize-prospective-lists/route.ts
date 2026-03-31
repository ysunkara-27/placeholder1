import { NextRequest, NextResponse } from "next/server";
import { getApplyQueueEnv } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { queueApplication } from "@/lib/application-queue";
import { sendSms } from "@/lib/messaging/send";
import { getSupabaseAdminClientUntyped } from "@/lib/prospective-lists";
import { mapProfileRowToPersistedProfile } from "@/lib/platform/profile";
import { mapPersistedProfileToApplicantDraft } from "@/lib/platform/applicant";

export const runtime = "nodejs";
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const { workerSecret } = getApplyQueueEnv();
  if (!workerSecret) return false;

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  return token === workerSecret;
}

function sliceUpTo(items: string[], max: number) {
  return items.slice(0, max);
}

// POST /api/internal/cron/finalize-prospective-lists
// At cutoff: pending -> confirmed, queue applications, and send the "queued now, results soon" SMS.
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const typedSupabase = getSupabaseAdminClient();
  const untypedSupabase = getSupabaseAdminClientUntyped();

  const now = new Date();
  const nowUtcIso = now.toISOString();

  const { data: lists, error: listsError } = await untypedSupabase
    .from("prospective_lists")
    .select("*")
    .eq("status", "sent")
    .lte("cutoff_at", nowUtcIso)
    .order("sent_at", { ascending: true })
    .limit(20);

  if (listsError) {
    return NextResponse.json({ error: listsError.message }, { status: 500 });
  }

  let finalized = 0;
  const errors: string[] = [];

  for (const list of lists ?? []) {
    const listId = list.id as string;
    const userId = list.user_id as string;

    // Pending at cutoff becomes confirmed (applied).
    const pendingUpdate = await untypedSupabase
      .from("prospective_list_items")
      .update({ user_decision: "confirmed" })
      .eq("list_id", listId)
      .eq("user_decision", "pending");

    if (pendingUpdate.error) {
      errors.push(`${listId}: pending->confirmed update failed: ${pendingUpdate.error.message}`);
      continue;
    }

    const itemsAfter = await untypedSupabase
      .from("prospective_list_items")
      .select("*")
      .eq("list_id", listId)
      .order("rank", { ascending: true });

    if (itemsAfter.error) {
      errors.push(`${listId}: itemsAfter fetch failed: ${itemsAfter.error.message}`);
      continue;
    }

    const finalizedUpdate = await untypedSupabase
      .from("prospective_lists")
      .update({ status: "finalized" })
      .eq("id", listId);

    if (finalizedUpdate.error) {
      errors.push(`${listId}: list finalize failed: ${finalizedUpdate.error.message}`);
      continue;
    }

    // Fetch profile + jobs using typed supabase (existing tables are typed).
    const { data: profile } = await typedSupabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) {
      errors.push(`${listId}: profile not found`);
      continue;
    }

    const itemRows = (itemsAfter.data ?? []) as Array<{
      id: string;
      job_id: string;
      rank: number;
      user_decision: string;
    }>;

    const jobIds = itemRows.map((it) => it.job_id);

    const { data: jobs } = jobIds.length
      ? await typedSupabase.from("jobs").select("*").in("id", jobIds)
      : { data: [] as any[] };

    const jobMap = new Map((jobs ?? []).map((j) => [j.id, j]));

    const persistedProfile = mapProfileRowToPersistedProfile(profile);
    const applicantDraft = mapPersistedProfileToApplicantDraft(
      persistedProfile,
      (profile as any).email ?? ""
    );

    const confirmedItems = itemRows.filter((it) => it.user_decision === "confirmed");
    const skippedItems = itemRows.filter((it) => it.user_decision === "skip");

    const appliedLines: string[] = [];
    const skippedLines: string[] = [];

    for (const it of confirmedItems) {
      const job = jobMap.get(it.job_id);
      if (!job) continue;

      const queueResult = await queueApplication(typedSupabase, {
        userId,
        jobId: job.id,
        requestPayload: {
          url: job.application_url,
          profile: applicantDraft,
          runtime_hints: { historical_blocked_families: [] },
        },
      });

      appliedLines.push(`${job.company} — ${job.title}`);

      const update = await untypedSupabase
        .from("prospective_list_items")
        .update({ applied_application_id: queueResult.application.id })
        .eq("id", it.id);

      if (update.error) {
        errors.push(`${listId}: update applied_application_id failed: ${update.error.message}`);
      }
    }

    for (const it of skippedItems) {
      const job = jobMap.get(it.job_id);
      if (!job) continue;
      skippedLines.push(`${job.company} — ${job.title}`);
    }

    const phone = profile.phone as string | null;
    if (phone) {
      const body = [
        "Twin queued your selected applications for today.",
        "Results soon (if Twin needs anything, you'll get prompts).",
        "",
        `Applied (${confirmedItems.length}):`,
        ...sliceUpTo(appliedLines, 5).map((s) => `- ${s}`),
        "",
        `Skipped (${skippedItems.length}):`,
        ...sliceUpTo(skippedLines, 5).map((s) => `- ${s}`),
      ]
        .flat()
        .join("\n")
        .slice(0, 1200);

      const smsResult = await sendSms(phone, body);
      if (!smsResult.success) {
        errors.push(`${listId}: results SMS failed: ${smsResult.error ?? "unknown"}`);
      } else {
        await untypedSupabase
          .from("prospective_lists")
          .update({ queued_results_sent_at: nowUtcIso })
          .eq("id", listId);
      }
    }

    finalized += 1;
  }

  return NextResponse.json({ finalized, errors });
}

