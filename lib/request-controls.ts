import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: string;
};

export function getRequestIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return "unknown";
}

export function hashFingerprint(input: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
}

export async function consumeRateLimit(
  supabase: SupabaseClient<Database>,
  input: {
    scope: string;
    subject: string;
    windowSeconds: number;
    limit: number;
  }
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc("consume_rate_limit", {
    p_scope: input.scope,
    p_subject: input.subject,
    p_window_seconds: input.windowSeconds,
    p_limit: input.limit,
  });

  if (error) {
    throw error;
  }

  const row = data?.[0];
  return {
    allowed: Boolean(row?.allowed),
    remaining: typeof row?.remaining === "number" ? row.remaining : 0,
    resetAt:
      typeof row?.reset_at === "string"
        ? row.reset_at
        : new Date(Date.now() + input.windowSeconds * 1000).toISOString(),
  };
}

export function buildRateLimitHeaders(result: RateLimitResult) {
  return {
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": result.resetAt,
  };
}
