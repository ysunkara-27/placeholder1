"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, FlaskConical } from "lucide-react";
import type { DashboardApplicationRecord } from "@/components/dashboard/applications-list";

interface QueuedJobsPopupProps {
  applications: DashboardApplicationRecord[];
}

export function QueuedJobsPopup({ applications }: QueuedJobsPopupProps) {
  const [minimized, setMinimized] = useState(false);

  const queued = applications.filter(
    (a) => a.status === "queued" || a.status === "running"
  );

  if (queued.length === 0) return null;

  if (minimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setMinimized(false)}
          className="group flex items-center gap-2.5 rounded-2xl border border-white/35 bg-accent px-5 py-3 text-sm font-medium text-white shadow-warm-xl backdrop-blur-sm transition-all hover:bg-accent/90"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-bold tabular-nums">
            {queued.length}
          </span>
          Queued
          <ChevronUp className="h-3.5 w-3.5 opacity-70" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[22rem] overflow-hidden rounded-2xl border border-rim bg-white shadow-warm-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-rim px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white tabular-nums">
            {queued.length}
          </span>
          <span className="text-base font-semibold text-ink">In queue</span>
          {queued.some((a) => a.status === "running") && (
            <span className="flex items-center gap-1 rounded-full bg-accent-wash px-2 py-0.5 text-[10px] font-semibold text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              Applying
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMinimized(true)}
            className="rounded-lg p-1.5 text-dim transition-colors hover:bg-surface hover:text-ink"
            title="Minimize"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Job rows — scrollable, max 4 visible */}
      <div className="max-h-[280px] divide-y divide-rim overflow-y-auto">
        {queued.map((app) => (
          <div key={app.id} className="px-5 py-4 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-semibold text-ink">
                {app.job?.title ?? "—"}
              </p>
              <p className="mt-0.5 truncate text-xs text-dim">
                {app.job?.company ?? "—"}
                {app.job?.portal ? ` · ${app.job.portal}` : ""}
              </p>
            </div>
            <StatusPill status={app.status} />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-rim px-5 py-4">
        <Link
          href="/apply-lab"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/90"
        >
          <FlaskConical className="h-3.5 w-3.5" />
          Open Apply Lab
        </Link>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "running") {
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent-wash px-2 py-0.5 text-[10px] font-semibold text-accent">
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
        Applying
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-dim">
      Queued
    </span>
  );
}
