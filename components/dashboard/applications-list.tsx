"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, Save, ShieldCheck } from "lucide-react";
import { formatPostedAt, cn } from "@/lib/utils";
import { buildUrlApplyReadinessSummary } from "@/lib/platform/apply-readiness";

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

type JsonObject = Record<string, unknown>;

type RequestPayloadShape = {
  url?: string;
  profile?: Record<string, unknown>;
  runtime_hints?: Record<string, unknown>;
  [key: string]: unknown;
};

type DraftState = {
  url: string;
  profile: Record<string, string>;
  customAnswers: Record<string, string>;
  topLevelExtras: Record<string, string>;
};

const STATUS_STYLES: Record<string, { dot: string; label: string; text: string; surface: string }> = {
  applied: { dot: "bg-green-500", label: "Applied", text: "text-green-700", surface: "bg-green-50" },
  queued: { dot: "bg-amber-400", label: "Queued", text: "text-amber-700", surface: "bg-amber-50" },
  running: { dot: "bg-blue-500", label: "Running", text: "text-blue-700", surface: "bg-blue-50" },
  requires_auth: { dot: "bg-indigo-500", label: "Auth needed", text: "text-indigo-700", surface: "bg-indigo-50" },
  skipped: { dot: "bg-gray-300", label: "Skipped", text: "text-gray-500", surface: "bg-gray-100" },
  expired: { dot: "bg-gray-200", label: "Expired", text: "text-gray-400", surface: "bg-gray-100" },
  failed: { dot: "bg-red-400", label: "Failed", text: "text-red-600", surface: "bg-red-50" },
} as const;

const PREFERRED_PROFILE_ORDER = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "linkedin",
  "website",
  "github",
  "resume_pdf_path",
  "school",
  "major",
  "graduation",
  "city",
  "state_region",
  "country",
  "work_authorization",
  "sponsorship_required",
] as const;

function safeClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getRequestPayload(application: DashboardApplicationRecord): RequestPayloadShape {
  if (
    application.request_payload &&
    typeof application.request_payload === "object" &&
    !Array.isArray(application.request_payload)
  ) {
    return safeClone(application.request_payload as RequestPayloadShape);
  }

  return {};
}

function stringifyDraftValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || typeof value === "undefined") return "";
  return JSON.stringify(value, null, 2);
}

function prettifyKey(key: string) {
  return key.replaceAll("_", " ");
}

function buildDraftState(application: DashboardApplicationRecord): DraftState {
  const payload = getRequestPayload(application);
  const profile =
    payload.profile && typeof payload.profile === "object" && !Array.isArray(payload.profile)
      ? (payload.profile as Record<string, unknown>)
      : {};
  const customAnswers =
    profile.custom_answers &&
    typeof profile.custom_answers === "object" &&
    !Array.isArray(profile.custom_answers)
      ? (profile.custom_answers as Record<string, unknown>)
      : {};

  const topLevelExtras = Object.fromEntries(
    Object.entries(payload)
      .filter(([key]) => key !== "url" && key !== "profile")
      .map(([key, value]) => [key, stringifyDraftValue(value)])
  );

  return {
    url: typeof payload.url === "string" ? payload.url : application.job.url,
    profile: Object.fromEntries(
      Object.entries(profile)
        .filter(([key]) => key !== "custom_answers")
        .map(([key, value]) => [key, stringifyDraftValue(value)])
    ),
    customAnswers: Object.fromEntries(
      Object.entries(customAnswers).map(([key, value]) => [key, stringifyDraftValue(value)])
    ),
    topLevelExtras,
  };
}

function parseDraftValue(raw: string, original: unknown, label: string): unknown {
  if (typeof original === "boolean") {
    if (raw !== "true" && raw !== "false") {
      throw new Error(`${label} must be true or false`);
    }
    return raw === "true";
  }

  if (typeof original === "number") {
    const next = Number(raw);
    if (Number.isNaN(next)) {
      throw new Error(`${label} must be a number`);
    }
    return next;
  }

  if (
    Array.isArray(original) ||
    (original !== null && typeof original === "object")
  ) {
    if (!raw.trim()) {
      return Array.isArray(original) ? [] : {};
    }

    try {
      return JSON.parse(raw);
    } catch {
      throw new Error(`${label} must be valid JSON`);
    }
  }

  return raw;
}

