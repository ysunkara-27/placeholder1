import { NextRequest, NextResponse } from "next/server";
import { queueApplication } from "@/lib/application-queue";
import { parseApplyPlanRequest } from "@/lib/apply-engine";
import { listRecentApplyRunHistorySignals } from "@/lib/apply-runs";
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

function buildDispositionMessage(disposition: string) {
  if (disposition === "already_queued") {
    return "Application is already queued.";
  }

  if (disposition === "already_running") {
    return "Application is already being processed.";
  }

  if (disposition === "already_submitted") {
    return "Application was already submitted.";
  }

  return "Application queued for execution.";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const payload = parseApplyPlanRequest(body);
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to queue an application" },
        { status: 401 }
      );
    }

    const history = await listRecentApplyRunHistorySignals(supabase, user.id);
    const readiness = buildUrlApplyReadinessSummary(payload.profile, payload.url, history);
    const criticalIssues = readiness.critical_issues;

    if (criticalIssues.length > 0) {
      return NextResponse.json(
        {
          error: `Profile is missing critical apply fields: ${criticalIssues
            .map((issue) => issue.label)
            .join(", ")}`,
          readiness,
          readiness_issues: criticalIssues,
        },
        { status: 422 }
      );
    }

    const job = await ensureJobForApplicationUrl(
      getSupabaseAdminClient(),
      payload.url
    );

    if (!job) {
      return NextResponse.json(
        { error: "Unable to materialize this job into the Twin jobs table yet" },
        { status: 404 }
      );
    }

    const queued = await queueApplication(getSupabaseAdminClient(), {
      userId: user.id,
      jobId: job.id,
      requestPayload: {
        ...payload,
        runtime_hints: buildRuntimeHints(readiness),
      },
    });

    return NextResponse.json({
      portal: queued.portal,
      status: queued.application.status,
      readiness,
      queued: queued.disposition === "queued",
      disposition: queued.disposition,
      message: buildDispositionMessage(queued.disposition),
      application: {
        id: queued.application.id,
        status: queued.application.status,
        attempt_count: queued.application.attempt_count,
        queued_at: queued.application.queued_at,
        started_at: queued.application.started_at,
        completed_at: queued.application.completed_at,
        last_error: queued.application.last_error,
        updated_at: queued.application.updated_at,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to queue apply run";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
