"use client";

import Link from "next/link";
import { formatPostedAt, cn } from "@/lib/utils";

export interface DashboardApplicationRecord {
  id: string;
  status: string;
  queue_status: string;
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
    url: string;
  };
}

interface Props {
  applications: DashboardApplicationRecord[];
}

const STATUS_STYLES: Record<string, { dot: string; label: string; text: string }> = {
  applied:   { dot: "bg-green-500",  label: "Applied",  text: "text-green-700"  },
  queued:    { dot: "bg-amber-400",  label: "Queued",   text: "text-amber-700"  },
  running:   { dot: "bg-blue-500",   label: "Running",  text: "text-blue-700"   },
  requires_auth: { dot: "bg-indigo-500", label: "Auth needed", text: "text-indigo-700" },
  skipped:   { dot: "bg-gray-300",   label: "Skipped",  text: "text-gray-500"   },
  expired:   { dot: "bg-gray-200",   label: "Expired",  text: "text-gray-400"   },
  failed:    { dot: "bg-red-400",    label: "Failed",   text: "text-red-600"    },
} as const;

export function ApplicationsList({ applications }: Props) {
  if (applications.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="divide-y divide-gray-100">
        {applications.map((application) => {
          const style = STATUS_STYLES[application.status] ?? STATUS_STYLES.pending;
          return (
            <div
              key={application.id}
              className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              {/* Company logo placeholder */}
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
                    application.status === "applied" ? "bg-green-50" :
                    application.status === "queued" ? "bg-amber-50" :
                    application.status === "running" ? "bg-blue-50" :
                    application.status === "requires_auth" ? "bg-indigo-50" :
                    application.status === "failed"  ? "bg-red-50" :
                    "bg-gray-100"
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
                  {style.label}
                </span>
                {(application.status === "queued" || application.status === "running") && (
                  <span className="text-[11px] text-gray-400">
                    Attempt {Math.max(application.attempt_count, 1)}
                  </span>
                )}
                {application.job.url && (
                  <a
                    href={application.job.url}
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
          No applications yet
        </p>
        <p className="text-sm text-gray-400 max-w-xs">
          Real submitted or blocked application attempts will appear here after
          you run them through Twin.
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
