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
  requires_auth: { dot: "bg-accent", label: "Auth needed", text: "text-accent", bg: "bg-accent-wash" },
};

export function ApplyRunsList({ runs }: { runs: ApplyRunRecord[] }) {
  if (runs.length === 0) {
    return (
      <div className="rounded-[28px] border border-rim bg-white px-6 py-12 text-center shadow-soft-card">
        <p className="text-sm font-medium text-ink">No apply runs yet</p>
        <p className="mt-2 text-sm text-dim">
          Use the internal apply lab to generate a portal plan or test submission.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-rim bg-white overflow-hidden shadow-soft-card">
      <div className="divide-y divide-rim/60">
        {runs.map((run) => {
          const style = STATUS_STYLES[run.status] ?? {
            dot: "bg-rim-dark",
            label: run.status,
            text: "text-ink",
            bg: "bg-surface",
          };

          return (
            <div
              key={run.id}
              className="flex items-start gap-4 px-5 py-4 hover:bg-surface transition-colors"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-[11px] font-bold uppercase text-dim">
                {(run.portal ?? run.mode).slice(0, 2)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-ink">
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
                <p className="mt-1 truncate text-xs text-dim">{run.url}</p>
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
                {run.summary?.follow_up_required && run.summary.follow_up_items.length ? (
                  <p className="mt-1 text-[11px] text-amber-700 line-clamp-2">
                    follow-up: {run.summary.follow_up_items.join(" · ")}
                  </p>
                ) : null}
                {run.summary?.recovery_attempted ? (
                  <p className="mt-1 text-[11px] text-dim">
                    recovery: {run.summary.recovery_family?.replaceAll("_", " ") ?? "attempted"}
                  </p>
                ) : null}
                {run.error && (
                  <p className="mt-2 text-xs text-red-600 line-clamp-2">{run.error}</p>
                )}
              </div>

              <div className="shrink-0 text-xs text-dim">
                {formatPostedAt(run.created_at)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
