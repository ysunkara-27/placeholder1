"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Search, ChevronLeft, ChevronRight, Pencil, Trash2,
  CheckSquare, Square, RefreshCw, X, Check, AlertTriangle,
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
  url: string;
  application_url: string;
  canonical_url: string | null;
  canonical_application_url: string | null;
  portal: string | null;
  jd_summary: string | null;
  is_early_career: boolean;
  role_family: string | null;
  experience_band: string | null;
  industries: string[];
  posted_at: string;
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
  const [editJob, setEditJob] = useState<Job | null>(null);
  const [bulkStatus, setBulkStatus] = useState("");
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null);
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

  // Debounce search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setPage(1);
      void fetchJobs(1);
    }, 350);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [search, statusFilter, portalFilter, missingFilter]);

  function flash(text: string, ok = true) {
    setActionMsg({ text, ok });
    setTimeout(() => setActionMsg(null), 3000);
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
    if (res.ok) {
      flash(`Done — ${data.affected} job(s) affected`);
      void fetchJobs(page);
    } else {
      flash(data.error ?? "Failed", false);
    }
  }

  async function saveEdit(updated: Job) {
    const res = await fetch(`/api/admin/jobs/${updated.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    if (res.ok) {
      flash("Saved");
      setEditJob(null);
      void fetchJobs(page);
    } else {
      const d = await res.json();
      flash(d.error ?? "Save failed", false);
    }
  }

  async function deleteOne(id: string) {
    if (!confirm("Delete this job?")) return;
    const res = await fetch(`/api/admin/jobs/${id}`, { method: "DELETE" });
    if (res.ok) {
      flash("Deleted");
      void fetchJobs(page);
    } else {
      flash("Delete failed", false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(
      selected.size === jobs.length ? new Set() : new Set(jobs.map((j) => j.id))
    );
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Admin</h1>
            <p className="text-xs text-gray-400 mt-0.5">Job postings management</p>
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

        {/* Flash message */}
        {actionMsg && (
          <div className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium",
            actionMsg.ok
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          )}>
            {actionMsg.ok ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {actionMsg.text}
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: "Total", value: stats.total, color: "text-gray-900" },
              { label: "Active", value: stats.active, color: "text-green-700" },
              { label: "Paused", value: stats.paused, color: "text-yellow-700" },
              { label: "Closed", value: stats.closed, color: "text-red-700" },
              { label: "Missing canonical_url", value: stats.null_canonical, color: stats.null_canonical > 0 ? "text-red-600" : "text-gray-400" },
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
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="closed">Closed</option>
          </select>
          <select
            value={portalFilter}
            onChange={(e) => { setPortalFilter(e.target.value); setPage(1); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All portals</option>
            {PORTALS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={missingFilter}
            onChange={(e) => { setMissingFilter(e.target.value); setPage(1); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
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

        {/* Bulk actions (visible when rows selected) */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-2.5">
            <span className="text-sm font-medium text-indigo-800">{selected.size} selected</span>
            <div className="flex items-center gap-2 ml-auto">
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="text-sm border border-indigo-200 rounded-lg px-2 py-1 bg-white focus:outline-none"
              >
                <option value="">Set status…</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="closed">Closed</option>
              </select>
              <button
                onClick={() => void bulkAction("set_status")}
                disabled={!bulkStatus}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-700 transition-colors"
              >
                Apply
              </button>
              <button
                onClick={() => void bulkAction("delete")}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
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
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Company</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Portal</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Level</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">canonical_url</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Posted</th>
                <th className="w-20 px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-gray-400 text-sm">Loading…</td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-gray-400 text-sm">No jobs found</td>
                </tr>
              ) : jobs.map((job) => (
                <tr
                  key={job.id}
                  className={cn(
                    "hover:bg-gray-50 transition-colors",
                    selected.has(job.id) && "bg-indigo-50/40"
                  )}
                >
                  <td className="px-3 py-3">
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
                    {job.canonical_url ? (
                      <span className="text-xs text-gray-400 max-w-[160px] truncate block" title={job.canonical_url}>
                        {job.canonical_url.replace(/^https?:\/\//, "").slice(0, 40)}
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-red-500">MISSING</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(job.posted_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => setEditJob({ ...job })}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => void deleteOne(job.id)}
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
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 rounded-lg border border-gray-200 bg-white font-medium text-gray-700">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editJob && (
        <EditModal
          job={editJob}
          onChange={setEditJob}
          onSave={() => void saveEdit(editJob)}
          onClose={() => setEditJob(null)}
        />
      )}
    </div>
  );
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

function EditModal({
  job,
  onChange,
  onSave,
  onClose,
}: {
  job: Job;
  onChange: (j: Job) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  function set(key: keyof Job, value: unknown) {
    onChange({ ...job, [key]: value });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Edit job</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Company">
              <input className={inputCls} value={job.company} onChange={(e) => set("company", e.target.value)} />
            </Field>
            <Field label="Title">
              <input className={inputCls} value={job.title} onChange={(e) => set("title", e.target.value)} />
            </Field>
            <Field label="Status">
              <select className={inputCls} value={job.status} onChange={(e) => set("status", e.target.value)}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="closed">Closed</option>
              </select>
            </Field>
            <Field label="Portal">
              <select className={inputCls} value={job.portal ?? ""} onChange={(e) => set("portal", e.target.value || null)}>
                <option value="">— none —</option>
                {PORTALS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Level">
              <input className={inputCls} value={job.level} onChange={(e) => set("level", e.target.value)} />
            </Field>
            <Field label="Location">
              <input className={inputCls} value={job.location} onChange={(e) => set("location", e.target.value)} />
            </Field>
            <Field label="Role family">
              <input className={inputCls} value={job.role_family ?? ""} onChange={(e) => set("role_family", e.target.value || null)} />
            </Field>
            <Field label="Experience band">
              <input className={inputCls} value={job.experience_band ?? ""} onChange={(e) => set("experience_band", e.target.value || null)} />
            </Field>
          </div>

          <Field label="URL">
            <input className={inputCls} value={job.url} onChange={(e) => set("url", e.target.value)} />
          </Field>
          <Field label="Application URL">
            <input className={inputCls} value={job.application_url} onChange={(e) => set("application_url", e.target.value)} />
          </Field>
          <Field label="canonical_url">
            <input className={inputCls} value={job.canonical_url ?? ""} onChange={(e) => set("canonical_url", e.target.value || null)} />
          </Field>
          <Field label="Industries (comma-separated)">
            <input
              className={inputCls}
              value={job.industries?.join(", ") ?? ""}
              onChange={(e) => set("industries", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
            />
          </Field>
          <Field label="JD summary">
            <textarea
              className={cn(inputCls, "resize-none")}
              rows={4}
              value={job.jd_summary ?? ""}
              onChange={(e) => set("jd_summary", e.target.value || null)}
            />
          </Field>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={job.remote}
                onChange={(e) => set("remote", e.target.checked)}
                className="rounded"
              />
              Remote
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={job.is_early_career}
                onChange={(e) => set("is_early_career", e.target.checked)}
                className="rounded"
              />
              Early career
            </label>
          </div>
        </div>

        {/* Modal footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      {children}
    </div>
  );
}
