"use client";

type BlockerRecord = {
  family: string;
  count: number;
  automationCount: number;
  profileDataCount: number;
  mixedCount: number;
};

export function BlockersSummary({ blockers }: { blockers: BlockerRecord[] }) {
  if (blockers.length === 0) {
    return (
      <div className="rounded-[24px] border border-rim bg-white px-6 py-10 text-center shadow-soft-card">
        <p className="text-sm font-medium text-ink">No repeated blockers yet</p>
        <p className="mt-2 text-sm text-dim">
          Recent runs have not clustered around one failure family.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-rim bg-white shadow-soft-card">
      <div className="divide-y divide-rim/60">
        {blockers.map((blocker) => (
          <div
            key={blocker.family}
            className="flex items-start justify-between gap-4 px-5 py-4"
          >
            <div>
              <p className="text-sm font-medium text-ink">
                {blocker.family.replaceAll("_", " ")}
              </p>
              <p className="mt-1 text-xs text-dim">
                {blocker.count} blocked runs · {blocker.automationCount} automation ·{" "}
                {blocker.profileDataCount} profile · {blocker.mixedCount} mixed
              </p>
            </div>
            <div className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-dim">
              {blocker.count}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
