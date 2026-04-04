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
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Applied jobs</h1>
          <p className="mt-1 text-sm text-gray-500">
            {total > 0 ? `${total} application${total !== 1 ? "s" : ""} submitted` : "No applications yet"}
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-gray-200 bg-white px-5 py-4 animate-pulse">
                <div className="h-4 w-48 rounded bg-gray-200" />
                <div className="mt-2 h-3 w-32 rounded bg-gray-100" />
                <div className="mt-2 h-3 w-24 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        ) : applications.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center space-y-2">
            <p className="text-sm font-medium text-gray-700">No applied jobs yet</p>
            <p className="text-xs text-gray-400">Applications you submit will appear here.</p>
            <Link href="/jobs" className="mt-3 inline-flex text-xs text-indigo-600 hover:text-indigo-700 font-medium">
              Browse jobs →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {applications.map((app) => (
              <div key={app.id} className="rounded-xl border border-gray-200 bg-white px-5 py-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {app.job?.title ?? "—"}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{app.job?.company ?? "—"}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                    {app.job?.location && <span>{app.job.location}</span>}
                    {app.job?.remote && <span>Remote</span>}
                    {app.job?.level && <span className="capitalize">{app.job.level}</span>}
                    {app.job?.portal && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-500 uppercase tracking-wide font-medium">
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
                    className="shrink-0 inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 transition-colors"
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
            <p className="text-xs text-gray-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-8 w-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
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
