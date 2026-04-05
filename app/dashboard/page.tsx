"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { type DashboardApplicationRecord } from "@/components/dashboard/applications-list";
import { type ApplyRunRecord } from "@/components/dashboard/apply-runs-list";
import {
  LiveApplicationPanel,
  type LiveApplication,
} from "@/components/dashboard/live-application-panel";
import { QueuedJobsPopup } from "@/components/dashboard/queued-jobs-popup";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  mapProfileRowToPersistedProfile,
  type ProfileRow,
  type PersistedProfile,
} from "@/lib/platform/profile";

export interface AlertRecord {
  id: string;
  status: string;
  alerted_at: string;
  replied_at: string | null;
  job: {
    company: string;
    title: string;
    location: string;
    level: string;
    remote: boolean;
    application_url: string;
  } | null;
}

interface AppliedApplication {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  job: {
    id: string;
    company: string;
    title: string;
    location: string | null;
    level: string | null;
    portal: string | null;
    remote: boolean | null;
    posted_at: string | null;
    url: string | null;
  } | null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<PersistedProfile | null>(null);
  const [applications, setApplications] = useState<DashboardApplicationRecord[]>([]);
  const [appliedApplications, setAppliedApplications] = useState<AppliedApplication[]>([]);
  const [applyRuns, setApplyRuns] = useState<ApplyRunRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [liveApplication, setLiveApplication] = useState<LiveApplication | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [ready, setReady] = useState(false);

  // Pipeline stats
  const [needsAttentionCount, setNeedsAttentionCount] = useState(0);
  const [appliedCount, setAppliedCount] = useState(0);
  const [newListingsCount, setNewListingsCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user.id) {
          router.replace("/onboarding");
          return;
        }

        setIsAnonymous(Boolean((session.user as { is_anonymous?: boolean }).is_anonymous));

        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle();

        if (error) throw error;

        const profileRow = data as ProfileRow | null;
        if (!profileRow?.onboarding_completed) {
          router.replace("/onboarding");
          return;
        }

        if (!active) return;

        setProfile(mapProfileRowToPersistedProfile(profileRow));
        if (active) setReady(true);

        // Load counts + activity data in parallel
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const [
          needsAttentionRes,
          appliedRes,
          newListingsRes,
          runsResponse,
          applicationsResponse,
          appliedApplicationsResponse,
          alertsResponse,
        ] = await Promise.all([
          // Needs attention: failed + requires_auth
          supabase
            .from("applications")
            .select("*", { count: "exact", head: true })
            .eq("user_id", session.user.id)
            .in("status", ["failed", "requires_auth"]),
          // Applied count
          supabase
            .from("applications")
            .select("*", { count: "exact", head: true })
            .eq("user_id", session.user.id)
            .eq("status", "applied"),
          // New listings in last 7 days
          supabase
            .from("jobs")
            .select("*", { count: "exact", head: true })
            .eq("status", "active")
            .gte("created_at", sevenDaysAgo),
          // Activity data
          fetch("/api/apply/runs", { cache: "no-store" }),
          fetch("/api/applications/recent", { cache: "no-store" }),
          fetch("/api/applications/applied?page=1", { cache: "no-store" }),
          fetch("/api/alerts/recent", { cache: "no-store" }),
        ]);

        if (!active) return;

        setNeedsAttentionCount(needsAttentionRes.count ?? 0);
        setAppliedCount(appliedRes.count ?? 0);
        setNewListingsCount(newListingsRes.count ?? 0);

        if ((runsResponse as Response).ok) {
          const runsPayload = await (runsResponse as Response).json();
          setApplyRuns(runsPayload.runs ?? []);
        }

        if ((applicationsResponse as Response).ok) {
          const applicationsPayload = await (applicationsResponse as Response).json();
          setApplications(applicationsPayload.applications ?? []);
        }

        if ((appliedApplicationsResponse as Response).ok) {
          const appliedPayload = await (appliedApplicationsResponse as Response).json();
          setAppliedApplications(appliedPayload.applications ?? []);
        }

