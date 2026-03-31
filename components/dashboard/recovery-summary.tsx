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
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-10 text-center">
        <p className="text-sm font-medium text-gray-900">No recovery attempts yet</p>
        <p className="mt-2 text-sm text-gray-400">
          Twin has not needed a targeted retry on recent runs.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="divide-y divide-gray-100">
        {recoveries.map((recovery) => (
          <div
            key={recovery.key}
            className="flex items-start justify-between gap-4 px-5 py-4"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">
                {recovery.portal} · {recovery.family.replaceAll("_", " ")}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {recovery.count} retries · {recovery.appliedCount} applied ·{" "}
                {recovery.failedCount} failed · {recovery.authCount} auth
              </p>
            </div>
            <div className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
              {recovery.count}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
