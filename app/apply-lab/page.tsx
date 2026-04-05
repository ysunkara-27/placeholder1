import { ApplyLab } from "@/components/apply/apply-lab";

export default function ApplyLabPage() {
  return (
    <main className="min-h-screen bg-canvas px-6 py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-[28px] border border-rim bg-white px-6 py-7 shadow-soft-card">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-dim">
            Internal Tool
          </p>
          <h1 className="mt-2 text-4xl leading-none text-ink">
            Twin Apply Lab
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-dim">
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