function buildPayloadFromDraft(
  application: DashboardApplicationRecord,
  draft: DraftState
): RequestPayloadShape {
  const original = getRequestPayload(application);
  const originalProfile =
    original.profile && typeof original.profile === "object" && !Array.isArray(original.profile)
      ? (original.profile as Record<string, unknown>)
      : {};
  const originalCustomAnswers =
    originalProfile.custom_answers &&
    typeof originalProfile.custom_answers === "object" &&
    !Array.isArray(originalProfile.custom_answers)
      ? (originalProfile.custom_answers as Record<string, unknown>)
      : {};

  const nextProfile: Record<string, unknown> = {};
  for (const [key, rawValue] of Object.entries(draft.profile)) {
    nextProfile[key] = parseDraftValue(rawValue, originalProfile[key], prettifyKey(key));
  }

  const nextCustomAnswers: Record<string, unknown> = {};
  for (const [key, rawValue] of Object.entries(draft.customAnswers)) {
    nextCustomAnswers[key] = parseDraftValue(
      rawValue,
      originalCustomAnswers[key] ?? "",
      prettifyKey(key)
    );
  }

  nextProfile.custom_answers = nextCustomAnswers;

  const nextPayload: RequestPayloadShape = {
    ...original,
    url: draft.url,
    profile: nextProfile,
  };

  for (const [key, rawValue] of Object.entries(draft.topLevelExtras)) {
    nextPayload[key] = parseDraftValue(rawValue, original[key], prettifyKey(key));
  }

  return nextPayload;
}

function orderProfileKeys(keys: string[]) {
  const preferred = PREFERRED_PROFILE_ORDER.filter((key) => keys.includes(key));
  const rest = keys
    .filter((key) => !PREFERRED_PROFILE_ORDER.includes(key as (typeof PREFERRED_PROFILE_ORDER)[number]))
    .sort();
  return [...preferred, ...rest];
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
          Queue a job from Browse Jobs first, then come back here to verify and edit the exact application payload.
        </p>
      </div>

      <Link
        href="/jobs"
        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium underline underline-offset-2 transition-colors"
      >
        Open browse jobs →
      </Link>
    </div>
  );
}

