import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

type ApplicationRow = Database["public"]["Tables"]["applications"]["Row"];
type JobRow = Database["public"]["Tables"]["jobs"]["Row"];

// Status is stored as-is in the DB: 'applied', 'queued', 'running', 'requires_auth', 'failed'
function mapStatus(status: string): string {
  return status;
}

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ applications: [] });
    }

    const applicationsResponse = await supabase
      .from("applications")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(10);

    if (applicationsResponse.error) {
      throw applicationsResponse.error;
    }

    const applications = (applicationsResponse.data ?? []) as ApplicationRow[];
    if (applications.length === 0) {
      return NextResponse.json({ applications: [] });
    }

    const jobIds = [...new Set(applications.map((application) => application.job_id))];
    const jobsResponse = await supabase
      .from("jobs")
      .select("*")
      .in("id", jobIds);

    if (jobsResponse.error) {
      throw jobsResponse.error;
    }

    const jobsById = new Map(
      ((jobsResponse.data ?? []) as JobRow[]).map((job) => [job.id, job])
    );

    const payload = applications
      .map((application) => {
        const job = jobsById.get(application.job_id);
        if (!job) {
          return null;
        }

        return {
          id: application.id,
          status: mapStatus(application.status),
          queue_status: application.status,
          request_payload: application.request_payload,
          attempt_count: application.attempt_count,
          created_at: application.created_at,
          updated_at: application.updated_at,
          queued_at: application.queued_at,
          started_at: application.started_at,
          completed_at: application.completed_at,
          confirmation_text: application.confirmation_text,
          last_error: application.last_error,
          job: {
            id: job.id,
            company: job.company,
            title: job.title,
            location: job.location,
            posted_at: job.posted_at,
            level: job.level,
            portal: job.portal,
            remote: job.remote,
            industries: job.industries,
            jd_summary: job.jd_summary,
            url: job.application_url,
          },
        };
      })
      .filter(Boolean);

    return NextResponse.json({ applications: payload });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load recent applications";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
