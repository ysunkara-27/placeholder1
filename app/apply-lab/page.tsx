import { ApplyLab } from "@/components/apply/apply-lab";

export default function ApplyLabPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-indigo-500">
            Internal Tool
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
            Twin Apply Lab
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-500">
            Use this page to inspect and run real applications that were sent
            here from Browse Jobs, then queue and process them through the
            worker flow.
          </p>
        </div>

        <ApplyLab />
      </div>
    </main>
  );
}
