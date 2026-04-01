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
  confirmation: "text-indigo-700 font-semibold",
  info: "text-gray-600",
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
      <span className="shrink-0 text-[10px] text-gray-300 font-mono mt-0.5 w-16">{time}</span>
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
      <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-500">
        Response sent — your Twin will act on it momentarily.
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border bg-white overflow-hidden ${
        isAwaiting
          ? "border-indigo-300 shadow-lg shadow-indigo-50"
          : "border-gray-200"
      }`}
    >
      {/* Header */}
      <div
        className={`px-5 py-3 flex items-center justify-between ${
          isAwaiting ? "bg-indigo-600" : "bg-gray-800"
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

      <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
        {/* Live log feed */}
        <div className="p-4 bg-gray-950">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
            Live log
          </p>
          <div className="space-y-0.5 max-h-56 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-xs text-gray-600 italic">Starting up…</p>
            ) : (
              logs.map((e, i) => <LogLine key={i} event={e} />)
            )}
            {isRunning && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="h-1 w-1 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-1 w-1 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-1 w-1 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            )}
          </div>
        </div>

        {/* Confirmation pane */}
        <div className="p-5 flex flex-col gap-4">
          {isAwaiting ? (
            <>
              {application.preview_screenshot ? (
                <div className="rounded-xl overflow-hidden border border-gray-200 flex-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:image/png;base64,${application.preview_screenshot}`}
                    alt="Form preview before submission"
                    className="w-full object-top object-cover max-h-48"
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-200 flex-1 flex items-center justify-center text-xs text-gray-400 min-h-[80px]">
                  No preview available
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-900">
                  Ready to submit — confirm or cancel
                </p>
                <p className="text-xs text-gray-500">
                  Your Twin filled every required field. Review the screenshot
                  above, then approve or abort.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleConfirm}
                    disabled={confirming || cancelling}
                    className="flex-1 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {confirming ? "Confirming…" : "Confirm & Submit"}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={confirming || cancelling}
                    className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    {cancelling ? "Cancelling…" : "Cancel"}
                  </button>
                </div>
                <p className="text-[10px] text-gray-400">
                  Auto-cancels in 5 minutes if no response.
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-4 text-center">
              <div className="h-10 w-10 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
              <p className="text-sm text-gray-600">
                Filling the application form…
              </p>
              <p className="text-xs text-gray-400">
                A confirmation prompt will appear here before anything is submitted.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
