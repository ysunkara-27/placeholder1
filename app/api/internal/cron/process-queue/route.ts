import { NextRequest, NextResponse } from "next/server";
import { processNextQueuedApplication } from "@/lib/application-queue";
import { getApplyQueueEnv } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
// Allow up to 5 minutes for queue drain — Vercel Pro max
export const maxDuration = 300;

// Maximum applications to process per cron tick.
// Each apply run can take 30–90 seconds on Workday/Greenhouse.
// At 5 per tick with maxDuration=300 we have ~60s per job as a safe budget.
const MAX_PER_TICK = 5;

function isAuthorized(req: NextRequest): boolean {
  const { workerSecret } = getApplyQueueEnv();

  if (!workerSecret) {
    // Secret not configured — block all requests
    return false;
  }

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");

  // Vercel Cron sends Authorization: Bearer {CRON_SECRET} where CRON_SECRET
  // is injected automatically. We reuse APPLY_QUEUE_WORKER_SECRET so a single
  // env var covers both Vercel Cron and manual Railway triggers.
  return token === workerSecret;
}

// POST /api/internal/cron/process-queue
// Called every minute by Vercel Cron (configured in vercel.json).
// Drains up to MAX_PER_TICK queued applications per invocation.
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  const workerId = `cron-${Date.now()}`;

  const results: Array<{
    applicationId: string | null;
    status: string | null;
    portal: string | null;
    runId: string | null;
    error: string | null;
  }> = [];

  for (let i = 0; i < MAX_PER_TICK; i++) {
    let result;

    try {
      result = await processNextQueuedApplication(supabase, workerId);
    } catch (err) {
      results.push({
        applicationId: null,
        status: "error",
        portal: null,
        runId: null,
        error: err instanceof Error ? err.message : "Unknown error",
      });
      break;
    }

    if (!result.processed) {
      // Queue is empty — stop draining
      break;
    }

    results.push({
      applicationId: result.application?.id ?? null,
      status: result.status,
      portal: result.portal,
      runId: result.runId,
      error: result.error,
    });
  }

  return NextResponse.json({
    processed: results.length,
    results,
  });
}
