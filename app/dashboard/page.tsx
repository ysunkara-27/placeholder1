"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { TwinStats } from "@/components/dashboard/twin-stats";
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
  const [resume, setResume] = useState<AnnotatedResume | null>(null);
  const [applications, setApplications] = useState<DashboardApplicationRecord[]>([]);
  const [applyRuns, setApplyRuns] = useState<ApplyRunRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
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
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Your Twin is configured{profile.name ? `, ${profile.name.split(" ")[0]}` : ""}.
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              Profile ready
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

        {/* Stats */}
        <TwinStats
          applied={appliedRuns}
          queued={queuedApplications}
          failed={failedRuns}
        />

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
                Internal plan and submit attempts captured from the apply engine.
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
