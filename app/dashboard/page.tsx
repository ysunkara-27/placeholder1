"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { BlockersSummary } from "@/components/dashboard/blockers-summary";
import { FollowupsSummary } from "@/components/dashboard/followups-summary";
import { RecoverySummary } from "@/components/dashboard/recovery-summary";
import { TwinStats } from "@/components/dashboard/twin-stats";
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

type SystemStateTone = "green" | "amber" | "blue" | "orange" | "red" | "slate";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<PersistedProfile | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [resume, setResume] = useState<AnnotatedResume | null>(null);
  const [applications, setApplications] = useState<DashboardApplicationRecord[]>([]);
  const [applyRuns, setApplyRuns] = useState<ApplyRunRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
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
  const pendingAlerts = alerts.filter((alert) => alert.status === "pending").length;
  const matchedJobs = alerts.length;
  const latestActivityAt = [
    alerts[0]?.alerted_at,
    applications[0]?.updated_at,
    applyRuns[0]?.created_at,
  ]
    .filter(Boolean)
    .sort()
    .at(-1);

  const systemStates: Array<{
    label: string;
    value: string;
    tone: SystemStateTone;
    description: string;
  }> = [
    queuedApplications > 0
      ? {
          label: "Queue",
          value: `${queuedApplications} active`,
          tone: "blue",
          description: "Twin is working through confirmed applications.",
        }
      : {
          label: "Queue",
          value: "Idle",
          tone: "slate",
          description: "No application jobs are running right now.",
        },
    pendingAlerts > 0
      ? {
          label: "Approval",
          value: `${pendingAlerts} waiting`,
          tone: "amber",
          description: "New matches are waiting on a yes before apply.",
        }
      : {
          label: "Approval",
          value: "Clear",
          tone: "green",
          description: "No confirmations are waiting right now.",
        },
    authBlockedApplications > 0
      ? {
          label: "Portal access",
          value: `${authBlockedApplications} blocked`,
          tone: "orange",
          description: "A portal sign-in or auth wall needs attention.",
        }
      : failedRuns > 0
        ? {
            label: "Portal access",
            value: `${failedRuns} failed`,
            tone: "red",
            description: "Some runs failed and need review before retrying.",
          }
        : {
            label: "Portal access",
            value: "Healthy",
            tone: "green",
            description: "No portal blockers detected in recent runs.",
          },
  ];

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <span className="text-lg font-semibold tracking-tight text-gray-900">
            Twin
          </span>
          <div className="flex items-center gap-4">
            <Link
              href="/onboarding"
              className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              Edit profile
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        {/* Twin status */}
        <div className="space-y-3">
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

          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Your Twin is live{profile.name ? `, ${profile.name.split(" ")[0]}` : ""}.
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              Monitoring profile
              {profile.industries.length > 0 && ` · ${profile.industries.length} industr${profile.industries.length === 1 ? "y" : "ies"}`}
              {queuedApplications > 0 && ` · ${queuedApplications} queued`}
              {appliedRuns > 0 && ` · ${appliedRuns} submitted`}
              {locationDisplay && ` · ${locationDisplay}`}
            </span>
          </div>

          {/* Animated shimmer bar */}
          <div className="h-1 w-full rounded-full bg-indigo-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-indigo-600 to-indigo-400"
              style={{
                backgroundSize: "200% 100%",
                animation: "shimmer 2s linear infinite",
              }}
            />
          </div>

          <style jsx>{`
            @keyframes shimmer {
              0%   { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
          `}</style>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {systemStates.map((state) => (
            <SystemStateCard
              key={state.label}
              label={state.label}
              value={state.value}
              tone={state.tone}
              description={state.description}
            />
          ))}
        </div>

        {/* Stats */}
        <TwinStats
          applied={appliedRuns}
          pending={pendingAlerts + queuedApplications}
          matched={matchedJobs}
        />

        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Apply readiness
              </h2>
              <p className="mt-1 text-xs text-gray-400">
                High-value profile fields that reduce blocked submissions.
              </p>
            </div>
            <Link
              href="/onboarding"
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
            >
              Complete profile →
            </Link>
          </div>
          <p className="text-sm text-gray-600">
            {readinessIssues.length === 0
              ? "Profile looks ready for common autofill flows."
              : `${readinessIssues.length} fields still weaken automated coverage.`}
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {portalReadiness.map((summary) => (
              <div
                key={summary.portal}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
              >
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-gray-500">
                  {summary.portal}
                </p>
                <p className="mt-1 text-sm text-gray-700">
                  {summary.risk_level}
                  {" · "}
                  {summary.likely_issue_count} likely
                </p>
                <p className="mt-1 text-[11px] text-gray-500 line-clamp-2">
                  {summary.likely_issues.length > 0
                    ? summary.likely_issues.map((issue) => issue.label).join(", ")
                    : "No likely blockers surfaced"}
                </p>
                {summary.historical_issue_count > 0 ? (
                  <p className="mt-1 text-[11px] text-amber-700 line-clamp-2">
                    Recent runs reinforce:{" "}
                    {summary.historical_issues.map((issue) => issue.label).join(", ")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            {readinessCounts.contact} contact · {readinessCounts.resume} resume ·{" "}
            {readinessCounts.authorization} auth · {readinessCounts.education} education ·{" "}
            {readinessCounts.availability} availability · {readinessCounts.eeo} eeo
          </p>
          {readinessIssues.length > 0 ? (
            <p className="text-xs text-gray-500">
              Missing: {readinessIssues.map((issue) => issue.label).join(", ")}
            </p>
          ) : null}
        </div>

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
                Matches your Twin found. Reply YES via SMS or click to apply.
              </p>
            </div>
          </div>
          <AlertsList alerts={alerts} />
        </div>

        {/* Applications */}
        <div className="space-y-3">
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

        {/* Settings summary */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">
              Twin settings
            </h2>
            <Link
              href="/onboarding"
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

function SystemStateCard({
  label,
  value,
  tone,
  description,
}: {
  label: string;
  value: string;
  tone: SystemStateTone;
  description: string;
}) {
  const toneStyles: Record<typeof tone, string> = {
    green: "border-green-200 bg-green-50 text-green-900",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    blue: "border-blue-200 bg-blue-50 text-blue-950",
    orange: "border-orange-200 bg-orange-50 text-orange-950",
    red: "border-red-200 bg-red-50 text-red-900",
    slate: "border-gray-200 bg-white text-gray-900",
  };

  const dotStyles: Record<typeof tone, string> = {
    green: "bg-green-500",
    amber: "bg-amber-500",
    blue: "bg-blue-500",
    orange: "bg-orange-500",
    red: "bg-red-500",
    slate: "bg-gray-400",
  };

  return (
    <div className={`rounded-2xl border px-5 py-4 ${toneStyles[tone]}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dotStyles[tone]}`} />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">
          {label}
        </p>
      </div>
      <p className="mt-3 text-xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-sm opacity-80">{description}</p>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  pending:   "bg-amber-50 text-amber-700 border-amber-200",
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
          {alert.job?.application_url && alert.status === "pending" && (
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
