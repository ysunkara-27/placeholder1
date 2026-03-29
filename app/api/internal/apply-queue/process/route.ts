import { NextRequest, NextResponse } from "next/server";
import { processNextQueuedApplication } from "@/lib/application-queue";
import { getApplyQueueEnv } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

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

    const result = await processNextQueuedApplication(
      getSupabaseAdminClient(),
      "queue-worker"
    );

    return NextResponse.json({
      ...result,
      run_id: result.runId,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to process queued application";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
