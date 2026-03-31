import { NextRequest, NextResponse } from "next/server";
import { getApplyQueueEnv } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendDailyFollowupSms } from "@/lib/followups";

export const runtime = "nodejs";

function readWorkerSecret(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }
  return req.headers.get("x-twin-worker-secret")?.trim() ?? "";
}

export async function POST(req: NextRequest) {
  try {
    const { workerSecret } = getApplyQueueEnv();
    const requestSecret = readWorkerSecret(req);

    if (!workerSecret || requestSecret !== workerSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const result = await sendDailyFollowupSms(getSupabaseAdminClient(), since);

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send daily follow-up SMS";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
