"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { Suspense } from "react";

interface AppliedApplication {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  job: {
    id: string;
    company: string;
    title: string;
    location: string | null;
    level: string | null;
    portal: string | null;
    remote: boolean | null;
    posted_at: string | null;
    url: string | null;
  } | null;
}

function AppliedPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [applications, setApplications] = useState<AppliedApplication[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  useEffect(() => {
    let active = true;
    setLoading(true);

    fetch(`/api/applications/applied?page=${page}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setApplications(data.applications ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
      })
      .catch(() => {
        if (!active) return;
        setApplications([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [page]);

  function goToPage(p: number) {
    router.push(`/applied?page=${p}`);
  }

  return (
    <div className="min-h-screen bg-canvas">
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-dim transition-colors hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Applied jobs</h1>
          <p className="mt-1 text-sm text-dim">
            {total > 0 ? `${total} application${total !== 1 ? "s" : ""} submitted` : "No applications yet"}
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl border border-rim bg-white px-5 py-4 shadow-soft-card">
                <div className="h-4 w-48 rounded bg-surface-strong" />
                <div className="mt-2 h-3 w-32 rounded bg-surface" />
                <div className="mt-2 h-3 w-24 rounded bg-surface" />
              </div>
            ))}
          </div>
        ) : applications.length === 0 ? (
          <div className="space-y-2 rounded-xl border border-dashed border-rim bg-white px-6 py-12 text-center shadow-soft-card">
            <p className="text-sm font-medium text-ink">No applied jobs yet</p>
            <p className="text-xs text-dim">Applications you submit will appear here.</p>
            <Link href="/jobs" className="mt-3 inline-flex text-xs font-medium text-accent hover:text-accent/80">
              Browse jobs →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {applications.map((app) => (
              <div key={app.id} className="flex items-start justify-between gap-4 rounded-xl border border-rim bg-white px-5 py-4 shadow-soft-card">
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {app.job?.title ?? "—"}
                  </p>
                  <p className="mt-0.5 text-xs text-dim">{app.job?.company ?? "—"}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-dim">
                    {app.job?.location && <span>{app.job.location}</span>}
                    {app.job?.remote && <span>Remote</span>}
                    {app.job?.level && <span className="capitalize">{app.job.level}</span>}
                    {app.job?.portal && (
                      <span className="rounded bg-surface px-1.5 py-0.5 font-medium uppercase tracking-wide text-dim">
                        {app.job.portal}
                      </span>
                    )}
                    <span>{formatDate(app.completed_at ?? app.updated_at)}</span>
                  </div>
                </div>
                {app.job?.url && (
                  <a
                    href={app.job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-1 text-xs text-accent transition-colors hover:text-accent/80"
                  >
                    View
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-dim">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 rounded-lg border border-rim bg-white px-3 py-1.5 text-xs font-medium text-dim transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 rounded-lg border border-rim bg-white px-3 py-1.5 text-xs font-medium text-dim transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function AppliedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-wash border-t-accent" />
      </div>
    }>
      <AppliedPageContent />
    </Suspense>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
