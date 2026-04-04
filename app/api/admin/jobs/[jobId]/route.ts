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

// PATCH /api/admin/jobs/[jobId] — update any job fields
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const denied = await assertAdmin();
  if (denied) return denied;

  const { jobId } = await params;
  const body = await request.json();

  // Whitelist of editable fields
  const EDITABLE: Array<keyof Database["public"]["Tables"]["jobs"]["Update"]> = [
    "company", "title", "status", "level", "location", "remote",
    "url", "application_url", "canonical_url", "canonical_application_url",
    "portal", "jd_summary", "is_early_career", "role_family",
    "experience_band", "industries", "posted_at",
  ];

  const update: Record<string, unknown> = {};
  for (const key of EDITABLE) {
    if (key in body) update[key] = body[key];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const db = getServiceClient();
  const { data, error } = await db
    .from("jobs")
    .update(update as Database["public"]["Tables"]["jobs"]["Update"])
    .eq("id", jobId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/admin/jobs/[jobId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const denied = await assertAdmin();
  if (denied) return denied;

  const { jobId } = await params;
  const db = getServiceClient();

  const { error } = await db.from("jobs").delete().eq("id", jobId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
