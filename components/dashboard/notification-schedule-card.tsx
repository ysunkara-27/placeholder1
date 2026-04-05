"use client";

import { useState } from "react";

interface Props {
  shortlistTimeLocal: string;
  cutoffTimeLocal: string;
  goalSubmitTimeLocal: string;
  timezone: string;
}

export function NotificationScheduleCard({
  shortlistTimeLocal,
  cutoffTimeLocal,
  goalSubmitTimeLocal,
  timezone,
}: Props) {
  const [shortlist, setShortlist] = useState(shortlistTimeLocal || "18:00");
  const [cutoff, setCutoff] = useState(cutoffTimeLocal || "19:00");
  const [goal, setGoal] = useState(goalSubmitTimeLocal || "21:00");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/profile/notification-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shortlist_time_local: shortlist,
          cutoff_time_local: cutoff,
          goal_submit_time_local: goal,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "Failed to update schedule");
      }
      setSuccess("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update schedule");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4 rounded-[28px] border border-rim bg-white p-6 shadow-soft-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-dim">
            Notification schedule
          </p>
          <h3 className="mt-1 text-sm font-semibold text-ink">Daily timing</h3>
          <p className="mt-1 text-xs text-dim">
            Twin texts you a shortlist each day → you review and reply → Twin applies after cutoff.
          </p>
          <p className="mt-0.5 text-xs text-dim">
            Timezone: {timezone || "UTC"}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-ink">
            Shortlist SMS
          </label>
          <input
            type="time"
            value={shortlist}
            onChange={(e) => {
              setShortlist(e.target.value);
              setError(null);
              setSuccess(null);
            }}
            className="w-full rounded-2xl border border-rim bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/25"
          />
          <p className="text-[11px] text-dim">Twin texts you a ranked shortlist of today&apos;s matches at this time.</p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-ink">
            Review cutoff
          </label>
          <input
            type="time"
            value={cutoff}
            onChange={(e) => {
              setCutoff(e.target.value);
              setError(null);
              setSuccess(null);
            }}
            className="w-full rounded-2xl border border-rim bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/25"
          />
          <p className="text-[11px] text-dim">After this time, your YES/SKIP replies are locked in. Twin starts applying immediately after.</p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-ink">
            Done by
          </label>
          <input
            type="time"
            value={goal}
            onChange={(e) => {
              setGoal(e.target.value);
              setError(null);
              setSuccess(null);
            }}
            className="w-full rounded-2xl border border-rim bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/25"
          />
          <p className="text-[11px] text-dim">Target time for all applications to be submitted. Twin works between cutoff and this time.</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center rounded-full bg-ink px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-92 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save schedule"}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {success && <p className="text-xs text-emerald-700">{success}</p>}
      </div>

      <p className="text-[11px] text-dim">
        Shortlist must be sent before the review cutoff, and cutoff must be at least 60 minutes before the Done-by time.
      </p>
    </section>
  );
}
