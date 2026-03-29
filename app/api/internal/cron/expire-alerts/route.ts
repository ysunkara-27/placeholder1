import { NextRequest, NextResponse } from "next/server";
import { getApplyQueueEnv } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function isAuthorized(req: NextRequest): boolean {
  const { workerSecret } = getApplyQueueEnv();

  if (!workerSecret) {
    return false;
  }

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  return token === workerSecret;
}

// POST /api/internal/cron/expire-alerts
// Called hourly by Vercel Cron. Marks pending alerts expired when expires_at has passed.
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("alerts")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString())
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ expired: data?.length ?? 0 });
}
