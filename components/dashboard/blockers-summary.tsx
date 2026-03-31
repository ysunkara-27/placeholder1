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
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-10 text-center">
        <p className="text-sm font-medium text-gray-900">No repeated blockers yet</p>
        <p className="mt-2 text-sm text-gray-400">
          Recent runs have not clustered around one failure family.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="divide-y divide-gray-100">
        {blockers.map((blocker) => (
          <div
            key={blocker.family}
            className="flex items-start justify-between gap-4 px-5 py-4"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">
                {blocker.family.replaceAll("_", " ")}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {blocker.count} blocked runs · {blocker.automationCount} automation ·{" "}
                {blocker.profileDataCount} profile · {blocker.mixedCount} mixed
              </p>
            </div>
            <div className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
              {blocker.count}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
