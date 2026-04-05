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
  error: "text-[rgb(194,62,41)]",
  warn: "text-[rgb(187,74,43)]",
  success: "text-[rgb(74,107,64)] font-semibold",
  confirmation: "text-[rgb(187,74,43)] font-semibold",
  info: "text-[rgb(165,142,126)]",
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
      <span className="shrink-0 text-[10px] text-[rgb(151,124,108)] font-mono mt-0.5 w-16">{time}</span>
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
      <div className="surface-card rounded-[28px] p-5 text-sm text-[rgb(125,99,82)]">
        Response sent — your Twin will act on it momentarily.
      </div>
    );
  }

  return (
    <div
      className={`rounded-[28px] border overflow-hidden ${
        isAwaiting
          ? "border-[rgb(227,205,188)] shadow-warm-xl bg-[rgba(255,250,245,0.97)]"
          : "border-[rgb(227,205,188)] bg-[rgba(255,250,245,0.94)] shadow-soft-card"
      }`}
    >
      {/* Header */}
      <div
        className={`px-5 py-3 flex items-center justify-between ${
          isAwaiting
            ? "bg-[linear-gradient(90deg,rgba(187,74,43,1),rgba(144,48,28,1))]"
            : "bg-[rgb(72,49,39)]"
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              isAwaiting
                ? "bg-orange-200 animate-pulse"
                : "bg-[rgb(145,195,126)] animate-pulse"
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

      <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[rgba(227,205,188,0.72)]">
        {/* Live log feed */}
        <div className="p-4 bg-[rgb(55,39,31)]">
          <p className="text-[10px] font-semibold text-[rgb(210,176,152)] uppercase tracking-widest mb-2">
            Live log
          </p>
          <div className="space-y-0.5 max-h-56 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-xs text-[rgb(210,176,152)] italic">Starting up…</p>
            ) : (
              logs.map((e, i) => <LogLine key={i} event={e} />)
            )}
            {isRunning && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="h-1 w-1 rounded-full bg-[rgb(232,126,92)] animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-1 w-1 rounded-full bg-[rgb(232,126,92)] animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-1 w-1 rounded-full bg-[rgb(232,126,92)] animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            )}
          </div>
        </div>

        {/* Confirmation pane */}
        <div className="p-5 flex flex-col gap-4">
          {isAwaiting ? (
            <>
              {application.preview_screenshot ? (
                <div className="rounded-xl overflow-hidden border border-[rgb(227,205,188)] flex-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:image/png;base64,${application.preview_screenshot}`}
                    alt="Form preview before submission"
                    className="w-full object-top object-cover max-h-48"
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[rgb(227,205,188)] flex-1 flex items-center justify-center text-xs text-[rgb(149,118,98)] min-h-[80px]">
                  No preview available
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-semibold text-[rgb(41,28,22)]">
                  Ready to submit — confirm or cancel
                </p>
                <p className="text-xs text-[rgb(125,99,82)]">
                  Your Twin filled every required field. Review the screenshot
                  above, then approve or abort.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleConfirm}
                    disabled={confirming || cancelling}
                    className="flex-1 rounded-full bg-[rgb(187,74,43)] px-4 py-2 text-sm font-semibold text-white hover:bg-[rgb(169,63,34)] disabled:opacity-50 transition-colors"
                  >
                    {confirming ? "Confirming…" : "Confirm & Submit"}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={confirming || cancelling}
                    className="rounded-full border border-[rgb(227,205,188)] px-4 py-2 text-sm font-medium text-[rgb(82,57,43)] hover:bg-[rgb(252,243,236)] disabled:opacity-50 transition-colors"
                  >
                    {cancelling ? "Cancelling…" : "Cancel"}
                  </button>
                </div>
                <p className="text-[10px] text-[rgb(149,118,98)]">
                  Auto-cancels in 5 minutes if no response.
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-4 text-center">
              <div className="h-10 w-10 rounded-full border-2 border-[rgb(244,232,221)] border-t-[rgb(187,74,43)] animate-spin" />
              <p className="text-sm text-[rgb(82,57,43)]">
                Filling the application form…
              </p>
              <p className="text-xs text-[rgb(149,118,98)]">
                A confirmation prompt will appear here before anything is submitted.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
