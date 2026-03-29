import { NextRequest, NextResponse } from "next/server";
import { fetchApplyPlan, parseApplyPlanRequest } from "@/lib/apply-engine";
import { persistApplyRun } from "@/lib/apply-runs";
import { ensureJobForApplicationUrl } from "@/lib/jobs";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const payload = parseApplyPlanRequest(body);
    const result = await fetchApplyPlan(payload);
    let saved = false;
    let runId: string | null = null;

    try {
      const supabase = await getSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.id) {
        const job = await ensureJobForApplicationUrl(
          getSupabaseAdminClient(),
          payload.url
        );
        const record = await persistApplyRun(supabase, {
          userId: user.id,
          jobId: job?.id ?? null,
          mode: "plan",
          url: payload.url,
          portal: result.portal,
          status: result.status,
          requestPayload: payload,
          resultPayload: result,
          error: result.error,
        });
        saved = true;
        runId = record.id;
      }
    } catch (error) {
      console.error("[apply/plan][persist]", error);
    }

    return NextResponse.json({ ...result, saved, run_id: runId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch apply plan";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
