import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await getSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as {
      follow_up_answers?: Record<string, string>;
    } | null;

    if (!body || typeof body.follow_up_answers !== "object") {
      return NextResponse.json(
        { error: "follow_up_answers object is required" },
        { status: 400 }
      );
    }

    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(body.follow_up_answers)) {
      const k = String(key).trim();
      const v = String(value).trim();
      if (!k || !v) continue;
      sanitized[k] = v;
    }

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }
    if (!profileRow) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const existingGrayAreas =
      profileRow.gray_areas && typeof profileRow.gray_areas === "object"
        ? (profileRow.gray_areas as Record<string, unknown>)
        : {};

    const nextGrayAreas = {
      ...existingGrayAreas,
      follow_up_answers: sanitized,
      last_follow_up_response_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        gray_areas: nextGrayAreas as ProfileRow["gray_areas"],
      })
      .eq("id", user.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save answers";
    console.error("[profile/followup-answers]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

