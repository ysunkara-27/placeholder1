import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { parseTimeLocalHHMM } from "@/lib/prospective-lists";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

function validateSchedule(input: {
  shortlist: string;
  cutoff: string;
  goal: string;
}) {
  const shortlist = parseTimeLocalHHMM(input.shortlist);
  const cutoff = parseTimeLocalHHMM(input.cutoff);
  const goal = parseTimeLocalHHMM(input.goal);

  if (!shortlist || !cutoff || !goal) {
    return { ok: false, error: "Times must be in HH:MM (24h) format." } as const;
  }

  const s = shortlist.hour * 60 + shortlist.minute;
  const c = cutoff.hour * 60 + cutoff.minute;
  const g = goal.hour * 60 + goal.minute;

  if (!(s < c && c < g)) {
    return {
      ok: false,
      error: "Shortlist must be before cutoff, and cutoff before goal submit time.",
    } as const;
  }

  if (g - c < 60) {
    return {
      ok: false,
      error: "There must be at least 60 minutes between cutoff and goal submit time.",
    } as const;
  }

  return { ok: true, minutes: { s, c, g } } as const;
}

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

    const body = (await req.json().catch(() => null)) as
      | {
          shortlist_time_local?: string;
          cutoff_time_local?: string;
          goal_submit_time_local?: string;
        }
      | null;

    if (!body) {
      return NextResponse.json({ error: "Missing body" }, { status: 400 });
    }

    const shortlist = (body.shortlist_time_local ?? "").trim();
    const cutoff = (body.cutoff_time_local ?? "").trim();
    const goal = (body.goal_submit_time_local ?? "").trim();

    if (!shortlist || !cutoff || !goal) {
      return NextResponse.json(
        { error: "All three times (shortlist, cutoff, goal) are required." },
        { status: 400 }
      );
    }

    const validation = validateSchedule({
      shortlist,
      cutoff,
      goal,
    });

    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
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

    const update: Partial<ProfileRow> = {
      daily_digest_shortlist_time_local: shortlist,
      daily_digest_cutoff_time_local: cutoff,
      daily_digest_goal_submit_time_local: goal,
    } as Partial<ProfileRow>;

    const { error: updateError } = await supabase
      .from("profiles")
      .update(update)
      .eq("id", user.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[profile/notification-schedule]", error);
    const message =
      error instanceof Error ? error.message : "Failed to update notification schedule";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

