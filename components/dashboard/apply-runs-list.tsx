"use client";

import { formatPostedAt, cn } from "@/lib/utils";

export interface ApplyRunRecord {
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
    follow_up_required: boolean;
    follow_up_items: string[];
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

const STATUS_STYLES: Record<string, { dot: string; label: string; text: string; bg: string }> = {
  applied: { dot: "bg-green-500", label: "Applied", text: "text-green-700", bg: "bg-green-50" },
  failed: { dot: "bg-red-500", label: "Failed", text: "text-red-700", bg: "bg-red-50" },
  unsupported: { dot: "bg-amber-400", label: "Planned", text: "text-amber-700", bg: "bg-amber-50" },
  requires_auth: { dot: "bg-indigo-500", label: "Auth needed", text: "text-indigo-700", bg: "bg-indigo-50" },
};

export function ApplyRunsList({ runs }: { runs: ApplyRunRecord[] }) {
  if (runs.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center">
        <p className="text-sm font-medium text-gray-900">No apply runs yet</p>
        <p className="mt-2 text-sm text-gray-400">
          Use the internal apply lab to generate a portal plan or test submission.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="divide-y divide-gray-100">
        {runs.map((run) => {
          const style = STATUS_STYLES[run.status] ?? {
            dot: "bg-gray-400",
            label: run.status,
            text: "text-gray-700",
            bg: "bg-gray-100",
          };

          return (
            <div
              key={run.id}
              className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[11px] font-bold uppercase text-gray-500">
                {(run.portal ?? run.mode).slice(0, 2)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">
                    {run.portal ?? "Unknown portal"} · {run.mode}
                  </p>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                      style.text,
                      style.bg
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
                    {style.label}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-gray-500">{run.url}</p>
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
                {run.summary?.follow_up_required && run.summary.follow_up_items.length ? (
                  <p className="mt-1 text-[11px] text-amber-700 line-clamp-2">
                    follow-up: {run.summary.follow_up_items.join(" · ")}
                  </p>
                ) : null}
                {run.summary?.recovery_attempted ? (
                  <p className="mt-1 text-[11px] text-gray-400">
                    recovery: {run.summary.recovery_family?.replaceAll("_", " ") ?? "attempted"}
                  </p>
                ) : null}
                {run.error && (
                  <p className="mt-2 text-xs text-red-600 line-clamp-2">{run.error}</p>
                )}
              </div>

              <div className="shrink-0 text-xs text-gray-400">
                {formatPostedAt(run.created_at)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
