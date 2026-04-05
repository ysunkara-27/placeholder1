"use client";

type RecoveryRecord = {
  key: string;
  portal: string;
  family: string;
  count: number;
  appliedCount: number;
  failedCount: number;
  authCount: number;
};

export function RecoverySummary({ recoveries }: { recoveries: RecoveryRecord[] }) {
  if (recoveries.length === 0) {
    return (
      <div className="rounded-[24px] border border-rim bg-white px-6 py-10 text-center shadow-soft-card">
        <p className="text-sm font-medium text-ink">No recovery attempts yet</p>
        <p className="mt-2 text-sm text-dim">
          Twin has not needed a targeted retry on recent runs.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-rim bg-white shadow-soft-card">
      <div className="divide-y divide-rim/60">
        {recoveries.map((recovery) => (
          <div
            key={recovery.key}
            className="flex items-start justify-between gap-4 px-5 py-4"
          >
            <div>
              <p className="text-sm font-medium text-ink">
                {recovery.portal} · {recovery.family.replaceAll("_", " ")}
              </p>
              <p className="mt-1 text-xs text-dim">
                {recovery.count} retries · {recovery.appliedCount} applied ·{" "}
                {recovery.failedCount} failed · {recovery.authCount} auth
              </p>
            </div>
            <div className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-dim">
              {recovery.count}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
