"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ExternalLink } from "lucide-react";
import { INDUSTRY_OPTIONS, LEVEL_OPTIONS, formatPostedAt } from "@/lib/utils";
import type { JobWithMatch } from "@/app/api/jobs/browse/route";

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobWithMatch[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [offset, setOffset] = useState(0);
  const [queueing, setQueueing] = useState<string | null>(null);
  const [queued, setQueued] = useState<Set<string>>(new Set());

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const LIMIT = 30;

  function isPersistedQueuedStatus(status: string | null | undefined) {
    return Boolean(
      status &&
      ["queued", "running", "applied", "requires_auth"].includes(status)
    );
  }

  function queueLabelForStatus(status: string | null | undefined) {
    if (status === "applied") return "Applied ✓";
    if (status === "running") return "Running…";
    if (status === "requires_auth") return "Needs Action";
    if (status === "queued") return "Queued ✓";
    return "Queue it";
  }

  const fetchJobs = useCallback(async (currentOffset: number, append: boolean) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (selectedIndustries.length > 0) params.set("industries", selectedIndustries.join(","));
      if (selectedLevels.length > 0) params.set("levels", selectedLevels.join(","));
      if (remoteOnly) params.set("remote", "true");
      params.set("limit", String(LIMIT));
      params.set("offset", String(currentOffset));

      const res = await fetch(`/api/jobs/browse?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch jobs");
      const data = await res.json();

      const fetchedJobs = data.jobs ?? [];
      const persistedQueuedIds = fetchedJobs
        .filter((job: JobWithMatch) => isPersistedQueuedStatus(job.application_status))
        .map((job: JobWithMatch) => job.id);

      setJobs((prev) => append ? [...prev, ...fetchedJobs] : fetchedJobs);
      setTotal(data.total ?? 0);
      setQueued((prev) => {
        if (!append) {
          return new Set(persistedQueuedIds);
        }

        const next = new Set(prev);
        for (const jobId of persistedQueuedIds) {
          next.add(jobId);
        }
        return next;
      });
    } catch {
      // silently fail — user sees empty state
    } finally {
      setLoading(false);
    }
  }, [search, selectedIndustries, selectedLevels, remoteOnly]);

  // Initial load and filter changes (reset offset)
  useEffect(() => {
    setOffset(0);
    fetchJobs(0, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndustries, selectedLevels, remoteOnly]);

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setOffset(0);
      fetchJobs(0, false);
    }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleQueue(jobId: string) {
    setQueueing(jobId);
    try {
      const res = await fetch(`/api/jobs/${jobId}/queue`, { method: "POST" });
      if (res.ok || res.status === 409) {
        setQueued((prev) => new Set([...prev, jobId]));
      }
    } finally {
      setQueueing(null);
    }
  }

  function handleLoadMore() {
    const newOffset = offset + LIMIT;
    setOffset(newOffset);
    fetchJobs(newOffset, true);
  }

  function toggleIndustry(value: string) {
    setSelectedIndustries((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  function toggleLevel(value: string) {
    setSelectedLevels((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  function clearFilters() {
    setSelectedIndustries([]);
    setSelectedLevels([]);
    setRemoteOnly(false);
    setSearch("");
  }

  const hasFilters = selectedIndustries.length > 0 || selectedLevels.length > 0 || remoteOnly || search.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-gray-400">
              Browse jobs
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">
              Job Board
            </h1>
          </div>
          <input
            type="text"
            placeholder="Search company or title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors sm:w-72"
          />
        </div>

        {/* Filter bar */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider mr-1">Industries</span>
            {INDUSTRY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleIndustry(opt.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selectedIndustries.includes(opt.value)
                    ? "bg-indigo-600 text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider mr-1">Level</span>
            {LEVEL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleLevel(opt.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selectedLevels.includes(opt.value)
                    ? "bg-indigo-600 text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setRemoteOnly((v) => !v)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                remoteOnly
                  ? "bg-indigo-600 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-300"
              }`}
            >
              Remote only
            </button>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-full px-3 py-1 text-xs font-medium text-red-500 border border-red-200 hover:bg-red-50 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Results count */}
        {!loading && (
          <p className="text-xs text-gray-400">
            {total === 0 ? "No jobs found" : `${total} job${total !== 1 ? "s" : ""} found`}
          </p>
        )}

        {/* Loading skeleton */}
        {loading && jobs.length === 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-gray-200 bg-white p-4 animate-pulse space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-gray-200" />
                  <div className="h-3 w-24 rounded bg-gray-200" />
                </div>
                <div className="h-4 w-48 rounded bg-gray-200" />
                <div className="h-3 w-32 rounded bg-gray-200" />
                <div className="h-3 w-full rounded bg-gray-200" />
                <div className="flex justify-between">
                  <div className="h-3 w-16 rounded bg-gray-200" />
                  <div className="h-7 w-20 rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && jobs.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center space-y-2">
            <p className="text-sm font-medium text-gray-700">No jobs match your filters.</p>
            <p className="text-xs text-gray-400">Try removing some filters or check back later.</p>
          </div>
        )}

        {/* Job cards */}
        {jobs.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {jobs.map((job) => {
              const isQueued = queued.has(job.id) || isPersistedQueuedStatus(job.application_status);
              const isQueueing = queueing === job.id;
              const score = job.match.score;
              const isAutoMatch = score >= 75;
              const isPartialMatch = score >= 50 && score < 75;

              return (
                <div
                  key={job.id}
                  className="rounded-2xl border border-gray-200 bg-white p-4 flex flex-col gap-2 hover:border-gray-300 transition-colors"
                >
                  {/* Top row: match dot + company */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                          isAutoMatch ? "bg-green-500" : isPartialMatch ? "bg-amber-500" : "bg-gray-300"
                        }`}
                      />
                      {isAutoMatch ? (
                        <span className="text-[11px] font-medium text-green-600">Auto-match</span>
                      ) : (
                        <span className="text-[11px] font-medium text-gray-400">{score}</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 truncate">{job.company}</span>
                  </div>

                  {/* Title */}
                  <p className="font-semibold text-gray-900 text-sm leading-snug">{job.title}</p>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-xs text-gray-500">{job.location}</span>
                    {job.remote && (
                      <span className="rounded-full bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 text-[10px] font-medium">Remote</span>
                    )}
                    <span className="rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-[10px] font-medium">{job.level}</span>
                    {job.portal && (
                      <span className="rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 text-[10px] font-medium">{job.portal}</span>
                    )}
                  </div>

                  {/* JD summary */}
                  {job.jd_summary && (
                    <p className="text-xs text-gray-500 line-clamp-2">{job.jd_summary}</p>
                  )}

                  {/* Bottom row: date + queue button */}
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[11px] text-gray-400">{formatPostedAt(job.posted_at)}</span>
                    <div className="flex items-center gap-2">
                      <a
                        href={job.application_url || job.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                      >
                        Posting
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <button
                        type="button"
                        disabled={isQueued || isQueueing}
                        onClick={() => handleQueue(job.id)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                          isQueued
                            ? "text-green-600 border-green-200 bg-green-50 cursor-default"
                            : isQueueing
                            ? "text-indigo-400 border-indigo-100 bg-white cursor-not-allowed"
                            : "text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                        }`}
                      >
                        {isQueueing ? "Queuing…" : queueLabelForStatus(job.application_status)}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load more */}
        {!loading && (offset + LIMIT) < total && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={handleLoadMore}
              className="rounded-full border border-gray-200 bg-white px-6 py-2 text-sm text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Load more
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
