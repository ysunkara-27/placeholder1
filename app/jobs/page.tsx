"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Link, X } from "lucide-react";
import {
  APPLY_LAB_BROWSER_JOBS_KEY,
  HIDDEN_BROWSE_JOB_IDS_KEY,
  type ApplyLabBrowserJob,
} from "@/lib/jobs-board-storage";
import { INDUSTRY_OPTIONS, LEVEL_OPTIONS, formatPostedAt } from "@/lib/utils";
import type { JobWithMatch } from "@/app/api/jobs/browse/route";

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobWithMatch[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [offset, setOffset] = useState(0);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [queued, setQueued] = useState<Set<string>>(new Set());
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [hiddenJobIds, setHiddenJobIds] = useState<Set<string>>(new Set());
  const [showHiddenJobs, setShowHiddenJobs] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const [customCompany, setCustomCompany] = useState("");
  const [customTitle, setCustomTitle] = useState("");

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
    return "Queued";
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
      if (!append) {
        setSelectedJobIds(new Set());
        setApplyError(null);
      }

      if (persistedQueuedIds.length > 0) {
        setHiddenJobIds((prev) => {
          const next = new Set([...prev, ...persistedQueuedIds]);
          try {
            localStorage.setItem(HIDDEN_BROWSE_JOB_IDS_KEY, JSON.stringify([...next]));
          } catch {}
          return next;
        });
      }
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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HIDDEN_BROWSE_JOB_IDS_KEY);
      if (!raw) return;
      const ids = JSON.parse(raw) as string[];
      setHiddenJobIds(new Set(ids));
    } catch {
      setHiddenJobIds(new Set());
    }
  }, []);

  async function handleApplySelected() {
    if (selectedJobIds.size === 0 || applying) return;

    setApplying(true);
    setApplyError(null);
    try {
      const ids = [...selectedJobIds];
      const results = await Promise.all(
        ids.map(async (jobId) => {
          const res = await fetch(`/api/jobs/${jobId}/queue`, { method: "POST" });
          const payload = await res.json().catch(() => null);
          return { jobId, ok: res.ok || res.status === 409, payload };
        })
      );

      const successfulIds = results.filter((result) => result.ok).map((result) => result.jobId);
      const failed = results.filter((result) => !result.ok);

      if (successfulIds.length > 0) {
        const successfulJobs = jobs.filter((job) => successfulIds.includes(job.id));
        const browserJobs: ApplyLabBrowserJob[] = successfulJobs.map((job) => ({
          id: job.id,
          portal: job.portal ?? "other",
          company: job.company,
          title: job.title,
          location: job.location,
          apply_url: job.application_url || job.url,
          notes: job.jd_summary ?? "",
        }));

        setQueued((prev) => new Set([...prev, ...successfulIds]));
        setHiddenJobIds((prev) => {
          const next = new Set([...prev, ...successfulIds]);
          localStorage.setItem(HIDDEN_BROWSE_JOB_IDS_KEY, JSON.stringify([...next]));
          return next;
        });
        setSelectedJobIds((prev) => {
          const next = new Set(prev);
          for (const id of successfulIds) next.delete(id);
          return next;
        });

        try {
          const existing = JSON.parse(
            localStorage.getItem(APPLY_LAB_BROWSER_JOBS_KEY) ?? "[]"
          ) as ApplyLabBrowserJob[];
          const merged = new Map(existing.map((job) => [job.apply_url, job]));
          for (const job of browserJobs) {
            merged.set(job.apply_url, job);
          }
          localStorage.setItem(
            APPLY_LAB_BROWSER_JOBS_KEY,
            JSON.stringify([...merged.values()])
          );
        } catch {
          localStorage.setItem(APPLY_LAB_BROWSER_JOBS_KEY, JSON.stringify(browserJobs));
        }
      }

      if (failed.length > 0) {
        const firstError = failed[0]?.payload?.error ?? "Failed to queue selected jobs";
        setApplyError(
          failed.length === 1
            ? firstError
            : `${failed.length} jobs could not be added. ${firstError}`
        );
      }

      if (successfulIds.length > 0) {
        router.push("/apply-lab");
      }
    } finally {
      setApplying(false);
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

  function toggleJobSelection(jobId: string) {
    setApplyError(null);
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  }

  function handleAddCustomLink(e: React.FormEvent) {
    e.preventDefault();
    if (!customUrl.trim() || !customCompany.trim() || !customTitle.trim()) return;
    const job: ApplyLabBrowserJob = {
      id: `custom_${Date.now()}`,
      portal: "other",
      company: customCompany.trim(),
      title: customTitle.trim(),
      location: "",
      apply_url: customUrl.trim(),
      notes: "",
    };
    try {
      const existing = JSON.parse(localStorage.getItem(APPLY_LAB_BROWSER_JOBS_KEY) ?? "[]") as ApplyLabBrowserJob[];
      const merged = new Map(existing.map((j) => [j.apply_url, j]));
      merged.set(job.apply_url, job);
      localStorage.setItem(APPLY_LAB_BROWSER_JOBS_KEY, JSON.stringify([...merged.values()]));
    } catch {
      localStorage.setItem(APPLY_LAB_BROWSER_JOBS_KEY, JSON.stringify([job]));
    }
    setCustomUrl(""); setCustomCompany(""); setCustomTitle("");
    setShowCustomForm(false);
    router.push("/apply-lab");
  }

  const hasFilters = selectedIndustries.length > 0 || selectedLevels.length > 0 || remoteOnly || search.length > 0;
  const selectedCount = selectedJobIds.size;
  const hiddenJobs = jobs.filter((job) => hiddenJobIds.has(job.id));
  const nonHiddenJobs = jobs.filter((job) => !hiddenJobIds.has(job.id));
  const visibleJobs = showHiddenJobs ? [...hiddenJobs, ...nonHiddenJobs] : nonHiddenJobs;
  const hiddenCount = jobs.filter((job) => hiddenJobIds.has(job.id)).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-gray-400">
                Browse jobs
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">
                Job Board
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search company or title…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors sm:w-64"
              />
              <button
                type="button"
                onClick={() => setShowCustomForm((v) => !v)}
                className={`flex items-center gap-1.5 h-10 px-3 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap ${
                  showCustomForm
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
                title="Add your own application link"
              >
                <Link className="w-3.5 h-3.5" />
                Add link
              </button>
            </div>
          </div>

          {/* Custom link form */}
          {showCustomForm && (
            <form
              onSubmit={handleAddCustomLink}
              className="border-t border-gray-100 px-5 py-4 bg-indigo-50/40"
            >
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-3">Paste your own application link</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  required
                  placeholder="Application URL"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className="h-9 flex-[2] rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
                <input
                  type="text"
                  required
                  placeholder="Company"
                  value={customCompany}
                  onChange={(e) => setCustomCompany(e.target.value)}
                  className="h-9 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  required
                  placeholder="Role title"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="h-9 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors whitespace-nowrap"
                >
                  Add to Apply Lab
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustomForm(false)}
                  className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-gray-400">
              {total === 0 ? "No jobs found" : `${visibleJobs.length} visible · ${total} total`}
            </p>
            <div className="flex items-center gap-3">
              {hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHiddenJobs((value) => !value)}
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    showHiddenJobs
                      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-800"
                  }`}
                >
                  {showHiddenJobs
                    ? `Showing hidden jobs (${hiddenCount})`
                    : `Reveal hidden jobs (${hiddenCount})`}
                </button>
              )}
              {applyError && (
                <p className="text-xs text-red-500">{applyError}</p>
              )}
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && jobs.length === 0 && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-gray-200 bg-white px-4 py-3 animate-pulse">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-gray-200" />
                      <div className="h-3 w-24 rounded bg-gray-200" />
                      <div className="h-3 w-20 rounded bg-gray-200" />
                    </div>
                    <div className="h-4 w-64 rounded bg-gray-200" />
                    <div className="h-3 w-full rounded bg-gray-200" />
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <div className="h-8 w-20 rounded-lg bg-gray-200" />
                    <div className="h-8 w-24 rounded-lg bg-gray-200" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && visibleJobs.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center space-y-2">
            <p className="text-sm font-medium text-gray-700">No jobs match your filters.</p>
            <p className="text-xs text-gray-400">Try removing some filters or check back later.</p>
          </div>
        )}

        {/* Job cards */}
        {visibleJobs.length > 0 && (
          <div className="space-y-3">
            {visibleJobs.map((job) => {
              const isQueued = queued.has(job.id) || isPersistedQueuedStatus(job.application_status);
              const isSelected = selectedJobIds.has(job.id);
              const isHidden = hiddenJobIds.has(job.id);
              const score = job.match.score;
              const isAutoMatch = score >= 75;
              const isPartialMatch = score >= 50 && score < 75;

              return (
                <div
                  key={job.id}
                  role="button"
                  tabIndex={isQueued ? -1 : 0}
                  onClick={() => {
                    if (!isQueued) toggleJobSelection(job.id);
                  }}
                  onKeyDown={(event) => {
                    if (isQueued) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggleJobSelection(job.id);
                    }
                  }}
                  className={`rounded-2xl border px-4 py-3 transition-colors ${
                    isSelected
                      ? "border-indigo-300 bg-indigo-50"
                      : isHidden
                      ? "border-amber-200 bg-amber-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  } ${isQueued ? "cursor-default" : "cursor-pointer"}`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex flex-1 gap-3">
                      <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
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
                        <span className="text-xs text-gray-400">{job.company}</span>
                        <span className="text-[11px] text-gray-300">•</span>
                        <span className="text-xs text-gray-400">{formatPostedAt(job.posted_at)}</span>
                        {isQueued && (
                          <>
                            <span className="text-[11px] text-gray-300">•</span>
                            <span className="text-[11px] font-medium text-green-600">
                              {queueLabelForStatus(job.application_status)}
                            </span>
                          </>
                        )}
                        {isHidden && showHiddenJobs && (
                          <>
                            <span className="text-[11px] text-gray-300">•</span>
                            <span className="text-[11px] font-medium text-amber-700">
                              Hidden from main list
                            </span>
                          </>
                        )}
                        {!isQueued && isSelected && (
                          <>
                            <span className="text-[11px] text-gray-300">•</span>
                            <span className="text-[11px] font-medium text-indigo-700">
                              Selected for apply
                            </span>
                          </>
                        )}
                      </div>

                      <div className="mt-1.5 flex flex-col gap-1.5">
                        <p className="font-semibold text-gray-900 text-sm leading-snug">{job.title}</p>
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
                        {job.jd_summary && (
                          <p className="text-xs text-gray-500 line-clamp-1">{job.jd_summary}</p>
                        )}
                      </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 lg:pl-4">
                      <a
                        href={job.application_url || job.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                      >
                        Posting
                        <ExternalLink className="h-3 w-3" />
                      </a>
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

      <div className="fixed bottom-6 right-6 z-30">
        <button
          type="button"
          onClick={() => void handleApplySelected()}
          disabled={selectedCount === 0 || applying}
          className={`relative inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold shadow-lg transition-all ${
            selectedCount === 0 || applying
              ? "cursor-not-allowed bg-gray-200 text-gray-500"
              : "bg-indigo-600 text-white hover:-translate-y-0.5 hover:bg-indigo-700"
          }`}
        >
          Apply
          {selectedCount > 0 && (
            <span className="absolute -right-2 -top-2 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-indigo-700 shadow-sm">
              {selectedCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
