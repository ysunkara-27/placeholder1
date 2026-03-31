import { NextRequest, NextResponse } from "next/server";
import { fetchApplyPlan, parseApplyPlanRequest } from "@/lib/apply-engine";
import { listRecentApplyRunHistorySignals, persistApplyRun } from "@/lib/apply-runs";
import { ensureJobForApplicationUrl } from "@/lib/jobs";
import { buildUrlApplyReadinessSummary } from "@/lib/platform/apply-readiness";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function buildRuntimeHints(
  readiness: ReturnType<typeof buildUrlApplyReadinessSummary>
) {
  const historicalFamilies = Array.from(
    new Set(readiness.historical_issues.map((issue) => issue.bucket))
  );

  return {
    likely_blocked_family:
      readiness.historical_issues[0]?.bucket ?? readiness.likely_issues[0]?.bucket,
    historical_blocked_families: historicalFamilies,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const payload = parseApplyPlanRequest(body);
    let readiness = buildUrlApplyReadinessSummary(payload.profile, payload.url);
    let saved = false;
    let runId: string | null = null;

    try {
      const supabase = await getSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.id) {
        const history = await listRecentApplyRunHistorySignals(supabase, user.id);
        readiness = buildUrlApplyReadinessSummary(payload.profile, payload.url, history);
        const runtimeHints = buildRuntimeHints(readiness);
        const job = await ensureJobForApplicationUrl(
          getSupabaseAdminClient(),
          payload.url
        );
        const enginePayload = {
          ...payload,
          runtime_hints: runtimeHints,
        };
        const result = await fetchApplyPlan(enginePayload);
        const record = await persistApplyRun(supabase, {
          userId: user.id,
          jobId: job?.id ?? null,
          mode: "plan",
          url: payload.url,
          portal: result.portal,
          status: result.status,
          requestPayload: enginePayload,
          resultPayload: result,
          error: result.error,
        });
        saved = true;
        runId = record.id;
        return NextResponse.json({ ...result, readiness, saved, run_id: runId });
      }
    } catch (error) {
      console.error("[apply/plan][persist]", error);
    }

    const result = await fetchApplyPlan({
      ...payload,
      runtime_hints: buildRuntimeHints(readiness),
    });
    return NextResponse.json({ ...result, readiness, saved, run_id: runId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch apply plan";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
