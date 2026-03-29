"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TwinStats } from "@/components/dashboard/twin-stats";
import { ApplicationsList } from "@/components/dashboard/applications-list";
import type { AnnotatedResume, GrayAreaSuggestion, Industry, JobLevel } from "@/lib/types";
import { INDUSTRY_OPTIONS, LEVEL_OPTIONS } from "@/lib/utils";

// ─── Stored profile shape (what we wrote to localStorage) ────────────────────

interface StoredProfile {
  name: string;
  email: string;
  school: string;
  degree: string;
  graduation: string;
  gpa: string;
  industries: Industry[];
  levels: JobLevel[];
  locations: string[];
  remote_ok: boolean;
  gray_areas: GrayAreaSuggestion | null;
  phone: string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<StoredProfile | null>(null);
  const [resume, setResume] = useState<AnnotatedResume | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const rawProfile = localStorage.getItem("autoapply_profile_v2");
      const rawResume = localStorage.getItem("autoapply_resume_v2");

      if (!rawProfile) {
        router.replace("/onboarding");
        return;
      }

      const p: StoredProfile = JSON.parse(rawProfile);
      if (!p.name) {
        router.replace("/onboarding");
        return;
      }

      setProfile(p);
      if (rawResume) setResume(JSON.parse(rawResume));
    } catch {
      router.replace("/onboarding");
      return;
    }
    setReady(true);
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
            AutoApply
          </span>
          <div className="flex items-center gap-4">
            <Link
              href="/onboarding"
              className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              Edit profile
            </Link>
            <button className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        {/* Twin status */}
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Your Twin is live{profile.name ? `, ${profile.name.split(" ")[0]}` : ""}.
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              Monitoring 50+ boards
              {profile.industries.length > 0 && ` · ${profile.industries.length} industr${profile.industries.length === 1 ? "y" : "ies"}`}
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
        <TwinStats applied={0} pending={0} skipped={0} />

        {/* Applications */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">
              Recent applications
            </h2>
          </div>
          <ApplicationsList alerts={[]} />
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
