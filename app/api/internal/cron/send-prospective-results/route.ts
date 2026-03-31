import { NextRequest, NextResponse } from "next/server";
import { getApplyQueueEnv } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendSms } from "@/lib/messaging/send";
import { getSupabaseAdminClientUntyped } from "@/lib/prospective-lists";

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

// POST /api/internal/cron/send-prospective-results
// After apps complete: send the "final outcomes" SMS for finalized prospective lists.
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const typedSupabase = getSupabaseAdminClient();
  const untypedSupabase = getSupabaseAdminClientUntyped();

  const nowUtcIso = nowIso();

  const { data: lists, error: listsError } = await untypedSupabase
    .from("prospective_lists")
    .select("*")
    .eq("status", "finalized")
    .is("final_results_sent_at", null)
    .limit(50);

  if (listsError) {
    return NextResponse.json({ error: listsError.message }, { status: 500 });
  }

  let sent = 0;
  const errors: string[] = [];

  for (const list of lists ?? []) {
    const listId = list.id as string;
    const userId = list.user_id as string;

    const { data: items } = await untypedSupabase
      .from("prospective_list_items")
      .select("id,job_id,rank,user_decision,applied_application_id")
      .eq("list_id", listId);

    if (!items || items.length === 0) continue;

    const confirmedItems = items.filter(
      (it: any) => it.user_decision === "confirmed" && it.applied_application_id
    ) as Array<{ id: string; job_id: string; applied_application_id: string }>;

    if (confirmedItems.length === 0) {
      // Nothing queued/applied; still send a lightweight results SMS.
      const { data: profile } = await typedSupabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (profile?.phone) {
        const skippedCount = items.filter((it: any) => it.user_decision === "skip").length;
        const body = [
          "Twin results for today:",
          "",
          `Applied (0)`,
          `Skipped (${skippedCount})`,
          "",
          "If Twin needs anything from you, you'll get prompts shortly.",
        ].join("\n").slice(0, 1200);
        const sms = await sendSms(profile.phone as string, body);
        if (sms.success) {
          await untypedSupabase
            .from("prospective_lists")
            .update({ status: "applied", final_results_sent_at: nowUtcIso })
            .eq("id", listId);
          sent += 1;
          continue;
        }
      }
      continue;
    }

    const applicationIds = confirmedItems.map((it) => it.applied_application_id);

    const { data: applications } = await typedSupabase
      .from("applications")
      .select("id,status,job_id,confirmation_text,last_run_id,attempt_count,last_error,worker_id")
      .in("id", applicationIds);

    const appById = new Map((applications ?? []).map((a) => [a.id, a]));
    if (applications?.length !== applicationIds.length) {
      continue;
    }

    const terminalStatuses = new Set(["applied", "requires_auth", "failed", "submitted"]);
    const allTerminal = confirmedItems.every((it) => {
      const app = appById.get(it.applied_application_id);
      return app && terminalStatuses.has(app.status);
    });
    if (!allTerminal) continue;

    const appliedApps = (applications ?? []).filter((a) => a.status === "applied");
    const blockedApps = (applications ?? []).filter((a) => a.status !== "applied");

    const jobIds = Array.from(new Set(items.map((it: any) => it.job_id)));
    const { data: jobs } = jobIds.length
      ? await typedSupabase.from("jobs").select("id,company,title").in("id", jobIds)
      : { data: [] as any[] };
    const jobMap = new Map((jobs ?? []).map((j) => [j.id, j]));

    const appliedLines = appliedApps
      .map((a) => jobMap.get(a.job_id) ? `${jobMap.get(a.job_id).company} — ${jobMap.get(a.job_id).title}` : null)
      .filter(Boolean)
      .slice(0, 5) as string[];

    const blockedLines = blockedApps
      .map((a) => {
        const job = jobMap.get(a.job_id);
        if (!job) return null;
        const reason = a.status === "requires_auth" ? "needs confirmation" : "failed automation";
        return `${job.company} — ${job.title} (${reason})`;
      })
      .filter(Boolean)
      .slice(0, 5) as string[];

    const { data: profile } = await typedSupabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.phone) continue;

    const skippedCount = items.filter((it: any) => it.user_decision === "skip").length;
    const body = [
      "Twin results for today:",
      "",
      `Applied (${appliedApps.length}):`,
      ...appliedLines.map((l) => `- ${l}`),
      "",
      `Blocked (${blockedApps.length}):`,
      ...blockedLines.map((l) => `- ${l}`),
      "",
      `Skipped (${skippedCount}).`,
      "",
      "If Twin needs anything from you, you'll get follow-up SMS prompts.",
    ]
      .flat()
      .join("\n")
      .slice(0, 1200);

    const sms = await sendSms(profile.phone as string, body);
    if (!sms.success) {
      errors.push(`${listId}: final results SMS failed: ${sms.error ?? "unknown"}`);
      continue;
    }

    await untypedSupabase
      .from("prospective_lists")
      .update({ status: "applied", final_results_sent_at: nowUtcIso })
      .eq("id", listId);

    sent += 1;
  }

  return NextResponse.json({ sent, errors });
}

