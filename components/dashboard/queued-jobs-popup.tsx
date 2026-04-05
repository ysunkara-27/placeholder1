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
          className="group flex items-center gap-2 rounded-2xl border border-[rgba(255,255,255,0.22)] bg-[rgb(187,74,43)] px-4 py-2.5 text-sm font-medium text-white shadow-warm-xl backdrop-blur-sm transition-all hover:bg-[rgb(169,63,34)]"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs font-bold tabular-nums">
            {queued.length}
          </span>
          Queued
          <ChevronUp className="h-3.5 w-3.5 opacity-70" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 rounded-[26px] border border-[rgb(227,205,188)] bg-[rgba(255,250,245,0.96)] shadow-warm-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[rgba(227,205,188,0.75)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[rgb(187,74,43)] text-[10px] font-bold text-white tabular-nums">
            {queued.length}
          </span>
          <span className="text-sm font-semibold text-[rgb(41,28,22)]">In queue</span>
          {queued.some((a) => a.status === "running") && (
            <span className="flex items-center gap-1 rounded-full bg-[rgb(250,233,221)] px-2 py-0.5 text-[10px] font-semibold text-[rgb(187,74,43)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[rgb(187,74,43)] animate-pulse" />
              Applying
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMinimized(true)}
            className="rounded-lg p-1.5 text-[rgb(149,118,98)] hover:bg-[rgb(250,233,221)] hover:text-[rgb(82,57,43)] transition-colors"
            title="Minimize"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Job rows — scrollable, max 4 visible */}
      <div className="max-h-[224px] overflow-y-auto divide-y divide-[rgba(227,205,188,0.55)]">
        {queued.map((app) => (
          <div key={app.id} className="px-4 py-3 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[rgb(41,28,22)] truncate">
                {app.job?.title ?? "—"}
              </p>
              <p className="text-[11px] text-[rgb(125,99,82)] truncate mt-0.5">
                {app.job?.company ?? "—"}
                {app.job?.portal ? ` · ${app.job.portal}` : ""}
              </p>
            </div>
            <StatusPill status={app.status} />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-[rgba(227,205,188,0.75)] px-4 py-3">
        <Link
          href="/apply-lab"
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-[rgb(187,74,43)] px-3 py-2 text-xs font-semibold text-white hover:bg-[rgb(169,63,34)] transition-colors"
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
      <span className="shrink-0 flex items-center gap-1 rounded-full bg-[rgb(250,233,221)] px-2 py-0.5 text-[10px] font-semibold text-[rgb(187,74,43)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[rgb(187,74,43)] animate-pulse" />
        Applying
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-[rgb(244,232,221)] px-2 py-0.5 text-[10px] font-semibold text-[rgb(125,99,82)]">
      Queued
    </span>
  );
}
