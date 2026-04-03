import { NextRequest, NextResponse } from "next/server";
import { getApplyQueueEnv } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendAlertSms } from "@/lib/alerts";
import { buildRateLimitHeaders, consumeRateLimit } from "@/lib/request-controls";

// POST /api/messaging/send-alert
// Authorization: Bearer $APPLY_QUEUE_WORKER_SECRET
// Body: { alert_id: string }
//
// Internal route — called by worker or cron after creating an alert row.
// Sends the outbound SMS and records the message_id on the alert.

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { workerSecret } = getApplyQueueEnv();
  const supabase = getSupabaseAdminClient();

  if (workerSecret) {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.replace(/^Bearer\s+/i, "");

    if (token !== workerSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let alertId: string;

  try {
    const body = (await req.json()) as { alert_id?: unknown };
    if (typeof body.alert_id !== "string" || !body.alert_id) {
      return NextResponse.json({ error: "alert_id required" }, { status: 400 });
    }
    alertId = body.alert_id;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rateLimit = await consumeRateLimit(supabase, {
    scope: "send_alert_sms",
    subject: `alert:${alertId}`,
    windowSeconds: 3600,
    limit: 1,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Alert SMS already attempted in the current window" },
      { status: 429, headers: buildRateLimitHeaders(rateLimit) }
    );
  }

  const result = await sendAlertSms(supabase, alertId);

  if (!result.sent) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({ sent: true });
}
