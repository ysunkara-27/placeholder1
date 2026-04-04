"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Search, ChevronLeft, ChevronRight, Pencil, Trash2,
  CheckSquare, Square, RefreshCw, Check, AlertTriangle, X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Job {
  id: string;
  company: string;
  title: string;
  status: string;
  level: string;
  location: string;
  portal: string | null;
  canonical_url: string | null;
  posted_at: string;
  industries: string[];
  remote: boolean;
}

interface Stats {
  total: number;
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
  active: "bg-green-100 text-green-700 border-green-200",
  paused: "bg-yellow-100 text-yellow-700 border-yellow-200",
  closed: "bg-red-100 text-red-700 border-red-200",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [portalFilter, setPortalFilter] = useState("");
  const [missingFilter, setMissingFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
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
      setStats(data.stats ?? null);
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
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

  function showToast(text: string, ok = true) {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 3000);
  }

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
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Admin</h1>
            <p className="text-xs text-gray-400 mt-0.5">Job postings management — click a row or the pencil to edit</p>
          </div>
          <button
            onClick={() => void fetchJobs(page)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 py-6 space-y-5">

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: "Total", value: stats.total, color: "text-gray-900" },
              { label: "Active", value: stats.active, color: "text-green-700" },
              { label: "Paused", value: stats.paused, color: "text-yellow-700" },
              { label: "Closed", value: stats.closed, color: "text-red-700" },
              {
                label: "Missing canonical_url",
                value: stats.null_canonical,
                color: stats.null_canonical > 0 ? "text-red-600" : "text-gray-400",
              },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-xs text-gray-400 font-medium">{s.label}</p>
                <p className={cn("text-2xl font-bold mt-0.5", s.color)}>{s.value.toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}

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
                {["Company", "Title", "Status", "Portal", "Level", "Location", "canonical_url", "Posted"].map((h) => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
                <th className="w-20 px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={10} className="text-center py-12 text-gray-400 text-sm">Loading…</td></tr>
              ) : jobs.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12 text-gray-400 text-sm">No jobs found</td></tr>
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
    </div>
  );
}
