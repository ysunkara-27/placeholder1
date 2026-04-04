import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

const ADMIN_EMAILS = ["sunkarayashaswi@gmail.com", "surajnvaddi@gmail.com"];

function getServiceClient() {
  const { url, serviceRoleKey } = getSupabaseEnv();
  return createClient<Database>(url, serviceRoleKey!);
}

async function assertAdmin(): Promise<NextResponse | null> {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || !ADMIN_EMAILS.includes(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

// GET /api/admin/jobs — paginated list + stats
export async function GET(request: NextRequest) {
  const denied = await assertAdmin();
  if (denied) return denied;

  const db = getServiceClient();
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const limit = Math.min(100, Math.max(10, Number(params.get("limit") ?? 50)));
  const search = params.get("search")?.trim() ?? "";
  const status = params.get("status") ?? "";
  const portal = params.get("portal") ?? "";
  const missing = params.get("missing") ?? ""; // "canonical_url"

  // Stats query (always full table)
  const { data: allStatuses } = await db
    .from("jobs")
    .select("status, canonical_url");

  const stats = {
    total: allStatuses?.length ?? 0,
    active: allStatuses?.filter((j) => j.status === "active").length ?? 0,
    paused: allStatuses?.filter((j) => j.status === "paused").length ?? 0,
    closed: allStatuses?.filter((j) => j.status === "closed").length ?? 0,
    null_canonical: allStatuses?.filter((j) => !j.canonical_url).length ?? 0,
  };

  // Build jobs query
  let query = db
    .from("jobs")
    .select("*", { count: "exact" })
    .order("posted_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (search) {
    query = query.or(`company.ilike.%${search}%,title.ilike.%${search}%`);
  }
  if (status) {
    query = query.eq("status", status);
  }
  if (portal) {
    query = query.eq("portal", portal);
  }
  if (missing === "canonical_url") {
    query = query.is("canonical_url", null);
  }

  const { data: jobs, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ jobs: jobs ?? [], total: count ?? 0, stats });
}

// POST /api/admin/jobs — bulk operations
export async function POST(request: NextRequest) {
  const denied = await assertAdmin();
  if (denied) return denied;

  const db = getServiceClient();
  const body = await request.json();
  const { action, jobIds, status: newStatus } = body as {
    action: "fix_canonical" | "set_status" | "delete";
    jobIds?: string[];
    status?: string;
  };

  if (action === "fix_canonical") {
    // Fix all jobs where canonical_url is null
    const { data: nullJobs } = await db
      .from("jobs")
      .select("id, url")
      .is("canonical_url", null)
      .limit(1000);

    let fixed = 0;
    for (const job of nullJobs ?? []) {
      if (!job.url) continue;
      const { error } = await db
        .from("jobs")
        .update({ canonical_url: job.url })
        .eq("id", job.id);
      if (!error) fixed++;
    }
    return NextResponse.json({ affected: fixed });
  }

  if (!jobIds?.length) {
    return NextResponse.json({ error: "jobIds required" }, { status: 400 });
  }

  if (action === "set_status") {
    if (!newStatus || !["active", "paused", "closed"].includes(newStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const { data, error } = await db
      .from("jobs")
      .update({ status: newStatus })
      .in("id", jobIds)
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ affected: data?.length ?? jobIds.length });
  }

  if (action === "delete") {
    const { data, error } = await db
      .from("jobs")
      .delete()
      .in("id", jobIds)
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ affected: data?.length ?? jobIds.length });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
