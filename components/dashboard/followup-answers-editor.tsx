"use client";

import { useState } from "react";

interface Props {
  initialAnswers: Record<string, string>;
}

type EditableAnswer = {
  key: string;
  value: string;
  dirty: boolean;
  deleted: boolean;
};

export function FollowupAnswersEditor({ initialAnswers }: Props) {
  const [answers, setAnswers] = useState<EditableAnswer[]>(
    Object.entries(initialAnswers).map(([key, value]) => ({
      key,
      value,
      dirty: false,
      deleted: false,
    }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function upsertAnswer(index: number, patch: Partial<EditableAnswer>) {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch, dirty: true };
      return next;
    });
    setError(null);
    setSuccess(null);
  }

  function addNew() {
    setAnswers((prev) => [
      ...prev,
      {
        key: "",
        value: "",
        dirty: true,
        deleted: false,
      },
    ]);
    setError(null);
    setSuccess(null);
  }

  function markDeleted(index: number) {
    upsertAnswer(index, { deleted: true });
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: Record<string, string> = {};
      for (const entry of answers) {
        const key = entry.key.trim();
        const value = entry.value.trim();
        if (!key || !value || entry.deleted) continue;
        payload[key] = value;
      }

      const res = await fetch("/api/profile/followup-answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ follow_up_answers: payload }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to save follow-up answers");
      }

      setAnswers(
        Object.entries(payload).map(([key, value]) => ({
          key,
          value,
          dirty: false,
          deleted: false,
        }))
      );
      setSuccess("Saved. Future runs will use these answers automatically.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const visibleAnswers = answers.filter((a) => !a.deleted);

  return (
    <section className="rounded-3xl border border-sky-200 bg-sky-50/70 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
            Gray area answers
          </p>
          <h3 className="mt-1.5 text-lg font-semibold text-gray-900">
            Saved clarifications Twin can reuse
          </h3>
          <p className="mt-2 text-sm text-gray-600 max-w-xl">
            These are the answers you&apos;ve given to tricky application questions
            (salary expectations, relocation, etc.). Twin reuses them automatically
            so later runs don&apos;t block on the same prompts.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {visibleAnswers.length === 0 && (
          <p className="text-sm text-gray-600">
            No saved answers yet. As Twin runs into questions it can&apos;t safely answer,
            you&apos;ll be able to store your preferences here.
          </p>
        )}

        {visibleAnswers.map((entry, index) => (
          <div
            key={`${entry.key}-${index}`}
            className="rounded-2xl border border-sky-100 bg-white px-4 py-3 flex flex-col gap-2"
          >
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">
                Question
              </label>
              <input
                type="text"
                value={entry.key}
                onChange={(e) => upsertAnswer(index, { key: e.target.value })}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                placeholder="e.g. What salary range are you targeting?"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">
                Your saved answer
              </label>
              <textarea
                value={entry.value}
                onChange={(e) => upsertAnswer(index, { value: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none"
                placeholder="e.g. $90–110k base in SF Bay Area; open to lower for early-stage with strong equity."
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {entry.dirty ? "Edited, not yet saved" : "In use for future runs"}
              </span>
              <button
                type="button"
                onClick={() => markDeleted(index)}
                className="text-xs font-medium text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addNew}
          className="mt-2 inline-flex items-center rounded-full border border-dashed border-sky-300 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100"
        >
          + Add another answer
        </button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save answers"}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {success && <p className="text-xs text-emerald-700">{success}</p>}
      </div>
    </section>
  );
}

