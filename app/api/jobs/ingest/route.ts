import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { createAlert, sendAlertSms } from "@/lib/alerts";
import { selectCandidateProfileIdsForJob } from "@/lib/candidate-routing";
import { getApplyQueueEnv } from "@/lib/env";
import {
  parseJobIngestPayload,
  upsertJobFromIngestPayload,
} from "@/lib/job-ingest";
import { matchJobToProfile } from "@/lib/matching";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

function readWorkerSecret(req: NextRequest) {
  const authorization = req.headers.get("authorization");

  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  return req.headers.get("x-twin-worker-secret")?.trim() ?? "";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { workerSecret } = getApplyQueueEnv();
    const requestSecret = readWorkerSecret(request);

    if (!workerSecret || requestSecret !== workerSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = parseJobIngestPayload(await request.json());
    const supabase = getSupabaseAdminClient();
    const upsertedJob = await upsertJobFromIngestPayload(supabase, payload);

    const candidateProfileIds = await selectCandidateProfileIdsForJob(
      supabase,
      upsertedJob
    );

    const { data: profiles, error: profilesError } =
      candidateProfileIds.length === 0
        ? { data: [], error: null }
        : await supabase
            .from("profiles")
            .select("*")
            .in("id", candidateProfileIds);

    if (profilesError) {
      throw profilesError;
    }

    const results: Array<{
      userId: string;
      score: number;
      matched: boolean;
      alerted: boolean;
      smsSent: boolean;
      reasons: string[];
      rejections: string[];
    }> = [];

    for (const profile of (profiles ?? []) as ProfileRow[]) {
      const match = matchJobToProfile(upsertedJob, profile);

      if (!match.matched) {
        results.push({
          userId: profile.id,
          score: match.score,
          matched: false,
          alerted: false,
          smsSent: false,
          reasons: match.reasons,
          rejections: match.rejections,
        });
        continue;
      }

      let alertId: string;

      const dailyDigestEnabled = Boolean((profile as any).daily_digest_enabled);
      if (dailyDigestEnabled) {
        // Digest mode: don't send per-job alerts; the daily shortlist cron builds
        // prospective lists directly from matching jobs.
        results.push({
          userId: profile.id,
          score: match.score,
          matched: true,
          alerted: false,
          smsSent: false,
          reasons: match.reasons,
          rejections: [],
        });
        continue;
      }

      try {
        const alert = await createAlert(supabase, profile.id, upsertedJob.id);
        alertId = alert.id;
      } catch (error) {
        console.error("[jobs/ingest][create-alert]", error);
        results.push({
          userId: profile.id,
          score: match.score,
          matched: true,
          alerted: false,
          smsSent: false,
          reasons: match.reasons,
          rejections: [],
        });
        continue;
      }

      let smsSent = false;
      if (profile.sms_opt_in && profile.phone) {
        const smsResult = await sendAlertSms(supabase, alertId);
        smsSent = smsResult.sent;
      }

      results.push({
        userId: profile.id,
        score: match.score,
        matched: true,
        alerted: true,
        smsSent,
        reasons: match.reasons,
        rejections: [],
      });
    }

    return NextResponse.json({
      job: {
        id: upsertedJob.id,
        company: upsertedJob.company,
        title: upsertedJob.title,
        portal: upsertedJob.portal,
        url: upsertedJob.url,
      },
      profilesChecked: results.length,
      candidateProfiles: candidateProfileIds.length,
      alertsCreated: results.filter((result) => result.alerted).length,
      smsSent: results.filter((result) => result.smsSent).length,
      results,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid job ingest payload",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 422 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to ingest job";

    console.error("[jobs/ingest]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
