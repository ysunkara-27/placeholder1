"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Search, ChevronLeft, ChevronRight, Pencil, Trash2,
  CheckSquare, Square, RefreshCw, Check, AlertTriangle, X,
  ThumbsUp, ThumbsDown, Clock, ExternalLink, ChevronDown, ChevronUp,
  Inbox, List,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Job {
  id: string;
  company: string;
  title: string;
  status: string;
  level: string;
  location: string;
  remote: boolean;
  portal: string | null;
  canonical_url: string | null;
  url: string | null;
  application_url: string | null;
  jd_summary: string | null;
  industries: string[];
  posted_at: string;
  first_seen_at: string | null;
  last_seen_at: string | null;
}

interface Stats {
  total: number;
  pending: number;
  active: number;
  paused: number;
  closed: number;
  null_canonical: number;
}

const PORTALS = [
  "greenhouse", "lever", "workday", "handshake",
  "linkedin", "indeed", "icims", "smartrecruiters",
  "company_website", "other",
];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  active: "bg-green-100 text-green-700 border-green-200",
  paused: "bg-yellow-100 text-yellow-700 border-yellow-200",
  closed: "bg-red-100 text-red-700 border-red-200",
};

function relativeTime(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Review Queue ─────────────────────────────────────────────────────────────

function ReviewQueue({
  showToast,
}: {
  showToast: (text: string, ok?: boolean) => void;
}) {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Job | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [jdExpanded, setJdExpanded] = useState(false);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/jobs?status=pending&limit=100&page=1");
      const data = await res.json();
      const list: Job[] = data.jobs ?? [];
      setJobs(list);
      setTotal(data.total ?? 0);
      // Auto-select first item
      if (list.length > 0 && !selected) setSelected(list[0]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void fetchPending(); }, [fetchPending]);

  async function act(action: "approve" | "reject", jobId: string) {
    setProcessing(jobId);
    const res = await fetch("/api/admin/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, jobIds: [jobId] }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error ?? "Failed", false);
      setProcessing(null);
      return;
    }
    showToast(action === "approve" ? "Approved — job is now live" : "Rejected — job closed");
    setProcessing(null);
    // Remove from list, advance to next
    setJobs((prev) => {
      const idx = prev.findIndex((j) => j.id === jobId);
      const next = prev.filter((j) => j.id !== jobId);
      const nextSelected = next[idx] ?? next[idx - 1] ?? null;
      setSelected(nextSelected);
      return next;
    });
    setTotal((t) => t - 1);
  }

  const currentIdx = selected ? jobs.findIndex((j) => j.id === selected.id) : -1;

  function navigate(dir: -1 | 1) {
    const next = jobs[currentIdx + dir];
    if (next) {
      setSelected(next);
      setJdExpanded(false);
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!selected) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "a" || e.key === "A") void act("approve", selected.id);
      if (e.key === "r" || e.key === "R") void act("reject", selected.id);
      if (e.key === "ArrowDown" || e.key === "j") navigate(1);
      if (e.key === "ArrowUp" || e.key === "k") navigate(-1);
      if (e.key === "e" || e.key === "E") router.push(`/admin/jobs/${selected.id}`);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, currentIdx, jobs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Loading pending jobs…
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
          <Check className="w-6 h-6 text-green-600" />
        </div>
        <p className="text-gray-700 font-medium">All caught up</p>
        <p className="text-gray-400 text-sm">No pending jobs to review</p>
      </div>
    );
  }

  return (
    <div className="flex gap-0 h-[calc(100vh-140px)] overflow-hidden rounded-xl border border-gray-100 bg-white">
      {/* Left: job list */}
      <div className="w-80 flex-shrink-0 border-r border-gray-100 overflow-y-auto">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Inbox · {total} pending
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">↑↓ navigate · A approve · R reject · E edit</p>
        </div>
        <div className="divide-y divide-gray-50">
          {jobs.map((job, idx) => (
            <button
              key={job.id}
              onClick={() => { setSelected(job); setJdExpanded(false); }}
              className={cn(
                "w-full text-left px-4 py-3 transition-colors",
                selected?.id === job.id
                  ? "bg-indigo-50 border-l-2 border-indigo-500"
                  : "hover:bg-gray-50 border-l-2 border-transparent"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{job.company}</p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{job.title}</p>
                </div>
                <span className="text-[10px] text-gray-400 whitespace-nowrap mt-0.5 flex-shrink-0">
                  #{idx + 1}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-[10px] text-gray-400">{job.level}</span>
                <span className="text-[10px] text-gray-300">·</span>
                <span className="text-[10px] text-gray-400 truncate">{job.location}</span>
                {job.remote && (
                  <>
                    <span className="text-[10px] text-gray-300">·</span>
                    <span className="text-[10px] text-indigo-500">Remote</span>
                  </>
                )}
              </div>
              <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {relativeTime(job.first_seen_at)}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Right: detail pane */}
      {selected ? (
        <div className="flex-1 overflow-y-auto">
          {/* Detail header */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{selected.company}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{selected.title}</p>
              </div>
              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => navigate(-1)}
                  disabled={currentIdx === 0}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 disabled:opacity-30 hover:bg-gray-50 transition-colors"
                  title="Previous (↑)"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigate(1)}
                  disabled={currentIdx === jobs.length - 1}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 disabled:opacity-30 hover:bg-gray-50 transition-colors"
                  title="Next (↓)"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  onClick={() => router.push(`/admin/jobs/${selected.id}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                  title="Edit (E)"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => void act("reject", selected.id)}
                  disabled={processing === selected.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  title="Reject (R)"
                >
                  <ThumbsDown className="w-3.5 h-3.5" /> Reject
                </button>
                <button
                  onClick={() => void act("approve", selected.id)}
                  disabled={processing === selected.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-xs font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  title="Approve (A)"
                >
                  <ThumbsUp className="w-3.5 h-3.5" /> Approve
                </button>
              </div>
            </div>
          </div>

          {/* Detail body */}
          <div className="px-6 py-5 space-y-5">
            {/* Meta grid */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Level", value: selected.level },
                { label: "Portal", value: selected.portal ?? "—" },
                { label: "Location", value: selected.location },
                { label: "Remote", value: selected.remote ? "Yes" : "No" },
                { label: "Industries", value: selected.industries?.join(", ") || "—" },
                { label: "Posted", value: selected.posted_at ? new Date(selected.posted_at).toLocaleDateString() : "—" },
                { label: "First seen", value: relativeTime(selected.first_seen_at) },
                { label: "Last seen", value: relativeTime(selected.last_seen_at) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-lg px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
                  <p className="text-sm text-gray-700 mt-0.5 truncate" title={value ?? ""}>{value}</p>
                </div>
              ))}
            </div>

            {/* URLs */}
            <div className="space-y-2">
              {[
                { label: "Job URL", val: selected.url },
                { label: "Apply URL", val: selected.application_url },
                { label: "Canonical URL", val: selected.canonical_url },
              ].map(({ label, val }) => val && (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-400 w-28 flex-shrink-0">{label}</span>
                  <a
                    href={val}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-600 hover:underline truncate flex items-center gap-1"
                  >
                    {val.replace(/^https?:\/\//, "").slice(0, 60)}
                    {val.length > 60 && "…"}
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                </div>
              ))}
            </div>

            {/* JD summary */}
            {selected.jd_summary && (
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => setJdExpanded((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span className="text-xs font-semibold text-gray-600">Job Description Summary</span>
                  {jdExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                </button>
                {jdExpanded && (
                  <div className="px-4 py-4 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {selected.jd_summary}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          Select a job to review
        </div>
      )}
    </div>
  );
}

// ─── All Jobs Table ────────────────────────────────────────────────────────────

function AllJobsTable({
  stats,
  showToast,
  onStatsChange,
}: {
  stats: Stats | null;
  showToast: (text: string, ok?: boolean) => void;
  onStatsChange: (s: Stats) => void;
}) {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [portalFilter, setPortalFilter] = useState("");
  const [missingFilter, setMissingFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const LIMIT = 50;
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchJobs = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        page: String(p),
        limit: String(LIMIT),
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
        ...(portalFilter && { portal: portalFilter }),
        ...(missingFilter && { missing: missingFilter }),
      });
      const res = await fetch(`/api/admin/jobs?${q}`);
      const data = await res.json();
      setJobs(data.jobs ?? []);
      setTotal(data.total ?? 0);
      if (data.stats) onStatsChange(data.stats);
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, statusFilter, portalFilter, missingFilter]);

  useEffect(() => { void fetchJobs(page); }, [page]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setPage(1);
      void fetchJobs(1);
    }, 350);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [search, statusFilter, portalFilter, missingFilter]);

  async function bulkAction(action: "fix_canonical" | "set_status" | "delete") {
    const jobIds = action === "fix_canonical" ? undefined : [...selected];
    if (action !== "fix_canonical" && !jobIds?.length) return;
    if (action === "delete" && !confirm(`Delete ${jobIds!.length} job(s)?`)) return;
    const res = await fetch("/api/admin/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, jobIds, status: bulkStatus || undefined }),
    });
    const data = await res.json();
    res.ok ? showToast(`Done — ${data.affected} affected`) : showToast(data.error ?? "Failed", false);
    void fetchJobs(page);
  }

  async function deleteOne(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    const res = await fetch(`/api/admin/jobs/${id}`, { method: "DELETE" });
    res.ok ? showToast("Deleted") : showToast("Delete failed", false);
    void fetchJobs(page);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(selected.size === jobs.length ? new Set() : new Set(jobs.map((j) => j.id)));
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company or title…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="closed">Closed</option>
        </select>
        <select value={portalFilter} onChange={(e) => { setPortalFilter(e.target.value); setPage(1); }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All portals</option>
          {PORTALS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={missingFilter} onChange={(e) => { setMissingFilter(e.target.value); setPage(1); }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">No field filter</option>
          <option value="canonical_url">Missing canonical_url</option>
        </select>
        <button
          onClick={() => void bulkAction("fix_canonical")}
          className="text-sm font-medium px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors whitespace-nowrap"
        >
          Fix all NULL canonical_urls
        </button>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-2.5">
          <span className="text-sm font-medium text-indigo-800">{selected.size} selected</span>
          <div className="flex items-center gap-2 ml-auto">
            <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}
              className="text-sm border border-indigo-200 rounded-lg px-2 py-1 bg-white focus:outline-none">
              <option value="">Set status…</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="closed">Closed</option>
            </select>
            <button onClick={() => void bulkAction("set_status")} disabled={!bulkStatus}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-700 transition-colors">
              Apply
            </button>
            <button onClick={() => void bulkAction("delete")}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors">
              Delete selected
            </button>
            <button onClick={() => setSelected(new Set())} className="text-indigo-500 hover:text-indigo-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="w-10 px-3 py-3">
                <button onClick={toggleAll} className="text-gray-400 hover:text-gray-600">
                  {selected.size === jobs.length && jobs.length > 0
                    ? <CheckSquare className="w-4 h-4" />
                    : <Square className="w-4 h-4" />}
                </button>
              </th>
              {["Company", "Title", "Status", "Portal", "Level", "Location", "canonical_url", "First seen", "Posted"].map((h) => (
                <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
              <th className="w-20 px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={11} className="text-center py-12 text-gray-400 text-sm">Loading…</td></tr>
            ) : jobs.length === 0 ? (
              <tr><td colSpan={11} className="text-center py-12 text-gray-400 text-sm">No jobs found</td></tr>
            ) : jobs.map((job) => (
              <tr
                key={job.id}
                onClick={() => router.push(`/admin/jobs/${job.id}`)}
                className={cn(
                  "cursor-pointer hover:bg-indigo-50/40 transition-colors",
                  selected.has(job.id) && "bg-indigo-50/60"
                )}
              >
                <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => toggleSelect(job.id)} className="text-gray-400 hover:text-indigo-600">
                    {selected.has(job.id)
                      ? <CheckSquare className="w-4 h-4 text-indigo-600" />
                      : <Square className="w-4 h-4" />}
                  </button>
                </td>
                <td className="px-3 py-3 font-medium text-gray-900 max-w-[140px] truncate">{job.company}</td>
                <td className="px-3 py-3 text-gray-600 max-w-[180px] truncate">{job.title}</td>
                <td className="px-3 py-3">
                  <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium border", STATUS_COLORS[job.status] ?? "bg-gray-100 text-gray-600")}>
                    {job.status}
                  </span>
                </td>
                <td className="px-3 py-3 text-gray-500 text-xs">{job.portal ?? "—"}</td>
                <td className="px-3 py-3 text-gray-500 text-xs">{job.level}</td>
                <td className="px-3 py-3 text-gray-500 text-xs max-w-[120px] truncate">{job.location}</td>
                <td className="px-3 py-3">
                  {job.canonical_url
                    ? <span className="text-xs text-gray-400 max-w-[160px] truncate block" title={job.canonical_url}>{job.canonical_url.replace(/^https?:\/\//, "").slice(0, 40)}</span>
                    : <span className="text-xs font-semibold text-red-500">MISSING</span>}
                </td>
                <td className="px-3 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {relativeTime(job.first_seen_at)}
                </td>
                <td className="px-3 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {new Date(job.posted_at).toLocaleDateString()}
                </td>
                <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => router.push(`/admin/jobs/${job.id}`)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => void deleteOne(job.id, `${job.company} — ${job.title}`)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{total.toLocaleString()} jobs total</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 rounded-lg border border-gray-200 bg-white font-medium text-gray-700">
              {page} / {totalPages}
            </span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [tab, setTab] = useState<"review" | "all">("review");
  const [stats, setStats] = useState<Stats | null>(null);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  function showToast(text: string, ok = true) {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 3000);
  }

  // Fetch stats once on mount
  useEffect(() => {
    fetch("/api/admin/jobs?page=1&limit=1")
      .then((r) => r.json())
      .then((d) => { if (d.stats) setStats(d.stats); })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg",
          toast.ok ? "bg-green-600 text-white" : "bg-red-600 text-white"
        )}>
          {toast.ok ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-screen-xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Admin</h1>
              <p className="text-xs text-gray-400 mt-0.5">Job postings management</p>
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-6 gap-3 mb-4">
              {[
                { label: "Total", value: stats.total, color: "text-gray-900" },
                { label: "Pending", value: stats.pending, color: stats.pending > 0 ? "text-amber-600" : "text-gray-400" },
                { label: "Active", value: stats.active, color: "text-green-700" },
                { label: "Paused", value: stats.paused, color: "text-yellow-700" },
                { label: "Closed", value: stats.closed, color: "text-red-700" },
                {
                  label: "Missing canonical",
                  value: stats.null_canonical,
                  color: stats.null_canonical > 0 ? "text-red-600" : "text-gray-400",
                },
              ].map((s) => (
                <div key={s.label} className="bg-gray-50 rounded-xl border border-gray-100 px-4 py-3">
                  <p className="text-xs text-gray-400 font-medium">{s.label}</p>
                  <p className={cn("text-xl font-bold mt-0.5", s.color)}>{s.value.toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTab("review")}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                tab === "review"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-500 hover:bg-gray-100"
              )}
            >
              <Inbox className="w-3.5 h-3.5" />
              Review queue
              {stats && stats.pending > 0 && (
                <span className={cn(
                  "ml-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold px-1",
                  tab === "review" ? "bg-white/25 text-white" : "bg-amber-500 text-white"
                )}>
                  {stats.pending}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab("all")}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                tab === "all"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-500 hover:bg-gray-100"
              )}
            >
              <List className="w-3.5 h-3.5" />
              All jobs
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 py-6">
        {tab === "review" && (
          <ReviewQueue showToast={showToast} />
        )}
        {tab === "all" && (
          <AllJobsTable
            stats={stats}
            showToast={showToast}
            onStatsChange={setStats}
          />
        )}
      </div>
    </div>
  );
}
