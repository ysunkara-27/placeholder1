"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { BlockersSummary } from "@/components/dashboard/blockers-summary";
import { FollowupsSummary } from "@/components/dashboard/followups-summary";
import { RecoverySummary } from "@/components/dashboard/recovery-summary";
import { FollowupAnswersEditor } from "@/components/dashboard/followup-answers-editor";
import { NotificationScheduleCard } from "@/components/dashboard/notification-schedule-card";
import {
  ApplicationsList,
  type DashboardApplicationRecord,
} from "@/components/dashboard/applications-list";
import {
  ApplyRunsList,
  type ApplyRunRecord,
} from "@/components/dashboard/apply-runs-list";
import {
  LiveApplicationPanel,
  type LiveApplication,
} from "@/components/dashboard/live-application-panel";
import { PortalAccountsCard } from "@/components/dashboard/portal-accounts-card";
import type { AnnotatedResume } from "@/lib/types";

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
import { INDUSTRY_OPTIONS, LEVEL_OPTIONS } from "@/lib/utils";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mapPersistedProfileToApplicantDraft } from "@/lib/platform/applicant";
import {
  buildPortalApplyReadinessSummary,
  getApplyReadinessIssues,
  summarizeReadinessBuckets,
} from "@/lib/platform/apply-readiness";
import {
  extractResumeFromProfileRow,
  mapProfileRowToPersistedProfile,
  type ProfileRow,
  type PersistedProfile,
} from "@/lib/platform/profile";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<PersistedProfile | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [resume, setResume] = useState<AnnotatedResume | null>(null);
  const [applications, setApplications] = useState<DashboardApplicationRecord[]>([]);
  const [applyRuns, setApplyRuns] = useState<ApplyRunRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [liveApplication, setLiveApplication] = useState<LiveApplication | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [ready, setReady] = useState(false);

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

      setUserEmail(session.user.email ?? "");
      setIsAnonymous(Boolean((session.user as { is_anonymous?: boolean }).is_anonymous));

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const profileRow = data as ProfileRow | null;

      if (!profileRow?.onboarding_completed) {
        router.replace("/onboarding");
        return;
      }

      if (!active) {
        return;
      }

      setProfile(mapProfileRowToPersistedProfile(profileRow));
      setResume(extractResumeFromProfileRow(profileRow));

      // Show the page immediately — runs/applications load in parallel below
      if (active) setReady(true);

      const [runsResponse, applicationsResponse, alertsResponse] = await Promise.all([
        fetch("/api/apply/runs", { cache: "no-store" }),
        fetch("/api/applications/recent", { cache: "no-store" }),
        fetch("/api/alerts/recent", { cache: "no-store" }),
      ]);

      if (!active) return;

      if (runsResponse.ok) {
        const runsPayload = await runsResponse.json();
        setApplyRuns(runsPayload.runs ?? []);
      }

      if (applicationsResponse.ok) {
        const applicationsPayload = await applicationsResponse.json();
        setApplications(applicationsPayload.applications ?? []);
      }

      if (alertsResponse.ok) {
        const alertsPayload = await alertsResponse.json();
        setAlerts(alertsPayload.alerts ?? []);
      }
    } catch {
      router.replace("/onboarding");
      return;
    }
    }

    void loadDashboard();

    return () => {
      active = false;
    };
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

      // Fetch initial live application (running or awaiting confirmation)
      const { data } = await supabaseClient
        .from("applications")
        .select("id, status, log_events, preview_screenshot, job:jobs(company, title, application_url)")
        .eq("user_id", userId)
        .in("status", ["running", "awaiting_confirmation"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) setLiveApplication(data as unknown as LiveApplication);

      // Subscribe to real-time changes
      channel = supabaseClient
        .channel(`live-app-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "applications",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const row = payload.new as Record<string, unknown>;
            const status = String(row?.status ?? "");
            if (status === "running" || status === "awaiting_confirmation") {
              setLiveApplication({
                id: String(row.id ?? ""),
                status,
                log_events: (row.log_events as LiveApplication["log_events"]) ?? null,
                preview_screenshot: (row.preview_screenshot as string | null) ?? null,
                job: null, // enriched on initial fetch only
              });
            } else {
              // Job finished — clear the panel
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

  // Compute resume stats
  const totalBullets =
    resume?.experience.reduce((n, e) => n + e.bullets.length, 0) ?? 0;
  const lockedBullets =
    resume?.experience.reduce(
      (n, e) => n + e.bullets.filter((b) => b.lock === "locked").length,
      0
    ) ?? 0;
  const flexibleBullets = totalBullets - lockedBullets;
  const appliedRuns = applications.filter(
    (application) => application.status === "applied"
  ).length;
  const queuedApplications = applications.filter(
    (application) =>
      application.status === "queued" || application.status === "running"
  ).length;
  const failedRuns = applications.filter(
    (application) => application.status === "failed"
  ).length;
  const authBlockedApplications = applications.filter(
    (application) => application.status === "requires_auth"
  ).length;
  const pendingAlerts = alerts.filter((alert) => alert.status === "pending" || alert.status === "sent").length;
  const matchedJobs = alerts.length;
  const latestActivityAt = [
    alerts[0]?.alerted_at,
    applications[0]?.updated_at,
    applyRuns[0]?.created_at,
  ]
    .filter(Boolean)
    .sort()
    .at(-1);

  const industryLabels = profile.industries
    .map((v) => INDUSTRY_OPTIONS.find((o) => o.value === v)?.label ?? v)
    .join(", ");

  const levelLabels = profile.levels
    .map((v) => LEVEL_OPTIONS.find((o) => o.value === v)?.label ?? v)
    .join(", ");

  const locationDisplay = [
    ...profile.locations,
    ...(profile.remote_ok ? ["Remote"] : []),
  ].join(", ") || "Flexible";
  const applicantDraft = mapPersistedProfileToApplicantDraft(
    profile,
    userEmail
  );
  const readinessIssues = getApplyReadinessIssues(applicantDraft);
  const readinessCounts = summarizeReadinessBuckets(readinessIssues);
  const portalReadiness = [
    buildPortalApplyReadinessSummary(applicantDraft, "greenhouse", applyRuns),
    buildPortalApplyReadinessSummary(applicantDraft, "lever", applyRuns),
    buildPortalApplyReadinessSummary(applicantDraft, "workday", applyRuns),
  ];
  const topBlockedFamilies = Array.from(
    applyRuns.reduce<
      Map<
        string,
        {
          family: string;
          count: number;
          automationCount: number;
          profileDataCount: number;
          mixedCount: number;
        }
      >
    >((accumulator, run) => {
      const family = run.summary?.blocked_field_family;
      if (!family || family === "unknown") {
        return accumulator;
      }

      const current = accumulator.get(family) ?? {
        family,
        count: 0,
        automationCount: 0,
        profileDataCount: 0,
        mixedCount: 0,
      };

      current.count += 1;
      if (run.summary?.failure_source === "automation") {
        current.automationCount += 1;
      } else if (run.summary?.failure_source === "profile_data") {
        current.profileDataCount += 1;
      } else if (run.summary?.failure_source === "mixed") {
        current.mixedCount += 1;
      }

      accumulator.set(family, current);
      return accumulator;
    }, new Map())
  )
    .map((entry) => entry[1])
    .sort((left, right) => right.count - left.count)
    .slice(0, 4);
  const topRecoveryPatterns = Array.from(
    applyRuns.reduce<
      Map<
        string,
        {
          key: string;
          portal: string;
          family: string;
          count: number;
          appliedCount: number;
          failedCount: number;
          authCount: number;
        }
      >
    >((accumulator, run) => {
      if (!run.summary?.recovery_attempted || !run.summary.recovery_family || !run.portal) {
        return accumulator;
      }

      const key = `${run.portal}:${run.summary.recovery_family}`;
      const current = accumulator.get(key) ?? {
        key,
        portal: run.portal,
        family: run.summary.recovery_family,
        count: 0,
        appliedCount: 0,
        failedCount: 0,
        authCount: 0,
      };

      current.count += 1;
      if (run.status === "applied") {
        current.appliedCount += 1;
      } else if (run.status === "requires_auth") {
        current.authCount += 1;
      } else {
        current.failedCount += 1;
      }

      accumulator.set(key, current);
      return accumulator;
    }, new Map())
  )
    .map((entry) => entry[1])
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);

  // ── Profile completion fields ──────────────────────────────────────────────
  const PROFILE_FIELDS: Array<{
    label: string;
    filled: boolean;
    reason: string;
    step: string;
  }> = [
    { label: "Email", filled: !!userEmail, reason: "Required on every application form", step: "step 1" },
    { label: "Phone", filled: !!profile.phone, reason: "SMS alerts + required on many portals", step: "step 1 → Personal" },
    { label: "LinkedIn URL", filled: !!profile.linkedin_url, reason: "Some portals make this required, not optional", step: "step 1 → Personal" },
    { label: "Resume PDF", filled: !!profile.resume_url, reason: "No resume file = application blocked immediately", step: "step 4 → Resume" },
    { label: "Cover letter", filled: !!((profile as any).cover_letter_template), reason: "Portals that require a cover letter will skip it otherwise", step: "step 4 → Resume" },
    { label: "School", filled: !!profile.school, reason: "Greenhouse and Workday pull this for the education section", step: "step 2 → Education" },
    { label: "Graduation date", filled: !!profile.graduation, reason: "90% of ATS forms ask for this in the education section", step: "step 2 → Education" },
    { label: "Start date", filled: !!profile.earliest_start_date, reason: "'When can you start?' is asked on every form", step: "step 2 → Education" },
    { label: "Hours/week", filled: !!((profile as any).weekly_availability_hours), reason: "Co-op and part-time portals require this in the availability section", step: "step 2 → Education" },
    { label: "Work authorization", filled: !!profile.visa_type, reason: "ITAR and export control questions need this to auto-answer", step: "step 2 → Education" },
    { label: "EEO data", filled: !!(profile.eeo?.gender), reason: "Optional but pre-fills diversity sections — most portals ask", step: "step 5 → Extras" },
  ];
  const filledCount = PROFILE_FIELDS.filter((f) => f.filled).length;
  const missingFields = PROFILE_FIELDS.filter((f) => !f.filled);

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
      reviewHref: "#applications",
      reviewLabel: "Open queue review",
    })),
    ...applications.slice(0, 5).map((ap) => ({
      id: `app-${ap.id}`,
      ts: ap.updated_at,
      icon:
        ap.status === "applied"
          ? "✅"
          : ap.status === "failed"
          ? "❌"
          : ap.status === "requires_auth"
          ? "🔒"
          : ap.status === "running"
          ? "⚙️"
          : "📋",
      label:
        ap.status === "applied"
          ? `Applied — ${ap.job?.title ?? "Unknown"} @ ${ap.job?.company ?? ""}`
          : ap.status === "failed"
          ? `Blocked — ${ap.job?.title ?? ""} (${ap.last_error?.slice(0, 40) ?? "error"})`
          : ap.status === "requires_auth"
          ? `Auth wall — ${ap.job?.title ?? ""}`
          : ap.status === "running"
          ? `Applying — ${ap.job?.title ?? ""}`
          : `Queued — ${ap.job?.title ?? ""}`,
      sub: `${ap.job?.company ?? ""}${ap.last_error ? ` · ${ap.last_error.slice(0, 60)}` : ""}`,
      eta: estimateApplicationEta(ap.status),
      tone: (
        ap.status === "applied"
          ? "green"
          : ap.status === "failed" || ap.status === "requires_auth"
          ? "red"
          : ap.status === "running"
          ? "blue"
          : "gray"
      ) as FeedItem["tone"],
      postingUrl: ap.job?.url ?? null,
      reviewHref: "#applications",
      reviewLabel:
        ap.status === "queued" || ap.status === "running" || ap.status === "failed" || ap.status === "requires_auth"
          ? "Open verification"
          : "Open applications",
    })),
  ]
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    .slice(0, 8);

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        {isAnonymous && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-950">
                Your session is temporary
              </p>
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

        {/* Live application panel — shown while Twin is filling a form */}
        {liveApplication && (
          <LiveApplicationPanel application={liveApplication} />
        )}

        {/* Pipeline hero */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                {profile.name ? `Hey ${profile.name.split(" ")[0]}.` : "Your Twin is live."}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Watching job boards {profile.industries.length > 0
                  ? `for ${profile.industries.slice(0, 2).join(", ")}${profile.industries.length > 2 ? ` +${profile.industries.length - 2}` : ""}`
                  : "across all industries"}.
              </p>
            </div>
            <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${queuedApplications > 0 ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${queuedApplications > 0 ? "bg-blue-500 animate-pulse" : "bg-green-500"}`} />
              {queuedApplications > 0 ? `${queuedApplications} applying now` : "Monitoring"}
            </div>
          </div>

          {/* 4-stage pipeline */}
          <div className="grid grid-cols-4 gap-px bg-gray-100 rounded-xl overflow-hidden">
            {[
              { label: "In database", value: "—", sub: "jobs tracked", color: "text-gray-900" },
              { label: "Matched you", value: matchedJobs.toString(), sub: "alerts created", color: "text-indigo-700" },
              { label: "Queued", value: queuedApplications.toString(), sub: "applying now", color: queuedApplications > 0 ? "text-blue-700" : "text-gray-400" },
              { label: "Applied", value: appliedRuns.toString(), sub: "submitted", color: appliedRuns > 0 ? "text-green-700" : "text-gray-400" },
            ].map((stage, i) => (
              <div key={i} className="bg-white px-4 py-4">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{stage.label}</p>
                <p className={`mt-1 text-2xl font-bold tabular-nums ${stage.color}`}>{stage.value}</p>
                <p className="mt-0.5 text-[11px] text-gray-400">{stage.sub}</p>
              </div>
            ))}
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

        {/* Profile completion card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Profile completeness</h2>
              <p className="mt-0.5 text-xs text-gray-400">
                {filledCount === PROFILE_FIELDS.length
                  ? "All fields filled — your Twin can handle the full application range."
                  : `${filledCount} of ${PROFILE_FIELDS.length} fields filled. Missing fields cause blocked applications.`}
              </p>
            </div>
            <Link href="/profile" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
              Edit profile →
            </Link>
          </div>

          {/* Progress bar */}
          <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${(filledCount / PROFILE_FIELDS.length) * 100}%` }}
            />
          </div>

          {/* Field grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PROFILE_FIELDS.map((field) => (
              <div
                key={field.label}
                className={`flex items-start gap-2 rounded-lg px-3 py-2 ${field.filled ? "bg-gray-50" : "bg-red-50 border border-red-100"}`}
              >
                <span className={`mt-0.5 text-sm shrink-0 ${field.filled ? "text-green-500" : "text-red-400"}`}>
                  {field.filled ? "✓" : "✗"}
                </span>
                <div className="min-w-0">
                  <p className={`text-xs font-medium truncate ${field.filled ? "text-gray-700" : "text-red-700"}`}>{field.label}</p>
                  {!field.filled && (
                    <p className="text-[10px] text-red-500 mt-0.5 leading-tight">{field.reason}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {missingFields.length === 0 && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              <span className="font-semibold">One thing only runs can reveal:</span>{" "}
              When Twin hits a question it can&apos;t answer on a specific portal (e.g. &quot;Describe your leadership style&quot;), it adds it to the Follow-ups section below. Review those after your first runs.
            </div>
          )}
        </div>

        {/* Activity feed */}
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

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Top blockers
              </h2>
              <p className="mt-1 text-xs text-gray-400">
                Repeated failure families from recent runs.
              </p>
            </div>
          </div>
          <BlockersSummary blockers={topBlockedFamilies} />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Recovery patterns
              </h2>
              <p className="mt-1 text-xs text-gray-400">
                Which retry families Twin is using most, and whether they recover the run.
              </p>
            </div>
          </div>
          <RecoverySummary recoveries={topRecoveryPatterns} />
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  Pending follow-ups
                </h2>
                <p className="mt-1 text-xs text-gray-400">
                  Required application questions Twin still needs a user answer for before submit.
                </p>
              </div>
            </div>
            <FollowupsSummary runs={applyRuns} />
          </div>

        <NotificationScheduleCard
          shortlistTimeLocal={
            (profile as any).daily_digest_shortlist_time_local ??
            (profile as any).daily_digest_time_local ??
            "18:00"
          }
          cutoffTimeLocal={
            (profile as any).daily_digest_cutoff_time_local ?? "19:00"
          }
          goalSubmitTimeLocal={
            (profile as any).daily_digest_goal_submit_time_local ?? "21:00"
          }
          timezone={(profile as any).daily_digest_timezone ?? "UTC"}
        />

          <FollowupAnswersEditor
            initialAnswers={
              (profile.gray_areas?.follow_up_answers as Record<string, string> | undefined) ?? {}
            }
          />
        </div>

        {/* Alerts */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Job alerts</h2>
              <p className="mt-0.5 text-xs text-gray-400">
                Matches your Twin found. SMS now sends updates only; queue applications from the dashboard.
              </p>
            </div>
          </div>
          <AlertsList alerts={alerts} />
        </div>

        {/* Applications */}
        <div id="applications" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">
              Recent applications
            </h2>
          </div>
          <ApplicationsList applications={applications} />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Recent apply runs
              </h2>
              <p className="mt-1 text-xs text-gray-400">
                Planner and submit activity captured from the apply engine.
              </p>
            </div>
            <Link
              href="/apply-lab"
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
            >
              Open lab →
            </Link>
          </div>
          <ApplyRunsList runs={applyRuns} />
        </div>

        <PortalAccountsCard />

        {/* Settings summary */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">
              Twin settings
            </h2>
            <Link
              href="/profile"
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
            >
              Edit →
            </Link>
          </div>

          <div className="grid gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 sm:grid-cols-3">
            <SettingRow
              label="Last activity"
              value={latestActivityAt ? formatShortDateTime(latestActivityAt) : "No activity yet"}
            />
            <SettingRow
              label="Notifications"
              value={profile.phone ? "SMS + dashboard" : "Dashboard only"}
            />
            <SettingRow
              label="Session"
              value={isAnonymous ? "Temporary" : "Saved account"}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SettingRow label="Industries" value={industryLabels || "—"} />
            <SettingRow label="Role type" value={levelLabels || "—"} />
            <SettingRow label="Locations" value={locationDisplay} />
            {profile.gray_areas && (
              <SettingRow
                label="Expected pay"
                value={
                  profile.gray_areas.salary_unit === "hourly"
                    ? `$${profile.gray_areas.salary_min}–$${profile.gray_areas.salary_max}/hr`
                    : `$${Math.round(profile.gray_areas.salary_min / 1000)}K–$${Math.round(profile.gray_areas.salary_max / 1000)}K/yr`
                }
              />
            )}
            {profile.gray_areas && (
              <SettingRow
                label="Visa sponsorship"
                value={profile.gray_areas.sponsorship_required ? "Required" : "Not required"}
              />
            )}
            {resume && (
              <SettingRow
                label="Resume"
                value={`${lockedBullets} bullet${lockedBullets !== 1 ? "s" : ""} locked · ${flexibleBullets} flexible · ${resume.skills.length} skills`}
              />
            )}
          </div>
        </div>
      </main>
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

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
        {label}
      </p>
      <p className="text-sm text-gray-800">{value}</p>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  pending:   "bg-amber-50 text-amber-700 border-amber-200",
  sent:      "bg-sky-50 text-sky-700 border-sky-200",
  confirmed: "bg-indigo-50 text-indigo-700 border-indigo-200",
  skipped:   "bg-gray-100 text-gray-500 border-gray-200",
  expired:   "bg-gray-100 text-gray-400 border-gray-200",
  applied:   "bg-green-50 text-green-700 border-green-200",
  failed:    "bg-red-50 text-red-600 border-red-200",
};

function AlertsList({ alerts }: { alerts: AlertRecord[] }) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-10 text-center space-y-2">
        <div className="flex justify-center">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-500 text-lg">
            📡
          </span>
        </div>
        <p className="text-sm font-medium text-gray-700">Scanning job boards…</p>
        <p className="text-xs text-gray-400">
          Your Twin will alert you here the moment a match drops.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="rounded-xl border border-gray-200 bg-white px-4 py-3 flex items-center gap-4"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {alert.job?.title ?? "—"} @ {alert.job?.company ?? "—"}
              </p>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[alert.status] ?? "bg-gray-100 text-gray-500 border-gray-200"}`}
              >
                {alert.status}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {alert.job?.location ?? ""}
              {alert.job?.remote ? " · Remote" : ""}
              {" · "}
              {new Date(alert.alerted_at).toLocaleDateString("en-US", {
                month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
              })}
            </p>
          </div>
          {alert.job?.application_url && (alert.status === "pending" || alert.status === "sent") && (
            <a
              href={alert.job.application_url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              Apply →
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
