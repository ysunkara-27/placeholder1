"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { formatPostedAt, cn } from "@/lib/utils";
import {
  buildUrlApplyReadinessSummary,
  summarizeReadinessBuckets,
} from "@/lib/platform/apply-readiness";

export interface DashboardApplicationRecord {
  id: string;
  status: string;
  queue_status: string;
  request_payload: unknown;
  attempt_count: number;
  created_at: string;
  updated_at: string;
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
  confirmation_text: string | null;
  last_error: string | null;
  job: {
    id: string;
    company: string;
    title: string;
    location: string;
    posted_at: string;
    level: string;
    portal: string | null;
    remote: boolean;
    industries: string[];
    jd_summary: string | null;
    url: string;
  };
}

interface Props {
  applications: DashboardApplicationRecord[];
}

interface ApplicantDraftLike {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  website?: string;
  github?: string;
  resume_pdf_path?: string;
  sponsorship_required?: boolean;
  work_authorization?: string;
  school?: string;
  major?: string;
  graduation?: string;
  city?: string;
  state_region?: string;
  country?: string;
}

const STATUS_STYLES: Record<string, { dot: string; label: string; text: string; surface: string }> = {
  applied:   { dot: "bg-green-500", label: "Applied", text: "text-green-700", surface: "bg-green-50" },
  queued:    { dot: "bg-amber-400", label: "Queued", text: "text-amber-700", surface: "bg-amber-50" },
  running:   { dot: "bg-blue-500", label: "Running", text: "text-blue-700", surface: "bg-blue-50" },
  requires_auth: { dot: "bg-indigo-500", label: "Auth needed", text: "text-indigo-700", surface: "bg-indigo-50" },
  skipped:   { dot: "bg-gray-300", label: "Skipped", text: "text-gray-500", surface: "bg-gray-100" },
  expired:   { dot: "bg-gray-200", label: "Expired", text: "text-gray-400", surface: "bg-gray-100" },
  failed:    { dot: "bg-red-400", label: "Failed", text: "text-red-600", surface: "bg-red-50" },
} as const;

function getRequestProfile(application: DashboardApplicationRecord): ApplicantDraftLike | null {
  if (
    application.request_payload &&
    typeof application.request_payload === "object" &&
    "profile" in application.request_payload &&
    application.request_payload.profile &&
    typeof application.request_payload.profile === "object"
  ) {
    return application.request_payload.profile as ApplicantDraftLike;
  }

  return null;
}

