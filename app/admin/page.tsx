"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Search, ChevronLeft, ChevronRight, Pencil, Trash2,
  CheckSquare, Square, RefreshCw, Check, AlertTriangle, X,
  ThumbsUp, ThumbsDown, Clock, ExternalLink, ChevronDown, ChevronUp,
  Inbox, List, Sparkles, ArrowRight, Loader2,
} from "lucide-react";

export const dynamic = "force-dynamic";

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
  target_term: string | null;
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

const LEVELS = ["internship", "new_grad", "co_op", "associate", "part_time"];
const TERM_OPTIONS = [
  "2026 Summer", "2026 Fall", "2026 Winter", "2026 Spring",
  "2027 Summer", "2027 Fall", "2027 Winter", "2027 Spring",
  "New Grad 2026", "New Grad 2027",
  "Full Time",
  "Co-op Summer 2026", "Co-op Fall 2026", "Co-op Spring 2026",
  "Co-op Summer 2027", "Co-op Fall 2027",
];

const inp =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors";

type Suggestions = Partial<Pick<Job, "company" | "title" | "level" | "location" | "industries" | "target_term" | "jd_summary">>;

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

  // Per-job draft edits — persist across navigation within session
  const [drafts, setDrafts] = useState<Record<string, Partial<Job>>>({});
  // Per-job AI suggestions — keyed by job ID, survive navigation
  const [allSuggestions, setAllSuggestions] = useState<Record<string, Suggestions>>({});
  // Jobs currently being normalized in the background
  const [normalizing, setNormalizing] = useState<Set<string>>(new Set());
  const [customTermOpen, setCustomTermOpen] = useState<Record<string, boolean>>({});
  const [processing, setProcessing] = useState<string | null>(null);

  const draft = selected ? (drafts[selected.id] ?? {}) : {};
  const current = selected ? { ...selected, ...draft } : null;
  const isDirty = Object.keys(draft).length > 0;
  const suggestions = selected ? (allSuggestions[selected.id] ?? null) : null;

  function patch<K extends keyof Job>(key: K, val: Job[K]) {
    if (!selected) return;
    setDrafts((prev) => ({
      ...prev,
      [selected.id]: { ...(prev[selected.id] ?? {}), [key]: val },
    }));
  }

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/jobs?status=pending&limit=100&page=1");
      const data = await res.json();
      const list: Job[] = data.jobs ?? [];
      setJobs(list);
      setTotal(data.total ?? 0);
      if (list.length > 0 && !selected) setSelected(list[0]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void fetchPending(); }, [fetchPending]);

  async function approve(jobId: string) {
    setProcessing(jobId);
    // Save edits first if any
    if (isDirty) {
      const patchRes = await fetch(`/api/admin/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!patchRes.ok) {
        const d = await patchRes.json().catch(() => ({})) as { error?: string };
        showToast(d.error ?? "Save failed", false);
        setProcessing(null);
        return;
      }
    }
    const res = await fetch("/api/admin/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", jobIds: [jobId] }),
    });
    const data = await res.json() as { error?: string };
    if (!res.ok) {
      showToast(data.error ?? "Failed", false);
      setProcessing(null);
      return;
    }
    showToast("Approved — job is now live");
    setProcessing(null);
    advance(jobId);
  }

  async function reject(jobId: string) {
    setProcessing(jobId);
    const res = await fetch("/api/admin/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", jobIds: [jobId] }),
    });
    const data = await res.json() as { error?: string };
    if (!res.ok) {
      showToast(data.error ?? "Failed", false);
      setProcessing(null);
      return;
    }
    showToast("Rejected");
    setProcessing(null);
    advance(jobId);
  }

  function advance(jobId: string) {
    setJobs((prev) => {
      const idx = prev.findIndex((j) => j.id === jobId);
      const next = prev.filter((j) => j.id !== jobId);
      setSelected(next[idx] ?? next[idx - 1] ?? null);
      return next;
    });
    setTotal((t) => t - 1);
  }

  function cleanWithAI(jobId: string, job: typeof current) {
    if (!job || normalizing.has(jobId)) return;
    // Clear any old suggestions and mark as in-flight — then fire and forget
    setAllSuggestions((prev) => { const n = { ...prev }; delete n[jobId]; return n; });
    setNormalizing((prev) => new Set([...prev, jobId]));
    fetch("/api/admin/jobs/normalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company: job.company,
        title: job.title,
        level: job.level,
        location: job.location,
        industries: job.industries ?? [],
        target_term: job.target_term ?? null,
        jd_summary: job.jd_summary ?? null,
        job_url: job.url || job.application_url || null,
      }),
    })
      .then((res) => res.json() as Promise<{ suggestions?: Suggestions; error?: string }>)
      .then((data) => {
        if (data.error) { showToast(data.error, false); return; }
        const nextSuggestions = { ...(data.suggestions ?? {}) };
        let autofilledDescription = false;

        if (!job.jd_summary && typeof nextSuggestions.jd_summary === "string" && nextSuggestions.jd_summary.trim()) {
          setDrafts((prev) => ({
            ...prev,
            [jobId]: { ...(prev[jobId] ?? {}), jd_summary: nextSuggestions.jd_summary as string },
          }));
          delete nextSuggestions.jd_summary;
          autofilledDescription = true;
        }

        if (Object.keys(nextSuggestions).length === 0) {
          showToast(autofilledDescription ? "Description auto-filled" : "Looks good — no changes suggested");
        } else {
          setAllSuggestions((prev) => ({ ...prev, [jobId]: nextSuggestions }));
          showToast(autofilledDescription ? "Description auto-filled; AI suggestions ready" : "AI suggestions ready");
        }
      })
      .catch(() => showToast("AI failed", false))
      .finally(() => {
        setNormalizing((prev) => {
          const n = new Set(prev);
          n.delete(jobId);
          return n;
        });
      });
  }

  function acceptSuggestion(key: keyof Suggestions) {
    if (!selected || !suggestions?.[key]) return;
    patch(key as keyof Job, suggestions[key] as Job[keyof Job]);
    setAllSuggestions((prev) => {
      const next = { ...prev[selected.id] };
      delete next[key];
      return Object.keys(next).length === 0
        ? (({ [selected.id]: _, ...rest }) => rest)(prev)
        : { ...prev, [selected.id]: next };
    });
  }

  function acceptAllSuggestions() {
    if (!selected || !suggestions) return;
    for (const [key, val] of Object.entries(suggestions)) {
      patch(key as keyof Job, val as Job[keyof Job]);
    }
    setAllSuggestions((prev) => (({ [selected.id]: _, ...rest }) => rest)(prev));
  }

  const currentIdx = selected ? jobs.findIndex((j) => j.id === selected.id) : -1;

  function navigate(dir: -1 | 1) {
    const next = jobs[currentIdx + dir];
    if (next) { setSelected(next); }
  }

  // Keyboard shortcuts (only when not focused on an input)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!selected) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "a" || e.key === "A") void approve(selected.id);
      if (e.key === "r" || e.key === "R") void reject(selected.id);
      if (e.key === "ArrowDown" || e.key === "j") navigate(1);
      if (e.key === "ArrowUp" || e.key === "k") navigate(-1);
      if (e.key === "e" || e.key === "E") router.push(`/admin/jobs/${selected.id}`);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, currentIdx, jobs, draft, isDirty]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading pending jobs…</div>;
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
    <div className="flex h-[calc(100vh-200px)] overflow-hidden rounded-xl border border-gray-100 bg-white">
      {/* ── Left list ── */}
      <div className="w-72 flex-shrink-0 border-r border-gray-100 overflow-y-auto">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Inbox · {total} pending</p>
          <p className="text-[10px] text-gray-400 mt-0.5">↑↓ navigate · A approve · R reject</p>
        </div>
        <div className="divide-y divide-gray-50">
          {jobs.map((job, idx) => {
            const jobDraft = drafts[job.id] ?? {};
            const hasDraft = Object.keys(jobDraft).length > 0;
            return (
              <button
                key={job.id}
                onClick={() => { setSelected(job); }}
                className={cn(
                  "w-full text-left px-4 py-3 transition-colors",
                  selected?.id === job.id
                    ? "bg-indigo-50 border-l-2 border-indigo-500"
                    : "hover:bg-gray-50 border-l-2 border-transparent"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {jobDraft.company ?? job.company}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {jobDraft.title ?? job.title}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                    {hasDraft && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Unsaved edits" />}
                    {normalizing.has(job.id) && <Loader2 className="w-3 h-3 text-violet-400 animate-spin" />}
                    {!normalizing.has(job.id) && allSuggestions[job.id] && <Sparkles className="w-3 h-3 text-violet-500" />}
                    <span className="text-[10px] text-gray-400">#{idx + 1}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-gray-400">{jobDraft.level ?? job.level}</span>
                  <span className="text-[10px] text-gray-300">·</span>
                  <span className="text-[10px] text-gray-400 truncate">{jobDraft.location ?? job.location}</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />{relativeTime(job.first_seen_at)}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right detail pane ── */}
      {current ? (
        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* Sticky header */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-5 py-3">
            <div className="flex items-center gap-2">
              {/* Nav */}
              <button onClick={() => navigate(-1)} disabled={currentIdx === 0}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 disabled:opacity-30 hover:bg-gray-50 transition-colors" title="↑">
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => navigate(1)} disabled={currentIdx === jobs.length - 1}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 disabled:opacity-30 hover:bg-gray-50 transition-colors" title="↓">
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              <div className="flex-1 min-w-0 mx-1">
                <p className="text-xs text-gray-400 truncate">
                  {currentIdx + 1} of {jobs.length}
                  {isDirty && <span className="ml-2 text-amber-500 font-medium">· unsaved edits</span>}
                </p>
              </div>

              {/* View listing */}
              {current.url && (
                <a href={current.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 transition-colors px-2 py-1.5">
                  <ExternalLink className="w-3 h-3" /> View
                </a>
              )}

              {/* Clean with AI */}
              <button
                onClick={() => cleanWithAI(selected!.id, current)}
                disabled={normalizing.has(selected?.id ?? "")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-200 text-xs font-medium text-violet-600 hover:bg-violet-50 disabled:opacity-50 transition-colors"
                title="Normalize with Gemini"
              >
                {normalizing.has(selected?.id ?? "")
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Sparkles className="w-3.5 h-3.5" />}
                Clean with AI
              </button>

              <button onClick={() => void reject(selected!.id)} disabled={processing === selected?.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors" title="R">
                <ThumbsDown className="w-3.5 h-3.5" /> Reject
              </button>

              <button onClick={() => void approve(selected!.id)} disabled={processing === selected?.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors" title="A">
                {processing === selected?.id
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <ThumbsUp className="w-3.5 h-3.5" />}
                {isDirty ? "Fix & Approve" : "Approve"}
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-4 flex-1">

            {/* AI suggestion diff */}
            {suggestions && Object.keys(suggestions).length > 0 && (
              <div className="rounded-xl border border-violet-200 bg-violet-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-violet-200">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-700">
                    <Sparkles className="w-3.5 h-3.5" /> AI suggestions
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={acceptAllSuggestions}
                      className="text-xs font-medium text-violet-700 hover:text-violet-900 px-2 py-1 rounded-lg hover:bg-violet-100 transition-colors">
                      Accept all
                    </button>
                    <button onClick={() => selected && setAllSuggestions((prev) => (({ [selected.id]: _, ...rest }) => rest)(prev))}
                      className="text-violet-400 hover:text-violet-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-violet-100">
                  {(Object.entries(suggestions) as [keyof Suggestions, string | string[]][]).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="text-[10px] font-semibold text-violet-500 uppercase tracking-wider w-16 flex-shrink-0">{key}</span>
                      <span className="text-xs text-gray-400 line-through truncate flex-1">
                        {Array.isArray(current[key]) ? (current[key] as string[]).join(", ") || "—" : current[key] as string}
                      </span>
                      <ArrowRight className="w-3 h-3 text-violet-400 flex-shrink-0" />
                      <span className="text-xs font-medium text-gray-800 truncate flex-1">
                        {Array.isArray(val) ? val.join(", ") : val}
                      </span>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => acceptSuggestion(key)}
                          className="p-1 rounded-md bg-violet-600 text-white hover:bg-violet-700 transition-colors" title="Accept">
                          <Check className="w-3 h-3" />
                        </button>
                        <button onClick={() => {
                          if (!selected) return;
                          setAllSuggestions((prev) => {
                            const next = { ...(prev[selected.id] ?? {}) };
                            delete next[key];
                            return Object.keys(next).length === 0
                              ? (({ [selected.id]: _, ...rest }) => rest)(prev)
                              : { ...prev, [selected.id]: next };
                          });
                        }}
                          className="p-1 rounded-md border border-violet-200 text-violet-400 hover:bg-violet-100 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Core editable fields */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Company</label>
                  <input className={inp} value={current.company} onChange={(e) => patch("company", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Title</label>
                  <input className={inp} value={current.title} onChange={(e) => patch("title", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Level</label>
                  <select className={inp} value={current.level} onChange={(e) => patch("level", e.target.value)}>
                    {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                    {!LEVELS.includes(current.level) && <option value={current.level}>{current.level}</option>}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Portal</label>
                  <select className={inp} value={current.portal ?? ""} onChange={(e) => patch("portal", e.target.value || null)}>
                    <option value="">— none —</option>
                    {PORTALS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Location</label>
                  <input className={inp} value={current.location} onChange={(e) => patch("location", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Industries</label>
                <input
                  className={inp}
                  value={current.industries?.join(", ") ?? ""}
                  onChange={(e) => patch("industries", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                  placeholder="e.g. SWE, Finance"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Term</label>
                  {(() => {
                    const val = current.target_term ?? "";
                    const showCustomInput = Boolean(selected && customTermOpen[selected.id]);
                    const isOther = val !== "" && !TERM_OPTIONS.includes(val);
                    return (
                      <>
                        <select
                          className={inp}
                          value={showCustomInput || isOther ? "__other__" : val}
                          onChange={(e) => {
                            if (!selected) return;
                            if (e.target.value === "__other__") {
                              setCustomTermOpen((prev) => ({ ...prev, [selected.id]: true }));
                              return;
                            }
                            setCustomTermOpen((prev) => ({ ...prev, [selected.id]: false }));
                            patch("target_term", e.target.value || null);
                          }}
                        >
                          <option value="">— unknown —</option>
                          {TERM_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                          <option value="__other__">Other…</option>
                        </select>
                        {(showCustomInput || isOther) && (
                          <input
                            className={`${inp} mt-1`}
                            value={val}
                            onChange={(e) => patch("target_term", e.target.value || null)}
                            placeholder="Type custom term…"
                            autoFocus
                          />
                        )}
                      </>
                    );
                  })()}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Remote</label>
                  <div className="flex items-center h-[38px]">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <div
                        onClick={() => patch("remote", !current.remote)}
                        className={cn(
                          "relative h-5 w-9 rounded-full transition-colors duration-200",
                          current.remote ? "bg-indigo-600" : "bg-gray-200"
                        )}
                      >
                        <span className={cn(
                          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200",
                          current.remote ? "left-[18px]" : "left-0.5"
                        )} />
                      </div>
                      <span className="text-sm text-gray-600">{current.remote ? "Yes" : "No"}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Timestamps + URLs (read-only info) */}
            <div className="flex items-center gap-4 text-[10px] text-gray-400 px-1">
              <span>First seen: <span className="text-gray-600">{relativeTime(current.first_seen_at)}</span></span>
              <span>Last seen: <span className="text-gray-600">{relativeTime(current.last_seen_at)}</span></span>
              <span>Posted: <span className="text-gray-600">{current.posted_at ? new Date(current.posted_at).toLocaleDateString() : "—"}</span></span>
            </div>

            {/* URLs */}
            <div className="space-y-1.5">
              {([
                { label: "Job URL", val: current.url },
                { label: "Apply URL", val: current.application_url },
                { label: "Canonical URL", val: current.canonical_url },
              ] as { label: string; val: string | null }[]).map(({ label, val }) => val && (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-gray-400 w-24 flex-shrink-0">{label}</span>
                  <a href={val} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-indigo-500 hover:underline truncate flex items-center gap-1">
                    {val.replace(/^https?:\/\//, "").slice(0, 55)}{val.length > 55 && "…"}
                    <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                  </a>
                </div>
              ))}
            </div>

            {/* JD summary — always editable, AI fills when empty */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                Job Description Summary
                {!current.jd_summary && <span className="ml-2 normal-case text-violet-400 font-normal">(run Clean with AI to auto-fill)</span>}
              </label>
              <textarea
                className={`${inp} resize-y min-h-[90px]`}
                value={current.jd_summary ?? ""}
                onChange={(e) => patch("jd_summary", e.target.value || null)}
                placeholder="Paste or let AI generate a description…"
              />
            </div>
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

  useEffect(() => { void fetchJobs(page); }, [page, fetchJobs]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setPage(1);
      void fetchJobs(1);
    }, 350);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, portalFilter, missingFilter, fetchJobs]);

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
  const [resetting, setResetting] = useState(false);

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

  async function resetAllToPending() {
    if (!confirm(`Move all ${stats?.active ?? 0} active jobs to pending review queue?`)) return;
    setResetting(true);
    const res = await fetch("/api/admin/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset_to_pending" }),
    });
    const data = await res.json() as { affected?: number; error?: string };
    setResetting(false);
    if (!res.ok) { showToast(data.error ?? "Failed", false); return; }
    showToast(`${data.affected} jobs moved to pending`);
    // Refresh stats
    fetch("/api/admin/jobs?page=1&limit=1")
      .then((r) => r.json())
      .then((d) => { if (d.stats) setStats(d.stats); })
      .catch(() => {});
  }

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

          {/* One-time migration banner */}
          {stats && stats.active > 0 && stats.pending === 0 && (
            <div className="flex items-center justify-between gap-4 mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  <span className="font-semibold">{stats.active.toLocaleString()} active jobs</span> are visible to users but have not been reviewed yet. Move them all to the review queue first.
                </p>
              </div>
              <button
                onClick={() => void resetAllToPending()}
                disabled={resetting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {resetting ? "Moving…" : `Move all ${stats.active.toLocaleString()} → pending`}
              </button>
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
