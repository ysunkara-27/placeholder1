import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getSupabaseAdminClientUntyped,
} from "@/lib/prospective-lists";
import {
  normalizeReplyText,
  extractPhoneNumber,
  parseFollowupReplyAnswers,
} from "@/lib/messaging/reply";
import {
  findProfileByPhone,
  expireAlertsForUser,
} from "@/lib/alerts";
import { getDailyFollowupItemsForUser, storeFollowupAnswersForUser } from "@/lib/followups";
import { buildRateLimitHeaders, consumeRateLimit } from "@/lib/request-controls";

// POST /api/messaging/reply
//
// Inbound SMS webhook — receives replies from Plivo or Twilio.
//
// Plivo sends form data: Text, From, To
// Twilio sends form data: Body, From, To
//
// The route:
// 1. Extracts From + message text from form data
// 2. Normalizes the reply to stop / unknown
// 3. Looks up the user by phone number
// 4. On stop    → opts user out, expires pending alerts
// 5. Non-stop replies are informational only; SMS no longer confirms/queues applications
// 6. Returns 200 (Plivo: empty body, Twilio: TwiML <Response/>)

function twiml(body: string): NextResponse {
  return new NextResponse(`<Response>${body}</Response>`, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

function emptyOk(): NextResponse {
  return new NextResponse(null, { status: 200 });
}

function detectProvider(req: NextRequest): "plivo" | "twilio" {
  // Twilio sets X-Twilio-Signature; Plivo does not
  return req.headers.get("x-twilio-signature") ? "twilio" : "plivo";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let formData: FormData;

  try {
    formData = await req.formData();
  } catch {
    return new NextResponse(null, { status: 200 });
  }

  const provider = detectProvider(req);

  const rawFrom = formData.get(provider === "twilio" ? "From" : "From")?.toString() ?? "";
  const rawText = formData.get(provider === "twilio" ? "Body" : "Text")?.toString() ?? "";

  if (!rawFrom || !rawText) {
    return emptyOk();
  }

  const fromPhone = extractPhoneNumber(rawFrom);
  const action = normalizeReplyText(rawText);

  const supabase = getSupabaseAdminClient();
  const untypedSupabase = getSupabaseAdminClientUntyped();

  const rateLimit = await consumeRateLimit(supabase, {
    scope: "messaging_reply",
    subject: `phone:${fromPhone}`,
    windowSeconds: 300,
    limit: 12,
  }).catch(() => null);

  if (rateLimit && !rateLimit.allowed) {
    return provider === "twilio"
      ? new NextResponse("<Response></Response>", {
          status: 429,
          headers: {
            "Content-Type": "text/xml",
            ...buildRateLimitHeaders(rateLimit),
          },
        })
      : NextResponse.json(
          { error: "Rate limit exceeded for inbound messaging" },
          { status: 429, headers: buildRateLimitHeaders(rateLimit) }
        );
  }

  const profile = await findProfileByPhone(supabase, fromPhone).catch(() => null);

  if (!profile) {
    // Unknown sender — ignore
    return provider === "twilio" ? twiml("") : emptyOk();
  }

  if (action === "stop") {
    await supabase
      .from("profiles")
      .update({ sms_opt_in: false })
      .eq("id", profile.id);

    await expireAlertsForUser(supabase, profile.id).catch(() => null);

    // Digest mode: cancel any active prospective lists so cutoff doesn't queue anything.
    const { data: activeLists } = await untypedSupabase
      .from("prospective_lists")
      .select("id")
      .eq("user_id", profile.id)
      .eq("status", "sent");

    const listIds = (activeLists ?? []).map((l: any) => l.id as string);
    if (listIds.length > 0) {
      await untypedSupabase
        .from("prospective_list_items")
        .update({ user_decision: "skip" })
        .in("list_id", listIds);

      await untypedSupabase
        .from("prospective_lists")
        .update({ status: "finalized" })
        .in("id", listIds);
    }

    if (provider === "twilio") {
      return twiml(
        "<Message>You've been unsubscribed from Twin alerts. Reply START to re-enable.</Message>"
      );
    }
    return emptyOk();
  }

  if (action === "unknown") {
    const followupItems = await getDailyFollowupItemsForUser(
      supabase,
      profile.id,
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    ).catch(() => []);
    const parsedAnswers = parseFollowupReplyAnswers(rawText);

    if (followupItems.length > 0 && parsedAnswers.length > 0) {
      const stored = await storeFollowupAnswersForUser(
        supabase,
        profile,
        followupItems,
        parsedAnswers
      ).catch(() => ({ stored: false, count: 0 }));

      if (stored.stored) {
        if (provider === "twilio") {
          return twiml(
            `<Message>Saved ${stored.count} follow-up answer${stored.count === 1 ? "" : "s"}. Twin will use them before the next submit attempt.</Message>`
          );
        }
        return emptyOk();
      }
    }
  }

  // unknown reply
  if (provider === "twilio") {
    return twiml(
      "<Message>Twin SMS is updates-only. Open your dashboard to manage applications, or reply STOP to pause alerts.</Message>"
    );
  }
  return emptyOk();
}
