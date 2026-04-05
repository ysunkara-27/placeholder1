"use client";

import { useState } from "react";

export interface LogEvent {
  ts: string;
  msg: string;
  level?: string;
}

export interface LiveApplication {
  id: string;
  status: string;
  log_events: LogEvent[] | null;
  preview_screenshot: string | null;
  job: {
    company: string;
    title: string;
    application_url: string;
  } | null;
}

const LEVEL_STYLES: Record<string, string> = {
  error: "text-red-600",
  warn: "text-amber-600",
  success: "text-green-700 font-semibold",
  confirmation: "text-accent font-semibold",
  info: "text-dim",
};

function LogLine({ event }: { event: LogEvent }) {
  const colorClass = LEVEL_STYLES[event.level ?? "info"] ?? LEVEL_STYLES.info;
  const time = new Date(event.ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return (
    <div className="flex items-start gap-2 py-0.5">
      <span className="mt-0.5 w-16 shrink-0 font-mono text-[10px] text-dim/60">{time}</span>
      <span className={`text-xs ${colorClass}`}>{event.msg}</span>
    </div>
  );
}

export function LiveApplicationPanel({
  application,
}: {
  application: LiveApplication;
}) {
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [done, setDone] = useState(false);

  const isAwaiting = application.status === "awaiting_confirmation";
  const isRunning = application.status === "running";
  const logs: LogEvent[] = Array.isArray(application.log_events)
    ? application.log_events
    : [];

  async function handleConfirm() {
    setConfirming(true);
    try {
      await fetch("/api/applications/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ application_id: application.id }),
      });
      setDone(true);
    } finally {
      setConfirming(false);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      await fetch("/api/applications/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ application_id: application.id }),
      });
      setDone(true);
    } finally {
      setCancelling(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-rim bg-white p-5 text-sm text-dim shadow-soft-card">
        Response sent — your Twin will act on it momentarily.
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-white shadow-soft-card ${
        isAwaiting
          ? "border-accent/30 shadow-warm"
          : "border-rim"
      }`}
    >
      {/* Header */}
      <div
        className={`px-5 py-3 flex items-center justify-between ${
          isAwaiting ? "bg-accent" : "bg-ink"
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              isAwaiting
                ? "bg-amber-300 animate-pulse"
                : "bg-green-400 animate-pulse"
            }`}
          />
          <span className="text-sm font-semibold text-white">
            {isAwaiting
              ? "Waiting for your confirmation"
              : "Twin is filling the form"}
          </span>
        </div>
        <span className="text-xs text-white/60 truncate max-w-[220px]">
          {application.job?.title ?? ""}
          {application.job?.company ? ` @ ${application.job.company}` : ""}
        </span>
      </div>

      <div className="grid divide-y divide-rim sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        {/* Live log feed */}
        <div className="bg-ink p-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-dim/80">
            Live log
          </p>
          <div className="space-y-0.5 max-h-56 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-xs italic text-dim/80">Starting up…</p>
            ) : (
              logs.map((e, i) => <LogLine key={i} event={e} />)
            )}
            {isRunning && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="h-1 w-1 animate-bounce rounded-full bg-accent/80" style={{ animationDelay: "0ms" }} />
                <span className="h-1 w-1 animate-bounce rounded-full bg-accent/80" style={{ animationDelay: "150ms" }} />
                <span className="h-1 w-1 animate-bounce rounded-full bg-accent/80" style={{ animationDelay: "300ms" }} />
              </div>
            )}
          </div>
        </div>

        {/* Confirmation pane */}
        <div className="p-5 flex flex-col gap-4">
          {isAwaiting ? (
            <>
              {application.preview_screenshot ? (
                <div className="flex-1 overflow-hidden rounded-xl border border-rim">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:image/png;base64,${application.preview_screenshot}`}
                    alt="Form preview before submission"
                    className="w-full object-top object-cover max-h-48"
                  />
                </div>
              ) : (
                <div className="flex min-h-[80px] flex-1 items-center justify-center rounded-xl border border-dashed border-rim text-xs text-dim">
                  No preview available
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-semibold text-ink">
                  Ready to submit — confirm or cancel
                </p>
                <p className="text-xs text-dim">
                  Your Twin filled every required field. Review the screenshot
                  above, then approve or abort.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleConfirm}
                    disabled={confirming || cancelling}
                    className="flex-1 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
                  >
                    {confirming ? "Confirming…" : "Confirm & Submit"}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={confirming || cancelling}
                    className="rounded-full border border-rim px-4 py-2 text-sm font-medium text-dim transition-colors hover:bg-surface disabled:opacity-50"
                  >
                    {cancelling ? "Cancelling…" : "Cancel"}
                  </button>
                </div>
                <p className="text-[10px] text-dim">
                  Auto-cancels in 5 minutes if no response.
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-4 text-center">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent-wash border-t-accent" />
              <p className="text-sm text-dim">
                Filling the application form…
              </p>
              <p className="text-xs text-dim">
                A confirmation prompt will appear here before anything is submitted.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