function VerificationPane({
  application,
  onTrustApply,
  trusting,
  trustError,
}: {
  application: DashboardApplicationRecord;
  onTrustApply: (applicationId: string) => Promise<void>;
  trusting: boolean;
  trustError: string | null;
}) {
  const requestProfile = getRequestProfile(application);
  const readiness = useMemo(() => {
    if (!requestProfile) return null;

    const profile = {
      first_name: requestProfile.first_name ?? "",
      last_name: requestProfile.last_name ?? "",
      email: requestProfile.email ?? "",
      phone: requestProfile.phone ?? "",
      linkedin: requestProfile.linkedin ?? "",
      website: requestProfile.website ?? "",
      github: requestProfile.github ?? "",
      resume_pdf_path: requestProfile.resume_pdf_path ?? "",
      sponsorship_required: Boolean(requestProfile.sponsorship_required),
      work_authorization: requestProfile.work_authorization ?? "",
      start_date: "",
      location_preference: "",
      salary_expectation: "",
      onsite_preference: "",
      weekly_availability_hours: "",
      graduation_window: requestProfile.graduation ?? "",
      commute_preference: "",
      city: requestProfile.city ?? "",
      state_region: requestProfile.state_region ?? "",
      country: requestProfile.country ?? "United States",
      school: requestProfile.school ?? "",
      major: requestProfile.major ?? "",
      gpa: "",
      graduation: requestProfile.graduation ?? "",
      visa_type: "",
      eeo: {},
      custom_answers: {},
    };

    return buildUrlApplyReadinessSummary(profile, application.job.url);
  }, [application.job.url, requestProfile]);

  const bucketCounts = summarizeReadinessBuckets(readiness?.issues ?? []);
  const canTrustApply = application.status === "queued";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-indigo-500">
            Verification
          </p>
          <h3 className="mt-1 text-lg font-semibold text-gray-900">
            {application.job.title}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {application.job.company}
            {application.job.location ? ` · ${application.job.location}` : ""}
            {application.job.remote ? " · Remote" : ""}
          </p>
        </div>
        <a
          href={application.job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors"
        >
          Open posting
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <InfoCard label="Portal" value={application.job.portal ?? "Unknown"} />
        <InfoCard label="Level" value={application.job.level} />
        <InfoCard label="Queued" value={new Date(application.queued_at).toLocaleString()} />
        <InfoCard label="Last update" value={new Date(application.updated_at).toLocaleString()} />
      </div>

      {application.job.jd_summary && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-400">
            Job Summary
          </p>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            {application.job.jd_summary}
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-400">
            Application Card
          </p>
          <div className="space-y-2">
            <FieldRow label="Applicant" value={`${requestProfile?.first_name ?? ""} ${requestProfile?.last_name ?? ""}`.trim() || "Missing"} />
            <FieldRow label="Email" value={requestProfile?.email || "Missing"} />
            <FieldRow label="Phone" value={requestProfile?.phone || "Missing"} />
            <FieldRow label="Resume" value={requestProfile?.resume_pdf_path ? "Attached" : "Missing"} />
            <FieldRow label="School" value={requestProfile?.school || "Missing"} />
            <FieldRow label="Major" value={requestProfile?.major || "Missing"} />
            <FieldRow label="Graduation" value={requestProfile?.graduation || "Missing"} />
            <FieldRow
              label="Work authorization"
              value={requestProfile?.work_authorization || (requestProfile?.sponsorship_required ? "Needs sponsorship" : "Missing")}
            />
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-indigo-500" />
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-400">
              Verification Side
            </p>
          </div>
          {readiness ? (
            <>
              <p className={cn(
                "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                readiness.risk_level === "blocked"
                  ? "bg-red-50 text-red-700"
                  : readiness.risk_level === "risky"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-green-50 text-green-700"
              )}>
                {readiness.risk_level === "blocked"
                  ? "Blocked before submit"
                  : readiness.risk_level === "risky"
                  ? "Review recommended"
                  : "Ready to submit"}
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <MiniStat label="Contact" value={String(bucketCounts.contact)} />
                <MiniStat label="Resume" value={String(bucketCounts.resume)} />
                <MiniStat label="Auth" value={String(bucketCounts.authorization)} />
              </div>
              <div className="space-y-2">
                {readiness.critical_issues.length > 0 ? (
                  readiness.critical_issues.slice(0, 4).map((issue) => (
                    <p key={`${issue.bucket}-${issue.field}`} className="text-xs text-red-600">
                      {issue.label}
                    </p>
                  ))
                ) : (
                  <p className="text-xs text-gray-500">
                    No critical blockers detected from the saved application payload.
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-500">
              Verification summary unavailable for this application payload.
            </p>
          )}

          <div className="border-t border-gray-100 pt-3 space-y-3">
            <button
              type="button"
              onClick={() => onTrustApply(application.id)}
              disabled={!canTrustApply || trusting}
              className={cn(
                "w-full rounded-xl px-4 py-3 text-sm font-semibold transition-colors",
                !canTrustApply || trusting
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-indigo-600 text-white hover:bg-indigo-700"
              )}
            >
              {trusting ? "Submitting…" : canTrustApply ? "Trust Apply" : "Already in progress"}
            </button>
            <p className="text-xs text-gray-500">
              Open this verification pane when you want to inspect the application first. If you trust Twin, submit directly without reviewing every field.
            </p>
            {trustError && (
              <p className="text-xs text-red-600">{trustError}</p>
            )}
            {application.last_error && application.status === "failed" && (
              <p className="text-xs text-red-600">{application.last_error}</p>
            )}
            {application.confirmation_text && application.status === "applied" && (
              <p className="text-xs text-green-700">{application.confirmation_text}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ApplicationsList({ applications }: Props) {
  const reviewable = applications.filter((application) =>
    ["queued", "running", "requires_auth", "failed", "applied"].includes(application.status)
  );
  const [selectedId, setSelectedId] = useState<string | null>(reviewable[0]?.id ?? null);
  const [trustingId, setTrustingId] = useState<string | null>(null);
  const [trustError, setTrustError] = useState<string | null>(null);
  const selectedApplication =
    reviewable.find((application) => application.id === selectedId) ?? reviewable[0] ?? null;

  async function handleTrustApply(applicationId: string) {
    setTrustingId(applicationId);
    setTrustError(null);

    try {
      const response = await fetch(`/api/applications/${applicationId}/trust-apply`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to trust apply queued application");
      }

      window.location.reload();
    } catch (error) {
      setTrustError(error instanceof Error ? error.message : "Failed to trust apply queued application");
    } finally {
      setTrustingId(null);
    }
  }

  if (applications.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-900">Queue Review</h3>
          <p className="mt-1 text-xs text-gray-400">
            Pick any queued application to inspect it side-by-side before submit.
          </p>
        </div>
        <div className="divide-y divide-gray-100">
          {applications.map((application) => {
            const style = STATUS_STYLES[application.status] ?? {
              dot: "bg-gray-300",
              label: application.status.replaceAll("_", " "),
              text: "text-gray-600",
              surface: "bg-gray-100",
            };
            const isSelected = selectedApplication?.id === application.id;
            return (
              <button
                key={application.id}
                type="button"
                onClick={() => setSelectedId(application.id)}
                className={cn(
                  "w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors",
                  isSelected && "bg-indigo-50/60"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-500">
                    {application.job.company.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {application.job.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {application.job.company}
                      {application.job.location && ` · ${application.job.location}`}
                    </p>
                    {(application.confirmation_text || application.last_error) && (
                      <p className="mt-1 text-xs text-gray-400 truncate">
                        {application.confirmation_text ?? application.last_error}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-400">
                      {formatPostedAt(application.updated_at)}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                        style.text,
                        style.surface
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
                      {style.label}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedApplication ? (
        <VerificationPane
          application={selectedApplication}
          onTrustApply={handleTrustApply}
          trusting={trustingId === selectedApplication.id}
          trustError={trustError}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-gray-700">No reviewable applications selected.</p>
          <p className="mt-1 text-xs text-gray-400">
            Queue a job first, then select it here to review or trust apply.
          </p>
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">
        {label}
      </p>
      <p className="mt-1 text-sm text-gray-700">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.16em] text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-800">{value}</p>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-2 last:border-b-0 last:pb-0">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-400">
        {label}
      </p>
      <p className="max-w-[60%] text-right text-sm text-gray-700">{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-6 py-14 flex flex-col items-center gap-5 text-center">
      <div className="relative flex items-center justify-center">
        <span className="absolute h-16 w-16 rounded-full border-2 border-indigo-200 animate-ping opacity-40" />
        <span
          className="absolute h-12 w-12 rounded-full border-2 border-indigo-300 animate-ping opacity-30"
          style={{ animationDelay: "0.3s" }}
        />
        <div className="relative h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
          AA
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-semibold text-gray-900">No applications yet</p>
        <p className="text-sm text-gray-400 max-w-xs">
          Queued, blocked, and submitted application attempts show up here once Twin starts working through matches.
        </p>
      </div>

      <Link
        href="/apply-lab"
        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium underline underline-offset-2 transition-colors"
      >
        Open apply lab →
      </Link>
    </div>
  );
}
