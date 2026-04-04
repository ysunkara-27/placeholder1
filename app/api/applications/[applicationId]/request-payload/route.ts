import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const { applicationId } = await params;
    const body = await request.json();
    const requestPayload = body?.request_payload;

    if (
      !requestPayload ||
      typeof requestPayload !== "object" ||
      Array.isArray(requestPayload)
    ) {
      return NextResponse.json(
        { error: "request_payload must be an object" },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("applications")
      .update({
        request_payload: requestPayload,
      })
      .eq("id", applicationId)
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update application payload";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
