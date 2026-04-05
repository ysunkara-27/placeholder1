"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApplicationsList,
  type DashboardApplicationRecord,
} from "@/components/dashboard/applications-list";

interface ApplyRunRecord {
  id: string;
  mode: string;
  portal: string | null;
  status: string;
  url: string;
  error: string | null;
  created_at: string;
  summary?: {
    stage: string;
    actions: {
      total: number;
      required: number;
      optional: number;
      by_type: Record<string, number>;
    };
    screenshot_count: number;
    latest_screenshot_label: string | null;
    blocked_step: string | null;
    blocked_field_family:
      | "contact"
      | "resume"
      | "authorization"
      | "education"
      | "availability"
      | "eeo"
      | "custom"
      | "unknown"
      | null;
    failure_source: "profile_data" | "automation" | "mixed" | "unknown" | null;
    missing_profile_fields: string[];
    inferred_answers_count: number;
    inferred_answers: string[];
    error_kind: "none" | "auth" | "validation" | "execution";
    recovery_attempted: boolean;
    recovery_family:
      | "contact"
      | "resume"
      | "authorization"
      | "education"
      | "availability"
      | "eeo"
      | "custom"
      | "unknown"
      | null;
  } | null;
}

export function ApplyLab() {
  const [recentRuns, setRecentRuns] = useState<ApplyRunRecord[]>([]);
  const [recentApplications, setRecentApplications] = useState<
    DashboardApplicationRecord[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadLabData = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    try {
      if (mode === "initial") {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const [runsResponse, applicationsResponse] = await Promise.all([
        fetch("/api/apply/runs", { cache: "no-store" }),
        fetch("/api/applications/recent", { cache: "no-store" }),
      ]);

      if (runsResponse.ok) {
        const runsPayload = await runsResponse.json();
        setRecentRuns(runsPayload.runs ?? []);
      } else if (mode === "initial") {
        setRecentRuns([]);
      }

      if (applicationsResponse.ok) {
        const applicationsPayload = await applicationsResponse.json();
        setRecentApplications(applicationsPayload.applications ?? []);
      } else if (mode === "initial") {
        setRecentApplications([]);
      }
    } catch {
      if (mode === "initial") {
        setRecentRuns([]);
        setRecentApplications([]);
      }
    } finally {
      if (mode === "initial") {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadLabData();
  }, [loadLabData]);

  const hasActiveQueue = useMemo(
    () =>
      recentApplications.some((application) =>
        ["queued", "running", "awaiting_confirmation"].includes(application.status)
      ),
    [recentApplications]
  );

  useEffect(() => {
    if (!hasActiveQueue) return;

    const interval = window.setInterval(() => {
      void loadLabData("refresh");
    }, 10000);

    return () => window.clearInterval(interval);
  }, [hasActiveQueue, loadLabData]);

  useEffect(() => {
    function handleFocus() {
      void loadLabData("refresh");
    }

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [loadLabData]);

  if (loading) {
    return (
      <div className="space-y-8">
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">
              Application Review
            </h2>
            <p className="mt-1 text-xs text-dim">
              Loading queued applications and verification data.
            </p>
          </div>
          <div className="rounded-[28px] border border-rim bg-white p-6 shadow-soft-card">
            <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="overflow-hidden rounded-l-xl rounded-r-none border border-r-0 border-rim bg-white xl:h-[calc(100vh-12rem)]">
                <div className="border-b border-rim/70 px-5 py-4">
                  <div className="h-3 w-28 rounded bg-surface" />
                  <div className="mt-3 h-6 w-40 rounded bg-accent/10" />
                  <div className="mt-2 h-3 w-56 rounded bg-surface" />
                </div>
                <div className="space-y-3 p-5">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="rounded-lg border border-rim/70 px-4 py-4"
                    >
                      <div className="h-4 w-48 rounded bg-accent/10" />
                      <div className="mt-2 h-3 w-32 rounded bg-surface" />
                      <div className="mt-3 h-3 w-24 rounded bg-surface" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="overflow-hidden rounded-r-xl rounded-l-none border border-rim bg-white xl:h-[calc(100vh-12rem)]">
                <div className="space-y-4 p-5">
                  <div className="h-3 w-32 rounded bg-surface" />
                  <div className="h-7 w-56 rounded bg-accent/10" />
                  <div className="h-4 w-48 rounded bg-surface" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="border border-rim/70 bg-surface px-4 py-3">
                        <div className="h-3 w-20 rounded bg-accent/10" />
                        <div className="mt-2 h-4 w-28 rounded bg-white" />
                      </div>
                    ))}
                  </div>
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="border border-rim/70 bg-surface p-4">
                      <div className="h-3 w-28 rounded bg-accent/10" />
                      <div className="mt-2 h-3 w-48 rounded bg-white" />
                      <div className="mt-4 h-24 rounded border border-rim/70 bg-white" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-rim bg-white p-5 shadow-soft-card">
          <h2 className="text-sm font-semibold text-ink">Recent Runs</h2>
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-xl border border-rim px-4 py-4">
                <div className="h-4 w-28 rounded bg-accent/10" />
                <div className="mt-3 h-4 w-44 rounded bg-surface" />
                <div className="mt-2 h-3 w-56 rounded bg-surface" />
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink">
              Application Review
            </h2>
            <p className="mt-1 text-xs text-dim">
              Select a queued or recent application on the left, then edit the
              exact payload field-by-field before you trust apply it.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadLabData("refresh")}
            disabled={refreshing}
            className="inline-flex items-center justify-center rounded-xl border border-rim bg-white px-3 py-2 text-xs font-semibold text-dim transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? "Refreshing…" : hasActiveQueue ? "Refresh live queue" : "Refresh"}
          </button>
        </div>
        <ApplicationsList applications={recentApplications} />
      </section>

      <section className="rounded-[28px] border border-rim bg-white p-5 shadow-soft-card">
        <h2 className="text-sm font-semibold text-ink">Recent Runs</h2>
        <div className="mt-4 space-y-3">
          {recentRuns.length === 0 && (
            <div className="rounded-xl border border-dashed border-rim bg-surface px-4 py-6 text-sm text-dim">
              No saved runs yet.
            </div>
          )}
          {recentRuns.map((run) => (
            <div
              key={run.id}
              className="rounded-xl border border-rim px-4 py-3 shadow-soft-card"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-dim">
                  {run.mode}
                </span>
                <span className="text-[11px] text-dim">
                  {new Date(run.created_at).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-ink">
                {run.portal ?? "unknown"} · {run.status}
              </p>
              <p className="mt-1 break-all text-xs text-dim">{run.url}</p>
              {run.summary && (
                <p className="mt-2 text-xs text-dim">
                  {run.summary.stage.replaceAll("_", " ")} · {run.summary.actions.total} actions
                  {" · "}
                  {run.summary.actions.required} required
                  {" · "}
                  {run.summary.actions.optional} optional
                  {" · "}
                  {run.summary.screenshot_count} screenshots
                  {" · "}
                  {run.summary.inferred_answers_count} inferred
                </p>
              )}
              {run.summary?.latest_screenshot_label && (
                <p className="mt-1 text-[11px] text-dim">
                  last frame: {run.summary.latest_screenshot_label.replaceAll("_", " ")}
                </p>
              )}
              {(run.summary?.blocked_step || run.summary?.blocked_field_family) && (
                <p className="mt-1 text-[11px] text-dim">
                  {run.summary.blocked_step
                    ? `blocked step: ${run.summary.blocked_step.replaceAll("_", " ")}`
                    : "blocked step: unknown"}
                  {run.summary.blocked_field_family
                    ? ` · family: ${run.summary.blocked_field_family.replaceAll("_", " ")}`
                    : ""}
                </p>
              )}
              {(run.summary?.failure_source || run.summary?.missing_profile_fields.length) && (
                <p className="mt-1 text-[11px] text-dim line-clamp-2">
                  {run.summary.failure_source
                    ? `source: ${run.summary.failure_source.replaceAll("_", " ")}`
                    : "source: unknown"}
                  {run.summary.missing_profile_fields.length
                    ? ` · missing: ${run.summary.missing_profile_fields.join(", ")}`
                    : ""}
                </p>
              )}
              {run.summary?.inferred_answers.length ? (
                <p className="mt-1 text-[11px] text-dim line-clamp-2">
                  inferred: {run.summary.inferred_answers.join(", ")}
                </p>
              ) : null}
              {run.summary?.recovery_attempted ? (
                <p className="mt-1 text-[11px] text-dim">
                  recovery: {run.summary.recovery_family?.replaceAll("_", " ") ?? "attempted"}
                </p>
              ) : null}
              {run.error && (
                <p className="mt-2 text-xs text-red-600">{run.error}</p>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
