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
      setSuccess("Saved. Twin will use this schedule for daily lists and queueing.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update schedule");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">
            Notification schedule
          </p>
          <h3 className="mt-1.5 text-lg font-semibold text-gray-900">
            When Twin sends and applies
          </h3>
          <p className="mt-2 text-sm text-gray-600 max-w-xl">
            Set fixed daily times for your shortlist SMS, last edits, and when Twin aims
            to finish submissions. Times are interpreted in your timezone ({timezone || "UTC"}).
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">
            Shortlist SMS time
          </label>
          <input
            type="time"
            value={shortlist}
            onChange={(e) => {
              setShortlist(e.target.value);
              setError(null);
              setSuccess(null);
            }}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <p className="text-[11px] text-gray-500">
            When you receive the numbered daily job list.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">
            Last change time (cutoff)
          </label>
          <input
            type="time"
            value={cutoff}
            onChange={(e) => {
              setCutoff(e.target.value);
              setError(null);
              setSuccess(null);
            }}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <p className="text-[11px] text-gray-500">
            After this, Twin locks in your choices and queues applications.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">
            Goal submit time
          </label>
          <input
            type="time"
            value={goal}
            onChange={(e) => {
              setGoal(e.target.value);
              setError(null);
              setSuccess(null);
            }}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <p className="text-[11px] text-gray-500">
            Twin aims to finish all submissions by this time.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save schedule"}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {success && <p className="text-xs text-emerald-700">{success}</p>}
      </div>

      <p className="text-[11px] text-gray-500">
        Twin enforces that shortlist &lt; cutoff &lt; goal, and there is at least 60 minutes
        between cutoff and goal so there is time to actually run applications.
      </p>
    </section>
  );
}

