"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, ExternalLink, Trash2, Save, AlertTriangle,
  Check, Loader2, Wrench, Copy,
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
  url: string;
  application_url: string;
  canonical_url: string | null;
  canonical_application_url: string | null;
  portal: string | null;
  jd_summary: string | null;
  is_early_career: boolean;
  industries: string[];
  posted_at: string;
}

const PORTALS = [
  "greenhouse", "lever", "workday", "handshake",
  "linkedin", "indeed", "icims", "smartrecruiters",
  "company_website", "other",
];

const LEVELS = ["internship", "new_grad", "co_op", "associate", "part_time"];

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  active:  "bg-green-100 text-green-800 border-green-200",
  paused:  "bg-yellow-100 text-yellow-800 border-yellow-200",
  closed:  "bg-red-100 text-red-800 border-red-200",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JobEditPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [draft, setDraft] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/jobs/${jobId}`)
      .then((r) => r.json())
      .then((data) => {
        setJob(data);
        setDraft(data);
      })
      .catch(() => showToast("Failed to load job", false))
      .finally(() => setLoading(false));
  }, [jobId]);

  function showToast(text: string, ok = true) {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 3000);
  }

  function set<K extends keyof Job>(key: K, value: Job[K]) {
    setDraft((prev) => prev ? { ...prev, [key]: value } : prev);
    setDirty(true);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    const res = await fetch(`/api/admin/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    setSaving(false);
    if (res.ok) {
      const updated = await res.json();
      setJob(updated);
      setDraft(updated);
      setDirty(false);
      showToast("Saved");
    } else {
      const d = await res.json().catch(() => ({}));
      showToast(d.error ?? "Save failed", false);
    }
  }

  async function deleteJob() {
    if (!confirm(`Delete "${draft?.title}" at ${draft?.company}? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/jobs/${jobId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/admin");
    } else {
      showToast("Delete failed", false);
    }
  }

  // Quick-fix helpers
  function fixCanonicalUrl() {
    if (!draft) return;
    set("canonical_url", draft.url);
    showToast("canonical_url set from url — save to persist");
  }

  function fixCanonicalAppUrl() {
    if (!draft) return;
    set("canonical_application_url", draft.application_url);
    showToast("canonical_application_url set — save to persist");
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    showToast("Copied");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Job not found.</p>
      </div>
    );
  }

  const canonicalMismatch = draft.url && draft.canonical_url && draft.url !== draft.canonical_url;
  const missingCanonical = !draft.canonical_url;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg",
          toast.ok
            ? "bg-green-600 text-white"
            : "bg-red-600 text-white"
        )}>
          {toast.ok ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.text}
        </div>
      )}

      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-screen-lg mx-auto px-6 py-3 flex items-center gap-4">
          <button
            onClick={() => router.push("/admin")}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Admin
          </button>
          <div className="h-4 w-px bg-gray-200" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {draft.company} — {draft.title}
            </p>
          </div>
          <span className={cn("hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border", STATUS_STYLES[draft.status] ?? "bg-gray-100 text-gray-600")}>
            {draft.status}
          </span>
          {draft.url && (
            <a
              href={draft.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> View listing
            </a>
          )}
          <button
            onClick={deleteJob}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
          <button
            onClick={save}
            disabled={saving || !dirty}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors",
              dirty
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "bg-gray-100 text-gray-400 cursor-default"
            )}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-screen-lg mx-auto px-6 py-8 grid grid-cols-3 gap-6 items-start">

        {/* ── Main form (2/3) ───────────────────────────────────────── */}
        <div className="col-span-2 space-y-5">

          {/* Identity */}
          <Section title="Identity">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Company">
                <input className={inp} value={draft.company} onChange={(e) => set("company", e.target.value)} />
              </Field>
              <Field label="Title">
                <input className={inp} value={draft.title} onChange={(e) => set("title", e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Status">
                <select className={inp} value={draft.status} onChange={(e) => set("status", e.target.value)}>
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="closed">Closed</option>
                </select>
              </Field>
              <Field label="Portal">
                <select className={inp} value={draft.portal ?? ""} onChange={(e) => set("portal", e.target.value || null)}>
                  <option value="">— none —</option>
                  {PORTALS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Posted at">
                <input
                  type="date"
                  className={inp}
                  value={draft.posted_at ? draft.posted_at.slice(0, 10) : ""}
                  onChange={(e) => set("posted_at", e.target.value ? new Date(e.target.value).toISOString() : draft.posted_at)}
                />
              </Field>
            </div>
          </Section>

          {/* Classification */}
          <Section title="Classification">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Level">
                <select className={inp} value={draft.level} onChange={(e) => set("level", e.target.value)}>
                  {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  {!LEVELS.includes(draft.level) && <option value={draft.level}>{draft.level}</option>}
                </select>
              </Field>
              <Field label="Industries (comma-separated)">
                <input
                  className={inp}
                  value={draft.industries?.join(", ") ?? ""}
                  onChange={(e) =>
                    set("industries", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
                  }
                />
              </Field>
            </div>
            <div className="flex items-center gap-6 pt-1">
              <Toggle
                label="Is early career"
                checked={draft.is_early_career}
                onChange={(v) => set("is_early_career", v)}
              />
              <Toggle
                label="Remote"
                checked={draft.remote}
                onChange={(v) => set("remote", v)}
              />
            </div>
          </Section>

          {/* Location */}
          <Section title="Location">
            <Field label="Location text">
              <input className={inp} value={draft.location} onChange={(e) => set("location", e.target.value)} />
            </Field>
          </Section>

          {/* URLs */}
          <Section title="URLs">
            {(missingCanonical || canonicalMismatch) && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-800 mb-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {missingCanonical
                    ? "canonical_url is missing — this job won't appear on the browse page."
                    : "canonical_url differs from url — verify this is intentional."}
                </span>
              </div>
            )}
            <Field label="URL (source)">
              <div className="flex gap-2">
                <input className={cn(inp, "flex-1")} value={draft.url} onChange={(e) => set("url", e.target.value)} />
                <button onClick={() => copyToClipboard(draft.url)} className={quickBtn} title="Copy">
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <a href={draft.url} target="_blank" rel="noopener noreferrer" className={quickBtn} title="Open">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </Field>
            <Field label="canonical_url">
              <div className="flex gap-2">
                <input
                  className={cn(inp, "flex-1", missingCanonical && "border-red-300 bg-red-50 focus:ring-red-400")}
                  value={draft.canonical_url ?? ""}
                  onChange={(e) => set("canonical_url", e.target.value || null)}
                />
                <button
                  onClick={fixCanonicalUrl}
                  className={cn(quickBtn, "gap-1.5 px-2 text-xs font-medium whitespace-nowrap")}
                  title="Copy from URL"
                >
                  <Wrench className="w-3.5 h-3.5" /> Fix
                </button>
              </div>
            </Field>
            <Field label="Application URL">
              <div className="flex gap-2">
                <input className={cn(inp, "flex-1")} value={draft.application_url} onChange={(e) => set("application_url", e.target.value)} />
                <a href={draft.application_url} target="_blank" rel="noopener noreferrer" className={quickBtn} title="Open">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </Field>
            <Field label="canonical_application_url">
              <div className="flex gap-2">
                <input
                  className={cn(inp, "flex-1")}
                  value={draft.canonical_application_url ?? ""}
                  onChange={(e) => set("canonical_application_url", e.target.value || null)}
                />
                <button onClick={fixCanonicalAppUrl} className={cn(quickBtn, "gap-1.5 px-2 text-xs font-medium whitespace-nowrap")}>
                  <Wrench className="w-3.5 h-3.5" /> Fix
                </button>
              </div>
            </Field>
          </Section>

          {/* JD Summary */}
          <Section title="Job description summary">
            <textarea
              className={cn(inp, "resize-y min-h-[120px]")}
              value={draft.jd_summary ?? ""}
              onChange={(e) => set("jd_summary", e.target.value || null)}
              placeholder="Paste or type a JD summary…"
            />
          </Section>
        </div>

        {/* ── Right panel (1/3) ─────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Quick status */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Quick status</p>
            <div className="flex flex-col gap-2">
              {(["pending", "active", "paused", "closed"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => { set("status", s); setDirty(true); }}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    draft.status === s
                      ? STATUS_STYLES[s]
                      : "border-gray-200 text-gray-500 hover:bg-gray-50"
                  )}
                >
                  {s}
                  {draft.status === s && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          </div>

          {/* Quick fixes */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Quick fixes</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={fixCanonicalUrl}
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
              >
                <Wrench className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                Set canonical_url from url
              </button>
              <button
                onClick={fixCanonicalAppUrl}
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
              >
                <Wrench className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                Set canonical_app_url from app_url
              </button>
            </div>
          </div>

          {/* Metadata */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2.5">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Metadata</p>
            {[
              { label: "ID", value: draft.id, mono: true },
              { label: "Posted", value: new Date(draft.posted_at).toLocaleDateString() },
              { label: "Portal", value: draft.portal ?? "—" },
              { label: "Level", value: draft.level },
              { label: "Industries", value: draft.industries?.join(", ") || "—" },
            ].map(({ label, value, mono }) => (
              <div key={label} className="flex justify-between items-start gap-2">
                <span className="text-xs text-gray-400 shrink-0">{label}</span>
                <span className={cn("text-xs text-gray-700 text-right break-all", mono && "font-mono")}>{value}</span>
              </div>
            ))}
          </div>

          {/* Danger zone */}
          <div className="bg-white rounded-xl border border-red-100 p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-red-400">Danger zone</p>
            <button
              onClick={deleteJob}
              className="flex items-center gap-2 w-full rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete this job
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inp =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors";

const quickBtn =
  "flex items-center justify-center rounded-lg border border-gray-200 px-2.5 py-2 text-gray-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors duration-200",
          checked ? "bg-indigo-600" : "bg-gray-200"
        )}
      >
        <span className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200",
          checked ? "left-[18px]" : "left-0.5"
        )} />
      </div>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}
