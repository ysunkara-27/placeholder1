import { NextRequest, NextResponse } from "next/server";
import { normalizeJobIndustries } from "@/lib/job-industries";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { matchJobToProfile } from "@/lib/matching";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export interface JobWithMatch extends JobRow {
  match: {
    matched: boolean;
    score: number;
    reasons: string[];
    rejections: string[];
  };
  application_status: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    const profileRow = profileData as ProfileRow | null;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? "";
    const industriesParam = searchParams.get("industries") ?? "";
    const levelsParam = searchParams.get("levels") ?? "";
    const remoteParam = searchParams.get("remote") ?? "";
    const portal = searchParams.get("portal") ?? "";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "30", 10), 100);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    // Build query
    let query = supabase
      .from("jobs")
      .select("*")
      .eq("status", "active")
      .not("canonical_url", "is", null)
      .order("posted_at", { ascending: false });

    if (search) {
      query = query.or(`company.ilike.%${search}%,title.ilike.%${search}%`);
    }

    const requestedIndustries = industriesParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (levelsParam) {
      const levels = levelsParam.split(",").map((s) => s.trim()).filter(Boolean);
      if (levels.length > 0) {
        query = query.in("level", levels);
      }
    }

    if (remoteParam === "true") {
      query = query.eq("remote", true);
    }

    if (portal) {
      query = query.eq("portal", portal);
    }

    // Count query
    let countQuery = supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .not("canonical_url", "is", null);

    if (search) {
      countQuery = countQuery.or(`company.ilike.%${search}%,title.ilike.%${search}%`);
    }
    if (levelsParam) {
      const levels = levelsParam.split(",").map((s) => s.trim()).filter(Boolean);
      if (levels.length > 0) {
        countQuery = countQuery.in("level", levels);
      }
    }
    if (remoteParam === "true") {
      countQuery = countQuery.eq("remote", true);
    }
    if (portal) {
      countQuery = countQuery.eq("portal", portal);
    }

    const shouldFilterIndustriesInMemory = requestedIndustries.length > 0;
    const [jobsResponse, countResponse] = await Promise.all([
      shouldFilterIndustriesInMemory ? query : query.range(offset, offset + limit - 1),
      shouldFilterIndustriesInMemory ? Promise.resolve({ count: null }) : countQuery,
    ]);

    if (jobsResponse.error) throw jobsResponse.error;

    const rawJobs = (jobsResponse.data ?? []) as JobRow[];
    const normalizedJobs = rawJobs.map((job) => ({
      ...job,
      industries: normalizeJobIndustries(job.industries, job.title, job.jd_summary ?? ""),
    }));

    const filteredJobs =
      requestedIndustries.length > 0
        ? normalizedJobs.filter((job) =>
            job.industries.some((industry) => requestedIndustries.includes(industry))
          )
        : normalizedJobs;

    const jobs = shouldFilterIndustriesInMemory
      ? filteredJobs.slice(offset, offset + limit)
      : filteredJobs;
    const total = shouldFilterIndustriesInMemory
      ? filteredJobs.length
      : countResponse.count ?? 0;
    const jobIds = jobs.map((job) => job.id);

    let applicationStatusByJobId = new Map<string, string>();
    if (user?.id && jobIds.length > 0) {
      const { data: applicationRows, error: applicationError } = await supabase
        .from("applications")
        .select("job_id,status,updated_at")
        .eq("user_id", user.id)
        .in("job_id", jobIds)
        .order("updated_at", { ascending: false });

      if (applicationError) {
        throw applicationError;
      }

      for (const row of applicationRows ?? []) {
        if (!applicationStatusByJobId.has(row.job_id)) {
          applicationStatusByJobId.set(row.job_id, row.status);
        }
      }
    }

    // Score and sort
    const jobsWithMatch: JobWithMatch[] = jobs.map((job) => ({
      ...job,
      match: profileRow ? matchJobToProfile(job, profileRow) : { matched: false, score: 0, reasons: [], rejections: [] },
      application_status: applicationStatusByJobId.get(job.id) ?? null,
    }));

    jobsWithMatch.sort((a, b) => {
      if (a.match.matched && !b.match.matched) return -1;
      if (!a.match.matched && b.match.matched) return 1;
      return b.match.score - a.match.score;
    });

    return NextResponse.json({ jobs: jobsWithMatch, total });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch jobs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
