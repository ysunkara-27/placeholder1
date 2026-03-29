import { NextResponse } from "next/server";
import { processNextQueuedApplication } from "@/lib/application-queue";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to process queued applications" },
        { status: 401 }
      );
    }

    const result = await processNextQueuedApplication(
      getSupabaseAdminClient(),
      `manual-${user.id.slice(0, 8)}`,
      user.id
    );

    return NextResponse.json({
      ...result,
      run_id: result.runId,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to process queued application";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
