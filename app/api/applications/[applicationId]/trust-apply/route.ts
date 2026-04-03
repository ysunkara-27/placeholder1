import { NextResponse } from "next/server";
import { processApplicationById } from "@/lib/application-queue";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const { applicationId } = await params;
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to trust apply a queued application" },
        { status: 401 }
      );
    }

    const result = await processApplicationById(
      getSupabaseAdminClient(),
      `trust-${user.id.slice(0, 8)}`,
      applicationId,
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
        : "Failed to trust apply queued application";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
