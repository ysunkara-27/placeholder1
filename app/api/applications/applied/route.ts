import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

const PAGE_SIZE = 20;

type ApplicationRow = Database["public"]["Tables"]["applications"]["Row"];
type JobRow = Database["public"]["Tables"]["jobs"]["Row"];

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ applications: [], total: 0, page: 1, totalPages: 1 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const offset = (page - 1) * PAGE_SIZE;

    const { count } = await supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "applied");

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const { data: applications, error } = await supabase
      .from("applications")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "applied")
      .order("completed_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;

    const rows = (applications ?? []) as ApplicationRow[];
    if (rows.length === 0) {
      return NextResponse.json({ applications: [], total, page, totalPages });
    }

    const jobIds = [...new Set(rows.map((r) => r.job_id))];
    const { data: jobs } = await supabase
      .from("jobs")
      .select("id, company, title, location, level, portal, remote, posted_at, application_url")
      .in("id", jobIds);

    const jobsById = new Map(
      ((jobs ?? []) as Pick<JobRow, "id" | "company" | "title" | "location" | "level" | "portal" | "remote" | "posted_at" | "application_url">[]).map((j) => [j.id, j])
    );

    const payload = rows
      .map((app) => {
        const job = jobsById.get(app.job_id);
        return {
          id: app.id,
          status: app.status,
          created_at: app.created_at,
          updated_at: app.updated_at,
          completed_at: app.completed_at,
          job: job
            ? {
                id: job.id,
                company: job.company,
                title: job.title,
                location: job.location,
                level: job.level,
                portal: job.portal,
                remote: job.remote,
                posted_at: job.posted_at,
                url: job.application_url,
              }
            : null,
        };
      })
      .filter((a) => a.job !== null);

    return NextResponse.json({ applications: payload, total, page, totalPages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load applied applications";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
