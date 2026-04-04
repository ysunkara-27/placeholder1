"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  APPLY_LAB_BROWSER_JOBS_KEY,
  type ApplyLabBrowserJob,
} from "@/lib/jobs-board-storage";
import {
  mapProfileRowToPersistedProfile,
  type ProfileRow,
} from "@/lib/platform/profile";
import {
  mapPersistedProfileToApplicantDraft,
  type ApplicantProfileDraft,
} from "@/lib/platform/applicant";
import {
  buildUrlApplyReadinessSummary,
  getCriticalReadinessIssues,
  getApplyReadinessIssues,
  summarizeReadinessBuckets,
} from "@/lib/platform/apply-readiness";

type ApplyLabJob = ApplyLabBrowserJob;

interface ApplyPlanAction {
  action: "fill" | "click" | "select" | "upload" | "check" | "uncheck";
  selector: string;
  value: string;
  required: boolean;
}

interface QueueApplicationState {
  id: string;
  status: string;
  attempt_count: number;
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
  last_error: string | null;
  updated_at: string;
}

interface ApplyLabResult {
  mode: "plan" | "queue" | "process";
  portal:
    | "greenhouse"
    | "lever"
    | "workday"
    | "ashby"
    | "handshake"
    | "vision"
    | null;
  status: string;
  confirmation_snippet: string;
  actions: ApplyPlanAction[];
  error: string;
  screenshots: Array<{
    label: string;
    mime_type: string;
    data_base64: string;
  }>;
  inferred_answers: string[];
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
  message?: string;
  queued?: boolean;
  processed?: boolean;
  disposition?: string;
  application?: QueueApplicationState | null;
  saved?: boolean;
  run_id?: string | null;
  readiness?: {
    portal: string;
    risk_level: "ready" | "risky" | "blocked";
    ready: boolean;
    likely_issue_count: number;
    critical_issue_count: number;
    issue_count: number;
    bucket_counts: Record<string, number>;
    likely_bucket_counts: Record<string, number>;
    historical_issue_count: number;
    historical_bucket_counts: Record<string, number>;
    critical_issues: Array<{
      bucket: string;
      field: string;
      label: string;
    }>;
    likely_issues: Array<{
      bucket: string;
      field: string;
      label: string;
    }>;
    historical_issues: Array<{
      bucket: string;
      field: string;
      label: string;
    }>;
    issues: Array<{
      bucket: string;
      field: string;
      label: string;
    }>;
  };
}

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

const DEFAULT_PROFILE = {
  first_name: "Yash",
  last_name: "Patel",
  email: "yash@example.com",
  phone: "5550000000",
  linkedin: "https://linkedin.com/in/yashpatel",
  website: "",
  resume_pdf_path: "/tmp/resume.pdf",
  sponsorship_required: false,
  work_authorization: "US Citizen",
  start_date: "",
  location_preference: "",
  salary_expectation: "",
  onsite_preference: "",
  weekly_availability_hours: "",
  graduation_window: "",
  commute_preference: "",
  custom_answers: {},
};

