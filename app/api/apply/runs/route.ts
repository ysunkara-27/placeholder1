import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

type ApplyRunRow = Database["public"]["Tables"]["apply_runs"]["Row"];

function mapApplyRun(row: ApplyRunRow) {
  const resultPayload =
    row.result_payload && typeof row.result_payload === "object"
      ? row.result_payload
      : {};
  const summary =
    "summary" in resultPayload &&
    resultPayload.summary &&
    typeof resultPayload.summary === "object"
      ? resultPayload.summary
      : null;

  return {
    id: row.id,
    mode: row.mode,
    portal: row.portal,
    status: row.status,
    url: row.url,
    error: row.error,
    created_at: row.created_at,
    summary,
  };
}

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ runs: [] });
    }

    const { data, error } = await supabase
      .from("apply_runs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      throw error;
    }

    return NextResponse.json({ runs: (data ?? []).map(mapApplyRun) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load apply runs";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
