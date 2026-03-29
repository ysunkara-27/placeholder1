import { NextRequest, NextResponse } from "next/server";
import { queueApplication } from "@/lib/application-queue";
import { parseApplyPlanRequest } from "@/lib/apply-engine";
import { ensureJobForApplicationUrl } from "@/lib/jobs";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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
      requestPayload: payload,
    });

    return NextResponse.json({
      portal: queued.portal,
      status: queued.application.status,
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
