"use client";

import Link from "next/link";
import type { Alert } from "@/lib/types";
import { formatPostedAt, cn } from "@/lib/utils";

interface Props {
  alerts: Alert[];
}

const STATUS_STYLES: Record<string, { dot: string; label: string; text: string }> = {
  applied:   { dot: "bg-green-500",  label: "Applied",  text: "text-green-700"  },
  pending:   { dot: "bg-amber-400",  label: "Pending",  text: "text-amber-700"  },
  confirmed: { dot: "bg-indigo-500", label: "Queued",   text: "text-indigo-700" },
  skipped:   { dot: "bg-gray-300",   label: "Skipped",  text: "text-gray-500"   },
  expired:   { dot: "bg-gray-200",   label: "Expired",  text: "text-gray-400"   },
  failed:    { dot: "bg-red-400",    label: "Failed",   text: "text-red-600"    },
};

export function ApplicationsList({ alerts }: Props) {
  if (alerts.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="divide-y divide-gray-100">
        {alerts.map((alert) => {
          const style = STATUS_STYLES[alert.status] ?? STATUS_STYLES.pending;
          return (
            <div
              key={alert.id}
              className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              {/* Company logo placeholder */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-500">
                {alert.job.company.slice(0, 2).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {alert.job.title}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {alert.job.company}
                  {alert.job.location && ` · ${alert.job.location}`}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-gray-400">
                  {formatPostedAt(alert.alerted_at)}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                    style.text,
                    alert.status === "applied" ? "bg-green-50" :
                    alert.status === "pending" ? "bg-amber-50" :
                    alert.status === "failed"  ? "bg-red-50" :
                    "bg-gray-100"
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
                  {style.label}
                </span>
                {alert.job.url && (
                  <a
                    href={alert.job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-300 hover:text-gray-500 transition-colors text-xs"
                    aria-label="View job"
                  >
                    ↗
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-6 py-14 flex flex-col items-center gap-5 text-center">
      {/* Pulsing rings */}
      <div className="relative flex items-center justify-center">
        <span className="absolute h-16 w-16 rounded-full border-2 border-indigo-200 animate-ping opacity-40" />
        <span className="absolute h-12 w-12 rounded-full border-2 border-indigo-300 animate-ping opacity-30"
              style={{ animationDelay: "0.3s" }} />
        <div className="relative h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
          AA
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-semibold text-gray-900">
          Your Twin is actively scanning
        </p>
        <p className="text-sm text-gray-400 max-w-xs">
          Applications will appear here the moment your Twin finds and submits
          a match. Check back soon.
        </p>
      </div>

      <Link
        href="/onboarding"
        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium underline underline-offset-2 transition-colors"
      >
        Adjust preferences →
      </Link>
    </div>
  );
}
