"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
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

  const hasFilters = selectedIndustries.length > 0 || selectedLevels.length > 0 || remoteOnly || search.length > 0;
  const selectedCount = selectedJobIds.size;
  const hiddenJobs = jobs.filter((job) => hiddenJobIds.has(job.id));
  const nonHiddenJobs = jobs.filter((job) => !hiddenJobIds.has(job.id));
  const visibleJobs = showHiddenJobs ? [...hiddenJobs, ...nonHiddenJobs] : nonHiddenJobs;
  const hiddenCount = jobs.filter((job) => hiddenJobIds.has(job.id)).length;

  return (
    <div className="min-h-screen bg-canvas bg-dot-warm">
      <main className="max-w-5xl mx-auto px-6 py-8 space-y-5">
        <div className="rounded-2xl border border-rim bg-white shadow-soft-card overflow-hidden">
          <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-dim">
                Browse jobs
              </p>
              <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink" style={{ fontVariationSettings: '"opsz" 28, "SOFT" 0' }}>
                Job Board
              </h1>
            </div>
            <input
              type="text"
              placeholder="Search company or title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-lg border border-rim bg-white px-3 text-sm text-ink placeholder:text-dim/60 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/50 transition-colors sm:w-64"
            />
          </div>
        </div>

        {/* Filter bar */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[10px] font-semibold text-dim uppercase tracking-[0.2em] mr-1">Industries</span>
            {INDUSTRY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleIndustry(opt.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  selectedIndustries.includes(opt.value)
                    ? "bg-accent text-white shadow-warm"
                    : "bg-white border border-rim text-dim hover:border-accent/50 hover:text-ink"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[10px] font-semibold text-dim uppercase tracking-[0.2em] mr-1">Level</span>
            {LEVEL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleLevel(opt.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  selectedLevels.includes(opt.value)
                    ? "bg-accent text-white shadow-warm"
                    : "bg-white border border-rim text-dim hover:border-accent/50 hover:text-ink"
                }`}
              >
                {opt.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setRemoteOnly((v) => !v)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                remoteOnly
                  ? "bg-accent text-white shadow-warm"
                  : "bg-white border border-rim text-dim hover:border-accent/50 hover:text-ink"
              }`}
            >
              Remote only
            </button>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-full px-3 py-1 text-xs font-medium text-accent/80 border border-accent/30 hover:bg-accent-wash transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Results count */}
        {!loading && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-dim">
              {total === 0 ? "No jobs found" : `${visibleJobs.length} visible · ${total} total`}
            </p>
            <div className="flex items-center gap-3">
              {hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHiddenJobs((value) => !value)}
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    showHiddenJobs
                      ? "border-accent/30 bg-accent-wash text-accent"
                      : "border-rim bg-white text-dim hover:border-accent/30 hover:text-ink"
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
              <div key={i} className="rounded-2xl border border-rim bg-white px-4 py-3.5 animate-pulse">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-surface-strong" />
                      <div className="h-2.5 w-24 rounded-full bg-surface-strong" />
                      <div className="h-2.5 w-16 rounded-full bg-surface-strong" />
                    </div>
                    <div className="h-4 w-56 rounded-full bg-surface" />
                    <div className="h-2.5 w-full rounded-full bg-surface" />
                  </div>
                  <div className="h-8 w-20 rounded-lg bg-surface shrink-0" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && visibleJobs.length === 0 && (
          <div className="rounded-2xl border border-rim bg-white px-6 py-14 text-center space-y-2">
            <p className="text-sm font-medium text-ink">No jobs match your filters.</p>
            <p className="text-xs text-dim">Try removing some filters or check back later.</p>
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

              const delayClass = ["delay-0","delay-50","delay-100","delay-150","delay-200","delay-250","delay-300"][Math.min(visibleJobs.indexOf(job), 6)] ?? "delay-300";

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
                  className={`animate-rise ${delayClass} rounded-2xl border px-4 py-3.5 transition-colors shadow-soft-card ${
                    isSelected
                      ? "border-accent/40 bg-accent-wash"
                      : isHidden
                      ? "border-amber-200 bg-amber-50/60"
                      : "border-rim bg-white hover:border-accent/30 hover:shadow-warm"
                  } ${isQueued ? "cursor-default" : "cursor-pointer"}`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex flex-1 gap-3">
                      <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                            isAutoMatch ? "bg-accent" : isPartialMatch ? "bg-amber-400" : "bg-rim"
                          }`}
                        />
                        {isAutoMatch ? (
                          <span className="text-[11px] font-medium text-accent">Auto-match</span>
                        ) : (
                          <span className="text-[11px] font-medium text-dim">{score}</span>
                        )}
                        <span className="text-xs text-dim">{job.company}</span>
                        <span className="text-[11px] text-rim">•</span>
                        <span className="text-xs text-dim">{formatPostedAt(job.posted_at)}</span>
                        {isQueued && (
                          <>
                            <span className="text-[11px] text-rim">•</span>
                            <span className="text-[11px] font-medium text-accent">
                              {queueLabelForStatus(job.application_status)}
                            </span>
                          </>
                        )}
                        {isHidden && showHiddenJobs && (
                          <>
                            <span className="text-[11px] text-rim">•</span>
                            <span className="text-[11px] font-medium text-amber-700">
                              Hidden from main list
                            </span>
                          </>
                        )}
                        {!isQueued && isSelected && (
                          <>
                            <span className="text-[11px] text-rim">•</span>
                            <span className="text-[11px] font-medium text-accent">
                              Selected for apply
                            </span>
                          </>
                        )}
                      </div>

                      <div className="mt-1.5 flex flex-col gap-1.5">
                        <p className="font-semibold text-ink text-sm leading-snug">{job.title}</p>
                        <div className="flex flex-wrap gap-1.5 items-center">
                          <span className="text-xs text-dim">{job.location}</span>
                          {job.remote && (
                            <span className="rounded-full bg-accent-wash text-accent border border-accent/20 px-2 py-0.5 text-[10px] font-medium">Remote</span>
                          )}
                          <span className="rounded-full bg-surface text-dim border border-rim px-2 py-0.5 text-[10px] font-medium">{job.level}</span>
                          {job.portal && (
                            <span className="rounded-full bg-surface text-dim border border-rim px-2 py-0.5 text-[10px] font-medium">{job.portal}</span>
                          )}
                        </div>
                        {job.jd_summary && (
                          <p className="text-xs text-dim line-clamp-1">{job.jd_summary}</p>
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
                        className="inline-flex items-center gap-1 rounded-lg border border-rim bg-white px-3 py-1.5 text-xs font-medium text-dim hover:border-accent/30 hover:bg-surface transition-colors"
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
              className="rounded-full border border-rim bg-white px-6 py-2 text-sm text-dim hover:border-accent/30 hover:bg-surface transition-colors"
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
          className={`relative inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold shadow-warm transition-all ${
            selectedCount === 0 || applying
              ? "cursor-not-allowed bg-surface text-dim border border-rim"
              : "bg-accent text-white hover:-translate-y-0.5 hover:bg-accent/90 shadow-warm-xl"
          }`}
        >
          Apply
          {selectedCount > 0 && (
            <span className="absolute -right-2 -top-2 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-accent shadow-sm border border-accent/20">
              {selectedCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