        if ((alertsResponse as Response).ok) {
          const alertsPayload = await (alertsResponse as Response).json();
          setAlerts(alertsPayload.alerts ?? []);
        }
      } catch {
        router.replace("/onboarding");
      }
    }

    void loadDashboard();
    return () => { active = false; };
  }, [router]);

  // ── Real-time subscription for live application visibility ─────────────────
  useEffect(() => {
    type SupabaseClient = ReturnType<typeof getSupabaseBrowserClient>;
    let channel: ReturnType<SupabaseClient["channel"]> | null = null;

    async function subscribe() {
      const supabaseClient = getSupabaseBrowserClient();
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session?.user.id) return;
      const userId = session.user.id;

      const { data } = await supabaseClient
        .from("applications")
        .select("id, status, log_events, preview_screenshot, job:jobs(company, title, application_url)")
        .eq("user_id", userId)
        .in("status", ["running", "awaiting_confirmation"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) setLiveApplication(data as unknown as LiveApplication);

      channel = supabaseClient
        .channel(`live-app-${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "applications", filter: `user_id=eq.${userId}` },
          (payload) => {
            const row = payload.new as Record<string, unknown>;
            const status = String(row?.status ?? "");
            if (status === "running" || status === "awaiting_confirmation") {
              setLiveApplication({
                id: String(row.id ?? ""),
                status,
                log_events: (row.log_events as LiveApplication["log_events"]) ?? null,
                preview_screenshot: (row.preview_screenshot as string | null) ?? null,
                job: null,
              });
            } else {
              setLiveApplication((prev) =>
                prev?.id === String(row.id ?? "") ? null : prev
              );
            }
          }
        )
        .subscribe();
    }

    void subscribe();
    return () => {
      if (channel) void (channel as { unsubscribe(): Promise<unknown> }).unsubscribe();
    };
  }, []);

  if (!ready || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="h-8 w-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
      </div>
    );
  }

  const queuedApplications = applications.filter(
    (a) => a.status === "queued" || a.status === "running"
  );
  const matchedJobs = alerts.length;

  // ── Unified activity feed ──────────────────────────────────────────────────
  type FeedItem = {
    id: string;
    ts: string;
    icon: string;
    label: string;
    sub: string;
    eta: string | null;
    tone: "green" | "amber" | "red" | "blue" | "gray";
    postingUrl?: string | null;
    reviewHref?: string | null;
    reviewLabel?: string | null;
  };

  function estimateApplicationEta(status: string) {
    if (status === "queued") return "~5-15 min remaining";
    if (status === "running") return "~1-5 min remaining";
    if (status === "requires_auth") return "Needs your input";
    if (status === "failed") return "Blocked until fixed";
    if (status === "applied") return "Completed";
    return null;
  }

  const activityFeed: FeedItem[] = [
    ...alerts.slice(0, 5).map((a) => ({
      id: `alert-${a.id}`,
      ts: a.alerted_at,
      icon: a.status === "applied" ? "✅" : a.status === "skipped" || a.status === "expired" ? "⏭️" : "🔔",
      label:
        a.status === "applied"
          ? `Applied — ${a.job?.title ?? "Unknown"} @ ${a.job?.company ?? ""}`
          : a.status === "skipped"
          ? `Skipped — ${a.job?.title ?? ""}`
          : `Match found — ${a.job?.title ?? "Unknown"} @ ${a.job?.company ?? ""}`,
      sub: a.job?.company ?? "",
      eta: a.status === "pending" || a.status === "sent" ? "Ready for review" : null,
      tone: (a.status === "applied" ? "green" : a.status === "pending" || a.status === "sent" ? "amber" : "gray") as FeedItem["tone"],
      postingUrl: a.job?.application_url ?? null,
      reviewHref: "/apply-lab",
      reviewLabel: "Open apply lab",
    })),
    ...applyRuns.slice(0, 5).map((run) => ({
      id: `run-${run.id}`,
      ts: run.created_at,
      icon:
        run.status === "applied" ? "✅"
        : run.status === "failed" ? "❌"
        : run.status === "requires_auth" ? "🔒"
        : run.status === "running" ? "⚙️"
        : "📋",
      label:
        run.status === "applied" ? `Applied run — ${run.portal ?? "unknown portal"}`
        : run.status === "failed" ? `Blocked run — ${run.portal ?? "unknown portal"}`
        : run.status === "requires_auth" ? `Auth wall — ${run.portal ?? "unknown portal"}`
        : run.status === "running" ? `Applying — ${run.portal ?? "unknown portal"}`
        : `Queued run — ${run.portal ?? "unknown portal"}`,
      sub: `${run.url}${run.error ? ` · ${run.error.slice(0, 60)}` : ""}`,
      eta: estimateApplicationEta(run.status),
      tone: (
        run.status === "applied" ? "green"
        : run.status === "failed" || run.status === "requires_auth" ? "red"
        : run.status === "running" ? "blue"
        : "gray"
      ) as FeedItem["tone"],
      postingUrl: run.url ?? null,
      reviewHref: "/apply-lab",
      reviewLabel:
        run.status === "queued" || run.status === "running" || run.status === "failed" || run.status === "requires_auth"
          ? "Open verification"
          : "Open apply lab",
    })),
  ]
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    .slice(0, 8);

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        {isAnonymous && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-950">Your session is temporary</p>
              <p className="mt-1 text-sm text-amber-800">
                Save this Twin with Google or email before you switch devices.
              </p>
            </div>
            <Link
              href="/auth"
              className="inline-flex items-center justify-center rounded-full bg-amber-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-900"
            >
              Save account
            </Link>
          </div>
        )}

        {/* Live application panel */}
        {liveApplication && <LiveApplicationPanel application={liveApplication} />}

        {/* Pipeline hero */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                {profile.name ? `Hey ${profile.name.split(" ")[0]}.` : "Your Twin is live."}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Watching job boards{" "}
                {profile.industries.length > 0
                  ? `for ${profile.industries.slice(0, 2).join(", ")}${profile.industries.length > 2 ? ` +${profile.industries.length - 2}` : ""}`
                  : "across all industries"}.
              </p>
            </div>
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                queuedApplications.length > 0 ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  queuedApplications.length > 0 ? "bg-blue-500 animate-pulse" : "bg-green-500"
                }`}
              />
              {queuedApplications.length > 0
                ? `${queuedApplications.length} applying now`
                : "Monitoring"}
            </div>
          </div>

          {/* 4-stage pipeline */}
          <div className="grid grid-cols-4 gap-px bg-gray-100 rounded-xl overflow-hidden">
            {/* Needs attention */}
            <Link
              href="/apply-lab"
              className={`bg-white px-4 py-4 hover:bg-gray-50 transition-colors cursor-pointer ${needsAttentionCount > 0 ? "group" : ""}`}
            >
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Needs attention
              </p>
              <p
                className={`mt-1 text-2xl font-bold tabular-nums ${
                  needsAttentionCount > 0 ? "text-red-600" : "text-gray-400"
                }`}
              >
                {needsAttentionCount}
              </p>
              <p className="mt-0.5 text-[11px] text-gray-400">issues to fix</p>
            </Link>

            {/* New listings */}
            <Link
              href="/jobs"
              className="bg-white px-4 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                New listings
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-indigo-700">
                {newListingsCount === null ? "—" : newListingsCount}
              </p>
              <p className="mt-0.5 text-[11px] text-gray-400">added this week</p>
            </Link>

            {/* Matched jobs */}
            <div className="bg-white px-4 py-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Matched jobs
              </p>
              <p
                className={`mt-1 text-2xl font-bold tabular-nums ${
                  matchedJobs > 0 ? "text-indigo-700" : "text-gray-400"
                }`}
              >
                {matchedJobs}
              </p>
              <p className="mt-0.5 text-[11px] text-gray-400">alerts created</p>
            </div>

            {/* Applied */}
            <Link
              href="#applied-jobs"
              className="bg-white px-4 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Applied
              </p>
              <p
                className={`mt-1 text-2xl font-bold tabular-nums ${
                  appliedCount > 0 ? "text-green-700" : "text-gray-400"
                }`}
              >
                {appliedCount}
              </p>
              <p className="mt-0.5 text-[11px] text-gray-400">submitted</p>
            </Link>
          </div>

          {/* Shimmer bar */}
          <div className="h-0.5 w-full rounded-full bg-indigo-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-indigo-600 to-indigo-400"
              style={{ backgroundSize: "200% 100%", animation: "shimmer 2s linear infinite" }}
            />
          </div>
          <style jsx>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        </div>

        {/* Recent activity */}
        {activityFeed.length > 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-1">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Recent activity</h2>
            {activityFeed.map((item) => (
              <div key={item.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                <span className="text-base shrink-0 mt-0.5">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{item.label}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{item.sub}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {item.eta && (
                      <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600">
                        {item.eta}
                      </span>
                    )}
                    {item.reviewHref && item.reviewLabel && (
                      <a
                        href={item.reviewHref}
                        className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
                      >
                        {item.reviewLabel}
                      </a>
                    )}
                    {item.postingUrl && (
                      <a
                        href={item.postingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                      >
                        Open posting
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
                <span className="text-[11px] text-gray-400 shrink-0 whitespace-nowrap">
                  {formatShortDateTime(item.ts)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div id="applied-jobs" className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Applied jobs</h2>
              <p className="mt-1 text-xs text-gray-400">
                Submitted applications now live directly on the dashboard.
              </p>
            </div>
            {appliedCount > appliedApplications.length ? (
              <Link
                href="/applied"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                View all →
              </Link>
            ) : null}
          </div>

          {appliedApplications.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center">
              <p className="text-sm font-medium text-gray-700">No applied jobs yet</p>
              <p className="mt-1 text-xs text-gray-400">
                Submitted applications will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {appliedApplications.map((application) => (
                <div
                  key={application.id}
                  className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {application.job?.title ?? "—"}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {application.job?.company ?? "—"}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                      {application.job?.location && <span>{application.job.location}</span>}
                      {application.job?.remote && <span>Remote</span>}
                      {application.job?.level && <span className="capitalize">{application.job.level}</span>}
                      {application.job?.portal && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium uppercase tracking-wide text-gray-500">
                          {application.job.portal}
                        </span>
                      )}
                      <span>{formatDate(application.completed_at ?? application.updated_at)}</span>
                    </div>
                  </div>
                  {application.job?.url && (
                    <a
                      href={application.job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 transition-colors"
                    >
                      View
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Queued jobs popup — bottom right */}
      <QueuedJobsPopup applications={applications} />
    </div>
  );
}

function formatShortDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
