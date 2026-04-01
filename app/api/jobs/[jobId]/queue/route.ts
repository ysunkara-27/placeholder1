import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { mapPersistedProfileToApplicantDraft } from "@/lib/platform/applicant";
import { mapProfileRowToPersistedProfile } from "@/lib/platform/profile";
import type { Database, Json } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ApplicationInsert = Database["public"]["Tables"]["applications"]["Insert"];

function nowIso() {
  return new Date().toISOString();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    const profileRow = profileData as ProfileRow | null;

    // Look up the job
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

    // Check for existing application
    const { data: existingData, error: existingError } = await supabase
      .from("applications")
      .select("*")
      .eq("user_id", user.id)
      .eq("job_id", jobId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existingData) {
      if (existingData.status === "queued" || existingData.status === "running") {
        return NextResponse.json({
          application: {
            id: existingData.id,
            status: existingData.status,
            job_id: existingData.job_id,
          },
        });
      }
      if (existingData.status === "applied") {
        return NextResponse.json(
          { error: "Already applied." },
          { status: 409 }
        );
      }
    }

    // Build the applicant draft
    const persistedProfile = profileRow
      ? mapProfileRowToPersistedProfile(profileRow)
      : null;

    const applicantDraft = persistedProfile
      ? mapPersistedProfileToApplicantDraft(persistedProfile, user.email ?? "")
      : null;

    const requestPayload = {
      url: job.application_url,
      dry_run: false,
      runtime_hints: { historical_blocked_families: [] },
      profile: applicantDraft,
    };

    let applicationId: string;

    if (existingData) {
      // Update failed/requires_auth → queued
      const { data: updated, error: updateError } = await supabase
        .from("applications")
        .update({
          status: "queued",
          request_payload: requestPayload as Json,
          last_error: null,
          confirmation_text: null,
          queued_at: nowIso(),
          started_at: null,
          completed_at: null,
          worker_id: null,
          last_run_id: null,
          browsing_task_id: null,
          applied_at: null,
        })
        .eq("id", existingData.id)
        .select("id")
        .single();

      if (updateError) throw updateError;
      applicationId = updated.id;
    } else {
      // Insert new
      const insertPayload: ApplicationInsert = {
        user_id: user.id,
        job_id: jobId,
        status: "queued",
        request_payload: requestPayload as Json,
        confirmation_text: null,
        last_error: null,
        queued_at: nowIso(),
        started_at: null,
        completed_at: null,
        worker_id: null,
        last_run_id: null,
        browsing_task_id: null,
        applied_at: null,
      };

      const { data: inserted, error: insertError } = await supabase
        .from("applications")
        .insert(insertPayload)
        .select("id")
        .single();

      if (insertError) throw insertError;
      applicationId = inserted.id;
    }

    return NextResponse.json({
      application: {
        id: applicationId,
        status: "queued",
        job_id: jobId,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to queue application";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