export function ApplicationsList({ applications }: Props) {
  const reviewable = useMemo(
    () =>
      applications.filter((application) =>
        ["queued", "running", "requires_auth", "failed", "applied"].includes(application.status)
      ),
    [applications]
  );
  const leftPanelRef = useRef<HTMLDivElement | null>(null);
  const queueViewportRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [localApplications, setLocalApplications] = useState(reviewable);
  const [selectedId, setSelectedId] = useState<string | null>(reviewable[0]?.id ?? null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [trustError, setTrustError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [trustingId, setTrustingId] = useState<string | null>(null);
  const [arrowTop, setArrowTop] = useState<number | null>(null);

  useEffect(() => {
    setLocalApplications(reviewable);
    setSelectedId((current) =>
      reviewable.some((application) => application.id === current)
        ? current
        : reviewable[0]?.id ?? null
    );
  }, [reviewable]);

  const selectedApplication =
    localApplications.find((application) => application.id === selectedId) ??
    localApplications[0] ??
    null;

  useLayoutEffect(() => {
    function updateArrowPosition() {
      if (!selectedApplication?.id) {
        setArrowTop((current) => (current === null ? current : null));
        return;
      }

      const panel = leftPanelRef.current;
      const viewport = queueViewportRef.current;
      const row = rowRefs.current[selectedApplication.id];

      if (!panel || !viewport || !row) {
        setArrowTop((current) => (current === null ? current : null));
        return;
      }

      const panelRect = panel.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      const rowCenter = rowRect.top - panelRect.top + rowRect.height / 2;
      const minTop = viewportRect.top - panelRect.top + 26;
      const maxTop = viewportRect.bottom - panelRect.top - 26;

      const nextTop = Math.max(minTop, Math.min(maxTop, rowCenter));
      setArrowTop((current) =>
        current !== null && Math.abs(current - nextTop) < 0.5 ? current : nextTop
      );
    }

    updateArrowPosition();

    const viewport = queueViewportRef.current;
    if (viewport) {
      viewport.addEventListener("scroll", updateArrowPosition, { passive: true });
    }
    window.addEventListener("resize", updateArrowPosition);

    return () => {
      if (viewport) {
        viewport.removeEventListener("scroll", updateArrowPosition);
      }
      window.removeEventListener("resize", updateArrowPosition);
    };
  }, [localApplications, selectedApplication]);

  useEffect(() => {
    if (!selectedApplication) {
      setDraft(null);
      return;
    }

    setDraft(buildDraftState(selectedApplication));
    setSaveError(null);
    setTrustError(null);
  }, [selectedApplication]);

  const parsedDraftPayload = useMemo(() => {
    if (!selectedApplication || !draft) return null;

    try {
      return buildPayloadFromDraft(selectedApplication, draft);
    } catch {
      return null;
    }
  }, [draft, selectedApplication]);

  const requestProfile =
    parsedDraftPayload?.profile &&
    typeof parsedDraftPayload.profile === "object" &&
    !Array.isArray(parsedDraftPayload.profile)
      ? (parsedDraftPayload.profile as Record<string, unknown>)
      : null;

  const readiness = useMemo(() => {
    if (!requestProfile) return null;

    return buildUrlApplyReadinessSummary(
      {
        email: String(requestProfile.email ?? ""),
        phone: String(requestProfile.phone ?? ""),
        resume_pdf_path: String(requestProfile.resume_pdf_path ?? ""),
        work_authorization: String(requestProfile.work_authorization ?? ""),
        start_date: "",
        weekly_availability_hours: String(
          requestProfile.weekly_availability_hours ?? ""
        ),
        school: String(requestProfile.school ?? ""),
        graduation: String(requestProfile.graduation ?? ""),
        eeo:
          requestProfile.eeo &&
          typeof requestProfile.eeo === "object" &&
          !Array.isArray(requestProfile.eeo)
            ? (requestProfile.eeo as Record<string, string>)
            : {},
      },
      typeof parsedDraftPayload?.url === "string" ? parsedDraftPayload.url : selectedApplication.job.url
    );
  }, [parsedDraftPayload, requestProfile, selectedApplication]);

  async function handleSave() {
    if (!selectedApplication || !draft) return;

    setSavingId(selectedApplication.id);
    setSaveError(null);

    try {
      const nextPayload = buildPayloadFromDraft(selectedApplication, draft);
      const response = await fetch(
        `/api/applications/${selectedApplication.id}/request-payload`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            request_payload: nextPayload,
          }),
        }
      );

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to save application payload");
      }

      setLocalApplications((current) =>
        current.map((application) =>
          application.id === selectedApplication.id
            ? {
                ...application,
                request_payload: nextPayload,
                updated_at: new Date().toISOString(),
              }
            : application
        )
      );
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save application payload");
    } finally {
      setSavingId(null);
    }
  }

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

  if (localApplications.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid min-w-0 gap-0 xl:grid-cols-[0.95fr_1.05fr]">
      <div ref={leftPanelRef} className="relative min-w-0">
        {arrowTop !== null && selectedApplication ? (
          <div
            className="pointer-events-none absolute right-0 z-20 hidden -translate-y-1/2 xl:block"
            style={{ top: `${arrowTop}px` }}
            aria-hidden="true"
          >
            {/* Right-pointing triangle — clean connector between panels */}
            <div className="border-y-[6px] border-l-[8px] border-y-transparent border-l-indigo-400" />
          </div>
        ) : null}

        <div className="min-w-0 overflow-hidden rounded-l-xl rounded-r-none border border-r-0 border-gray-200 bg-white xl:max-h-[calc(100vh-12rem)] xl:min-h-[calc(100vh-12rem)]">
          <div className="border-b border-gray-100 px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-indigo-500">
              Verification Editor
            </p>
            <h3 className="mt-1 text-lg font-semibold text-gray-900">
              Queued Jobs
            </h3>
            <p className="mt-1 text-xs text-gray-400">
              Select an application to edit its exact submission payload.
            </p>
          </div>
          <div
            ref={queueViewportRef}
            className="divide-y divide-gray-100 overflow-y-auto xl:max-h-[calc(100vh-16.5rem)]"
          >
            {localApplications.map((application) => {
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
                  ref={(node) => {
                    rowRefs.current[application.id] = node;
                  }}
                  type="button"
                  onClick={() => setSelectedId(application.id)}
                  className={cn(
                    "w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors",
                    isSelected && "bg-indigo-50/60"
                  )}
                >
                  <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-500">
                      {application.job.company.slice(0, 2).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {application.job.title}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {application.job.company}
                        {application.job.location && ` · ${application.job.location}`}
                      </p>
                      {(application.confirmation_text || application.last_error) && (
                        <p className="mt-1 truncate text-xs text-gray-400">
                          {application.confirmation_text ?? application.last_error}
                        </p>
                      )}
                    </div>

                    <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:shrink-0 sm:justify-end">
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
      </div>

      {selectedApplication && draft ? (
        <div className="min-w-0 overflow-hidden rounded-r-xl rounded-l-none border border-gray-200 bg-white xl:max-h-[calc(100vh-12rem)] xl:min-h-[calc(100vh-12rem)]">
          <div className="flex flex-col gap-5 overflow-y-auto p-5 xl:max-h-[calc(100vh-12rem)]">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-indigo-500">
                  Verification Editor
                </p>
                <h3 className="mt-1 text-lg font-semibold text-gray-900">
                  {selectedApplication.job.title}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedApplication.job.company}
                  {selectedApplication.job.location ? ` · ${selectedApplication.job.location}` : ""}
                  {selectedApplication.job.remote ? " · Remote" : ""}
                </p>
              </div>
              <a
                href={selectedApplication.job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Open posting
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <InfoCard label="Portal" value={selectedApplication.job.portal ?? "Unknown"} />
              <InfoCard label="Level" value={selectedApplication.job.level} />
              <InfoCard label="Queued" value={new Date(selectedApplication.queued_at).toLocaleString()} />
              <InfoCard label="Last update" value={new Date(selectedApplication.updated_at).toLocaleString()} />
            </div>

            <EditorSection
              title="Application destination"
              hint="This is the exact URL Twin will use for the submission."
            >
              <EditableField
                label="Application URL"
                value={draft.url}
                kind="multiline"
                onChange={(value) => setDraft((current) => current ? { ...current, url: value } : current)}
              />
            </EditorSection>

            <EditorSection
              title="Application Card"
              hint="These fields come from the queued request payload and are all editable here."
            >
              <div className="space-y-3">
                {orderProfileKeys(Object.keys(draft.profile)).map((key) => (
                  <EditableField
                    key={key}
                    label={prettifyKey(key)}
                    value={draft.profile[key] ?? ""}
                    kind={getFieldKind(getRequestPayload(selectedApplication).profile?.[key])}
                    onChange={(value) =>
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              profile: {
                                ...current.profile,
                                [key]: value,
                              },
                            }
                          : current
                      )
                    }
                  />
                ))}
              </div>
            </EditorSection>

            <EditorSection
              title="Application Questions"
              hint="These are the exact question and answer pairs stored on the queued application."
            >
              <div className="space-y-3">
                {Object.keys(draft.customAnswers).length > 0 ? (
                  Object.entries(draft.customAnswers).map(([key, value]) => (
                    <EditableField
                      key={key}
                      label={key}
                      value={value}
                      kind="multiline"
                      onChange={(nextValue) =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                customAnswers: {
                                  ...current.customAnswers,
                                  [key]: nextValue,
                                },
                              }
                            : current
                        )
                      }
                    />
                  ))
                ) : (
                  <p className="text-xs text-gray-500">
                    No custom application questions were stored for this payload.
                  </p>
                )}
              </div>
            </EditorSection>

            {Object.keys(draft.topLevelExtras).length > 0 && (
              <EditorSection
                title="Additional Payload Fields"
                hint="Non-profile payload values are preserved here as editable JSON fields."
              >
                <div className="space-y-3">
                  {Object.entries(draft.topLevelExtras).map(([key, value]) => (
                    <EditableField
                      key={key}
                      label={prettifyKey(key)}
                      value={value}
                      kind="json"
                      onChange={(nextValue) =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                topLevelExtras: {
                                  ...current.topLevelExtras,
                                  [key]: nextValue,
                                },
                              }
                            : current
                        )
                      }
                    />
                  ))}
                </div>
              </EditorSection>
            )}

            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-indigo-500" />
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-400">
                  Verification
                </p>
              </div>
              {readiness ? (
                <div className="mt-3 space-y-2">
                  <p
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                      readiness.risk_level === "blocked"
                        ? "bg-red-50 text-red-700"
                        : readiness.risk_level === "risky"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-green-50 text-green-700"
                    )}
                  >
                    {readiness.risk_level === "blocked"
                      ? "Blocked before submit"
                      : readiness.risk_level === "risky"
                      ? "Review recommended"
                      : "Ready to submit"}
                  </p>
                  <p className="text-xs text-gray-600">
                    {readiness.issue_count} total issues · {readiness.critical_issue_count} critical ·{" "}
                    {readiness.likely_issue_count} likely blockers
                  </p>
                  {readiness.critical_issues.length > 0 ? (
                    <p className="text-xs text-red-600">
                      {readiness.critical_issues.slice(0, 4).map((issue) => issue.label).join(", ")}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500">
                      No critical blockers detected from the current editable payload.
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-xs text-amber-700">
                  Fix invalid field values before saving. JSON fields must stay valid.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={savingId === selectedApplication.id}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors",
                  savingId === selectedApplication.id
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-gray-900 text-white hover:bg-gray-800"
                )}
              >
                <Save className="h-4 w-4" />
                {savingId === selectedApplication.id ? "Saving…" : "Save payload changes"}
              </button>
              <button
                type="button"
                onClick={() => void handleTrustApply(selectedApplication.id)}
                disabled={selectedApplication.status !== "queued" || trustingId === selectedApplication.id}
                className={cn(
                  "rounded-xl px-4 py-3 text-sm font-semibold transition-colors",
                  selectedApplication.status !== "queued" || trustingId === selectedApplication.id
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                )}
              >
                {trustingId === selectedApplication.id
                  ? "Submitting…"
                  : selectedApplication.status === "queued"
                  ? "Trust Apply"
                  : "Already in progress"}
              </button>
            </div>

            {saveError && <p className="text-xs text-red-600">{saveError}</p>}
            {trustError && <p className="text-xs text-red-600">{trustError}</p>}
            {selectedApplication.last_error && selectedApplication.status === "failed" && (
              <p className="text-xs text-red-600">{selectedApplication.last_error}</p>
            )}
            {selectedApplication.confirmation_text && selectedApplication.status === "applied" && (
              <p className="text-xs text-green-700">{selectedApplication.confirmation_text}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="min-w-0 rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-gray-700">No reviewable applications selected.</p>
          <p className="mt-1 text-xs text-gray-400">
            Queue a job first, then select it here to review and edit the payload.
          </p>
        </div>
      )}
    </div>
  );
}

function getFieldKind(value: unknown): "text" | "multiline" | "boolean" | "number" | "json" {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (
    Array.isArray(value) ||
    (value !== null && typeof value === "object")
  ) {
    return "json";
  }
  if (typeof value === "string" && value.length > 100) return "multiline";
  return "text";
}

function EditorSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-100 bg-gray-50 p-4 first:rounded-t-lg last:rounded-b-lg">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-400">
        {title}
      </p>
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-gray-100 bg-gray-50 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">
        {label}
      </p>
      <p className="mt-1 text-sm text-gray-700 break-words">{value}</p>
    </div>
  );
}

function EditableField({
  label,
  value,
  kind,
  onChange,
}: {
  label: string;
  value: string;
  kind: "text" | "multiline" | "boolean" | "number" | "json";
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-gray-400">
        {label}
      </span>
      {kind === "multiline" || kind === "json" ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={kind === "json" ? 5 : 3}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition-colors focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
        />
      ) : kind === "boolean" ? (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition-colors focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : (
        <input
          type={kind === "number" ? "number" : "text"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition-colors focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
        />
      )}
    </label>
  );
}
