"use client";

import { type ApplyRunRecord } from "@/components/dashboard/apply-runs-list";

type FollowupPromptSummary = {
  prompt: string;
  count: number;
  portals: Set<string>;
};

function summarizeFollowups(runs: ApplyRunRecord[]): FollowupPromptSummary[] {
  const promptMap = new Map<string, FollowupPromptSummary>();

  for (const run of runs) {
    const items = run.summary?.follow_up_items ?? [];
    if (!run.summary?.follow_up_required || items.length === 0) {
      continue;
    }

    for (const prompt of items) {
      const normalized = prompt.trim();
      if (!normalized) continue;

      const existing = promptMap.get(normalized) ?? {
        prompt: normalized,
        count: 0,
        portals: new Set<string>(),
      };
      existing.count += 1;
      existing.portals.add(run.portal ?? "unknown");
      promptMap.set(normalized, existing);
    }
  }

  return [...promptMap.values()].sort((left, right) => right.count - left.count);
}

export function FollowupsSummary({ runs }: { runs: ApplyRunRecord[] }) {
  const prompts = summarizeFollowups(runs);
  const totalRuns = runs.filter((run) => run.summary?.follow_up_required).length;

  return (
    <div className="rounded-3xl border border-orange-200 bg-orange-50/70 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-orange-600">
            Pending Follow-ups
          </p>
          <h3 className="mt-2 text-xl font-semibold text-ink">
            {totalRuns > 0
              ? `${totalRuns} run${totalRuns === 1 ? "" : "s"} need user input`
              : "No unresolved user questions right now"}
          </h3>
          <p className="mt-2 max-w-2xl text-sm text-dim">
            Twin pauses before submit when a required prompt cannot be answered safely. These are the top unresolved prompts still waiting on a user answer.
          </p>
        </div>
      </div>

      {prompts.length > 0 ? (
        <div className="mt-5 space-y-3">
          {prompts.slice(0, 4).map((item) => (
            <div
              key={item.prompt}
              className="rounded-2xl border border-orange-100 bg-white px-4 py-3"
            >
              <p className="text-sm font-medium text-ink">{item.prompt}</p>
              <p className="mt-1 text-xs text-dim">
                {item.count} blocked run{item.count === 1 ? "" : "s"} · {[
                  ...item.portals,
                ]
                  .map((portal) => portal.replaceAll("_", " "))
                  .join(", ")}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-orange-100 bg-white px-4 py-4 text-sm text-dim">
          Daily follow-up reports and SMS batches are clear. New unresolved prompts will appear here automatically after blocked runs.
        </div>
      )}
    </div>
  );
}
