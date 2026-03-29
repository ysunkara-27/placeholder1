import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeReplyText, extractPhoneNumber } from "@/lib/messaging/reply";
import {
  findProfileByPhone,
  findLatestPendingAlert,
  confirmAlert,
  skipAlert,
  expireAlertsForUser,
} from "@/lib/alerts";
import { queueApplication } from "@/lib/application-queue";
import { mapProfileRowToPersistedProfile } from "@/lib/platform/profile";
import { mapPersistedProfileToApplicantDraft } from "@/lib/platform/applicant";

// POST /api/messaging/reply
//
// Inbound SMS webhook — receives replies from Plivo or Twilio.
//
// Plivo sends form data: Text, From, To
// Twilio sends form data: Body, From, To
//
// The route:
// 1. Extracts From + message text from form data
// 2. Normalizes the reply to confirm / skip / stop / unknown
// 3. Looks up the user by phone number
// 4. On confirm → marks latest pending alert confirmed, queues application
// 5. On skip    → marks alert skipped
// 6. On stop    → opts user out, expires pending alerts
// 7. Returns 200 (Plivo: empty body, Twilio: TwiML <Response/>)

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

    if (provider === "twilio") {
      return twiml(
        "<Message>You've been unsubscribed from Twin alerts. Reply START to re-enable.</Message>"
      );
    }
    return emptyOk();
  }

  const alert = await findLatestPendingAlert(supabase, profile.id).catch(() => null);

  if (!alert) {
    return provider === "twilio" ? twiml("") : emptyOk();
  }

  if (action === "confirm") {
    await confirmAlert(supabase, alert.id).catch(() => null);

    // Fetch job to build request payload
    const { data: job } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", alert.job_id)
      .single();

    if (job) {
      const persistedProfile = mapProfileRowToPersistedProfile(profile);
      const applicantDraft = mapPersistedProfileToApplicantDraft(persistedProfile);

      await queueApplication(supabase, {
        userId: profile.id,
        jobId: job.id,
        requestPayload: {
          url: job.application_url,
          profile: applicantDraft,
        },
      }).catch((err) => {
        console.error("[messaging/reply][queue-application]", err);
      });
    }

    if (provider === "twilio") {
      return twiml("<Message>Got it! Your Twin is on it.</Message>");
    }
    return emptyOk();
  }

  if (action === "skip") {
    await skipAlert(supabase, alert.id).catch(() => null);

    if (provider === "twilio") {
      return twiml("<Message>Skipped. We'll keep looking.</Message>");
    }
    return emptyOk();
  }

  // unknown reply
  if (provider === "twilio") {
    return twiml(
      "<Message>Reply YES to apply, NO to skip, or STOP to pause alerts.</Message>"
    );
  }
  return emptyOk();
}