export function ApplyLab() {
  const [browseJobs, setBrowseJobs] = useState<ApplyLabBrowserJob[]>([]);
  const allJobs: ApplyLabJob[] = useMemo(() => browseJobs, [browseJobs]);
  const [selectedUrl, setSelectedUrl] = useState("");
  const [profileJson, setProfileJson] = useState(
    JSON.stringify(DEFAULT_PROFILE, null, 2)
  );
  const [result, setResult] = useState<ApplyLabResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [recentRuns, setRecentRuns] = useState<ApplyRunRecord[]>([]);

  let readinessIssues = [] as ReturnType<typeof getApplyReadinessIssues>;
  let criticalReadinessIssues = [] as ReturnType<typeof getCriticalReadinessIssues>;
  let readinessCounts = summarizeReadinessBuckets([]);
  let portalReadiness: ApplyLabResult["readiness"] | null = null;

  try {
    const parsedProfile = JSON.parse(profileJson) as ApplicantProfileDraft;
    readinessIssues = getApplyReadinessIssues(parsedProfile);
    criticalReadinessIssues = getCriticalReadinessIssues(parsedProfile);
    readinessCounts = summarizeReadinessBuckets(readinessIssues);
    portalReadiness = buildUrlApplyReadinessSummary(parsedProfile, selectedUrl, recentRuns);
  } catch {
    readinessIssues = [];
    criticalReadinessIssues = [];
    readinessCounts = summarizeReadinessBuckets([]);
    portalReadiness = null;
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(APPLY_LAB_BROWSER_JOBS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as ApplyLabBrowserJob[];
      setBrowseJobs(saved);
      if (saved[0]?.apply_url) {
        setSelectedUrl((current) => current || saved[0].apply_url);
      }
    } catch {
      setBrowseJobs([]);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadSavedProfile() {
      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user.id) {
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

        if (!active || !profileRow?.onboarding_completed) {
          return;
        }

        const draft = mapPersistedProfileToApplicantDraft(
          mapProfileRowToPersistedProfile(profileRow),
          profileRow.email ?? ""
        );
        setProfileJson(JSON.stringify(draft, null, 2));
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? `Failed to load saved profile: ${err.message}`
              : "Failed to load saved profile"
          );
        }
      } finally {
        if (active) {
          setLoadingProfile(false);
        }
      }
    }

    void loadSavedProfile();

    return () => {
      active = false;
    };
  }, []);

  async function loadRuns() {
    try {
      const response = await fetch("/api/apply/runs", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        return;
      }

      setRecentRuns(payload.runs ?? []);
    } catch {
      setRecentRuns([]);
    }
  }

  useEffect(() => {
    void loadRuns();
  }, []);

  useEffect(() => {
    if (!selectedUrl && allJobs[0]?.apply_url) {
      setSelectedUrl(allJobs[0].apply_url);
    }
  }, [allJobs, selectedUrl]);

  function normalizeResult(
    mode: "plan" | "queue" | "process",
    payload: Record<string, unknown>
  ): ApplyLabResult {
    return {
      mode,
      portal:
        typeof payload.portal === "string"
          ? (payload.portal as ApplyLabResult["portal"])
          : null,
      status: typeof payload.status === "string" ? payload.status : "unknown",
      confirmation_snippet:
        typeof payload.confirmation_snippet === "string"
          ? payload.confirmation_snippet
          : "",
      actions: Array.isArray(payload.actions)
        ? (payload.actions as ApplyPlanAction[])
        : [],
      error: typeof payload.error === "string" ? payload.error : "",
      screenshots: Array.isArray(payload.screenshots)
        ? (payload.screenshots as ApplyLabResult["screenshots"])
        : [],
      inferred_answers: Array.isArray(payload.inferred_answers)
        ? (payload.inferred_answers as string[])
        : [],
      recovery_attempted:
        typeof payload.recovery_attempted === "boolean"
          ? payload.recovery_attempted
          : false,
      recovery_family:
        typeof payload.recovery_family === "string"
          ? (payload.recovery_family as ApplyLabResult["recovery_family"])
          : null,
      message: typeof payload.message === "string" ? payload.message : undefined,
      queued: typeof payload.queued === "boolean" ? payload.queued : undefined,
      processed:
        typeof payload.processed === "boolean" ? payload.processed : undefined,
      disposition:
        typeof payload.disposition === "string"
          ? payload.disposition
          : undefined,
      application:
        payload.application && typeof payload.application === "object"
          ? (payload.application as QueueApplicationState)
          : null,
      saved: typeof payload.saved === "boolean" ? payload.saved : undefined,
      run_id:
        typeof payload.run_id === "string"
          ? payload.run_id
          : typeof payload.runId === "string"
          ? payload.runId
          : null,
      readiness:
        payload.readiness && typeof payload.readiness === "object"
          ? (payload.readiness as ApplyLabResult["readiness"])
          : undefined,
    };
  }

  async function handleRequest(mode: "plan" | "queue" | "process") {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(
        mode === "plan"
          ? "/api/apply/plan"
          : mode === "queue"
          ? "/api/apply/submit"
          : "/api/apply/process-next",
        mode === "process"
          ? {
              method: "POST",
            }
          : {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: selectedUrl,
          profile: JSON.parse(profileJson),
        }),
            }
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error ??
            (mode === "plan"
              ? "Failed to plan apply run"
              : mode === "queue"
              ? "Failed to queue apply run"
              : "Failed to process queued application")
        );
      }

      setResult(normalizeResult(mode, payload as Record<string, unknown>));
      await loadRuns();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : mode === "plan"
          ? "Failed to plan apply run"
          : mode === "queue"
          ? "Failed to queue apply run"
          : "Failed to process queued application"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Queued Browse Jobs</h2>
          <div className="mt-4 space-y-3">
            {allJobs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                No jobs have been sent here yet. Add jobs from Browse Jobs, then
                return to Apply Lab to inspect or run them.
              </div>
            ) : null}
            {allJobs.map((job) => {
              return (
              <button
                key={job.id}
                onClick={() => setSelectedUrl(job.apply_url)}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  selectedUrl === job.apply_url
                    ? "border-indigo-300 bg-indigo-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-gray-900">{job.company}</p>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-gray-500">
                      {job.portal}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-sm text-gray-600">{job.title}</p>
                <p className="mt-1 text-xs text-gray-400">{job.location}</p>
              </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <Input
            label="Application URL"
            value={selectedUrl}
            onChange={(e) => setSelectedUrl(e.target.value)}
          />

          <Textarea
            className="mt-4 min-h-[260px] font-mono text-xs"
            label="Applicant Profile JSON"
            value={profileJson}
            onChange={(e) => setProfileJson(e.target.value)}
            hint={
              loadingProfile
                ? "Loading saved Twin profile..."
                : "This is sent to the internal apply engine proxy."
            }
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Button className="w-full" onClick={() => void handleRequest("plan")} loading={loading}>
              Run plan
            </Button>
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => void handleRequest("queue")}
              disabled={loading || criticalReadinessIssues.length > 0}
            >
              Queue apply
            </Button>
            <Button
              className="w-full"
              variant="ghost"
              onClick={() => void handleRequest("process")}
              disabled={loading}
            >
              Process next queued
            </Button>
          </div>

          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-500">
              Readiness
            </p>
            <p className="mt-2 text-sm text-gray-700">
              {readinessIssues.length === 0
                ? "Profile looks ready for common application flows."
                : `${readinessIssues.length} high-value fields are missing before apply.`}
            </p>
            {portalReadiness ? (
              <p className="mt-2 text-xs text-gray-600">
                {portalReadiness.portal} risk: {portalReadiness.risk_level}
                {" · "}
                {portalReadiness.likely_issue_count} likely blocker
                {portalReadiness.likely_issue_count === 1 ? "" : "s"}
                {" · "}
                {portalReadiness.historical_issue_count} history-weighted
              </p>
            ) : null}
            {criticalReadinessIssues.length > 0 ? (
              <p className="mt-2 text-xs font-medium text-amber-700">
                Queueing is blocked until critical fields are filled:{" "}
                {criticalReadinessIssues.map((issue) => issue.label).join(", ")}
              </p>
            ) : null}
            {portalReadiness && portalReadiness.risk_level === "risky" ? (
              <p className="mt-2 text-xs text-amber-700 line-clamp-2">
                Likely blockers for this {portalReadiness.portal} flow:{" "}
                {portalReadiness.likely_issues.map((issue) => issue.label).join(", ")}
              </p>
            ) : null}
            <p className="mt-1 text-[11px] text-gray-500">
              {readinessCounts.contact} contact · {readinessCounts.resume} resume ·{" "}
              {readinessCounts.authorization} auth · {readinessCounts.education} education ·{" "}
              {readinessCounts.availability} availability · {readinessCounts.eeo} eeo
            </p>
            {readinessIssues.length > 0 ? (
              <p className="mt-2 text-[11px] text-gray-500 line-clamp-3">
                Missing: {readinessIssues.map((issue) => issue.label).join(", ")}
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Recent Runs</h2>
          <div className="mt-4 space-y-3">
            {recentRuns.length === 0 && (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-400">
                No saved runs yet.
              </div>
            )}
            {recentRuns.map((run) => (
              <div
                key={run.id}
                className="rounded-xl border border-gray-200 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-gray-500">
                    {run.mode}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {new Date(run.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-gray-900">
                  {run.portal ?? "unknown"} · {run.status}
                </p>
                <p className="mt-1 break-all text-xs text-gray-500">{run.url}</p>
                {run.summary && (
                  <p className="mt-2 text-xs text-gray-500">
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
              <p className="mt-1 text-[11px] text-gray-400">
                last frame: {run.summary.latest_screenshot_label.replaceAll("_", " ")}
              </p>
            )}
            {(run.summary?.blocked_step || run.summary?.blocked_field_family) && (
              <p className="mt-1 text-[11px] text-gray-400">
                {run.summary.blocked_step
                  ? `blocked step: ${run.summary.blocked_step.replaceAll("_", " ")}`
                  : "blocked step: unknown"}
                {run.summary.blocked_field_family
                  ? ` · family: ${run.summary.blocked_field_family.replaceAll("_", " ")}`
                  : ""}
              </p>
            )}
            {(run.summary?.failure_source || run.summary?.missing_profile_fields.length) && (
              <p className="mt-1 text-[11px] text-gray-400 line-clamp-2">
                {run.summary.failure_source
                  ? `source: ${run.summary.failure_source.replaceAll("_", " ")}`
                  : "source: unknown"}
                {run.summary.missing_profile_fields.length
                  ? ` · missing: ${run.summary.missing_profile_fields.join(", ")}`
                  : ""}
              </p>
            )}
            {run.summary?.inferred_answers.length ? (
              <p className="mt-1 text-[11px] text-gray-400 line-clamp-2">
                inferred: {run.summary.inferred_answers.join(", ")}
              </p>
            ) : null}
            {run.summary?.recovery_attempted ? (
              <p className="mt-1 text-[11px] text-gray-400">
                recovery: {run.summary.recovery_family?.replaceAll("_", " ") ?? "attempted"}
              </p>
            ) : null}
            {run.error && (
              <p className="mt-2 text-xs text-red-600">{run.error}</p>
            )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Latest Result</h2>
            <p className="mt-1 text-xs text-gray-400">
              Inspect plans, queued submissions, and manual queue processing.
            </p>
          </div>
          {result && (
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
              {result.portal ?? "queue"} · {result.status}
            </span>
          )}
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!error && !result && (
          <div className="mt-8 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-14 text-center text-sm text-gray-400">
            Pick a seeded job and run a plan or queue it for execution.
          </div>
        )}

        {result && (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
              {result.mode === "plan"
                ? result.error
                  ? `Engine returned an error: ${result.error}`
                  : "No submission attempted. This is a deterministic dry-run plan."
                : result.mode === "queue"
                ? result.message ?? "Application queue request recorded."
                : result.processed
                ? result.error
                  ? `Queue worker finished with an error: ${result.error}`
                  : `Queue worker processed the next application with status ${result.status}.`
                : "No queued applications were ready to process."}
            </div>

            {(result.mode === "plan" || result.run_id || result.application) && (
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs text-gray-500">
                {result.mode === "plan" && <>Saved: {result.saved ? "yes" : "no"}</>}
                {result.run_id ? `${result.mode === "plan" ? " · " : ""}Run ID: ${result.run_id}` : ""}
                {result.application?.id
                  ? `${result.mode === "plan" || result.run_id ? " · " : ""}Application ID: ${result.application.id}`
                  : ""}
              </div>
            )}

            {(result.actions.length > 0 || result.screenshots.length > 0) && (
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs text-gray-500">
                {result.actions.length} actions ·{" "}
                {result.actions.filter((action) => action.required).length} required ·{" "}
                {result.actions.filter((action) => !action.required).length} optional
                {" · "}
                {result.screenshots.length} screenshots
                {" · "}
                {result.inferred_answers.length} inferred
                {result.recovery_attempted
                  ? ` · recovery ${result.recovery_family?.replaceAll("_", " ") ?? "attempted"}`
                  : ""}
              </div>
            )}

            {result.readiness && (
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs text-gray-500">
                {result.readiness.portal} · {result.readiness.risk_level}
                {" · "}
                {result.readiness.ready
                  ? "readiness clear"
                  : `${result.readiness.critical_issue_count} critical readiness issues`}
                {" · "}
                {result.readiness.issue_count} total issues
                {" · "}
                {result.readiness.likely_issue_count} likely
                {" · "}
                {result.readiness.historical_issue_count} historical
                {" · "}
                {result.readiness.bucket_counts.contact} contact
                {" · "}
                {result.readiness.bucket_counts.resume} resume
                {" · "}
                {result.readiness.bucket_counts.authorization} auth
                {" · "}
                {result.readiness.bucket_counts.education} education
                {" · "}
                {result.readiness.bucket_counts.availability} availability
                {" · "}
                {result.readiness.bucket_counts.eeo} eeo
                {result.readiness.critical_issues.length > 0
                  ? ` · critical: ${result.readiness.critical_issues
                      .map((issue) => issue.label)
                      .join(", ")}`
                  : ""}
                {result.readiness.likely_issues.length > 0
                  ? ` · likely: ${result.readiness.likely_issues
                      .map((issue) => issue.label)
                      .join(", ")}`
                  : ""}
              </div>
            )}

            {result.application && (
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs text-gray-500">
                {result.application.status} · attempt {Math.max(result.application.attempt_count, 1)}
                {" · "}
                queued {new Date(result.application.queued_at).toLocaleString()}
                {result.application.started_at
                  ? ` · started ${new Date(result.application.started_at).toLocaleString()}`
                  : ""}
                {result.application.completed_at
                  ? ` · completed ${new Date(result.application.completed_at).toLocaleString()}`
                  : ""}
                {result.application.last_error
                  ? ` · ${result.application.last_error}`
                  : ""}
              </div>
            )}

            {result.actions.length > 0 && (
              <div className="space-y-2">
              {result.actions.map((action, index) => (
                <div
                  key={`${action.selector}-${index}`}
                  className="rounded-xl border border-gray-200 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-gray-500">
                      {action.action}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                          action.required
                            ? "bg-red-50 text-red-600"
                            : "bg-emerald-50 text-emerald-600"
                        }`}
                      >
                        {action.required ? "required" : "optional"}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        Step {index + 1}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 font-mono text-xs text-gray-700">
                    {action.selector}
                  </p>
                  {action.value && (
                    <p className="mt-2 text-xs text-gray-500 break-all">
                      Value: {action.value}
                    </p>
                  )}
                </div>
              ))}
              </div>
            )}

            {result.screenshots.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Captured screenshots
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {result.screenshots.map((screenshot, index) => (
                    <div
                      key={`${screenshot.label}-${index}`}
                      className="rounded-xl border border-gray-200 bg-white p-3"
                    >
                      <p className="text-xs font-medium text-gray-700">
                        {screenshot.label.replaceAll("_", " ")}
                      </p>
                      <Image
                        className="mt-3 rounded-lg border border-gray-200"
                        src={`data:${screenshot.mime_type};base64,${screenshot.data_base64}`}
                        alt={screenshot.label}
                        width={800}
                        height={600}
                        unoptimized
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.inferred_answers.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-900">
                  Inferred answers
                </p>
                <p className="mt-2 text-sm text-amber-900">
                  {result.inferred_answers.join(", ")}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
