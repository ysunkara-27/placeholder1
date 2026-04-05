import { NextRequest, NextResponse } from "next/server";
import { queueApplication } from "@/lib/application-queue";
import { mapPersistedProfileToApplicantDraft } from "@/lib/platform/applicant";
import { mapProfileRowToPersistedProfile } from "@/lib/platform/profile";
import {
  buildRateLimitHeaders,
  consumeRateLimit,
  getRequestIp,
} from "@/lib/request-controls";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

function buildDispositionMessage(disposition: string) {
  if (disposition === "already_queued") return "Application is already queued.";
  if (disposition === "already_running") return "Application is already being processed.";
  if (disposition === "already_submitted") return "Application was already submitted.";
  if (disposition === "cooldown_active") {
    return "A recent identical apply attempt already ran. Wait before retrying.";
  }
  return "Application queued for execution.";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const adminSupabase = getSupabaseAdminClient();
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await consumeRateLimit(adminSupabase, {
      scope: "job_queue",
      subject: user?.id ? `user:${user.id}` : `ip:${getRequestIp(request)}`,
      windowSeconds: 60,
      limit: 10,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded for job queueing" },
        { status: 429, headers: buildRateLimitHeaders(rateLimit) }
      );
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    const profileRow = profileData as ProfileRow | null;

    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();

    if (jobError) throw jobError;
    if (!jobData) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    const job = jobData as JobRow;

    const persistedProfile = profileRow
      ? mapProfileRowToPersistedProfile(profileRow)
      : null;

    const applicantDraft = persistedProfile
      ? mapPersistedProfileToApplicantDraft(persistedProfile, user.email ?? "", job)
      : null;

    if (!applicantDraft) {
      return NextResponse.json({ error: "Profile required before queueing" }, { status: 422 });
    }

    const queued = await queueApplication(adminSupabase, {
      userId: user.id,
      jobId: job.id,
      requestPayload: {
        url: job.application_url,
        profile: applicantDraft,
        runtime_hints: { historical_blocked_families: [] },
      },
    });

    return NextResponse.json({
      application: {
        id: queued.application.id,
        status: queued.application.status,
        job_id: queued.application.job_id,
      },
      disposition: queued.disposition,
      message: buildDispositionMessage(queued.disposition),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to queue application";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
