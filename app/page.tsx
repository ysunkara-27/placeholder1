import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  Clock3,
  FileText,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";

const STEPS = [
  {
    icon: BellRing,
    title: "Find the right openings",
    description:
      "Twin keeps watch on fresh early-career roles and surfaces the ones worth acting on first.",
  },
  {
    icon: FileText,
    title: "Pair the right packet",
    description:
      "Resume variants, fixed facts, and portal details are lined up before anything gets submitted.",
  },
  {
    icon: MessageSquareText,
    title: "Approve once",
    description:
      "You confirm the application moment that matters instead of repeating the same form work yourself.",
  },
];

const PORTALS = ["Greenhouse", "Lever", "Workday"];

const THREAD = [
  "17 new internships matched this morning.",
  "Scale AI, WeRide, and Versana are ready for review.",
  "Greenhouse and Lever can go first.",
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-canvas">
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-14">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="space-y-7 animate-rise">
            <div className="inline-flex items-center gap-2 rounded-full border border-rim bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-dim shadow-soft-card">
              Human approval before apply
            </div>

            <div className="space-y-5">
              <h1 className="max-w-4xl text-5xl leading-[0.95] text-ink sm:text-6xl">
                Twin tracks jobs, prepares the application, and waits for your yes.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-dim">
                The point is fewer portals, less repeated form filling, and one clean approval
                step when a role is actually worth submitting.
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link
                href="/onboarding"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-7 py-4 text-base font-semibold text-white shadow-warm transition hover:-translate-y-0.5 hover:bg-accent/90"
              >
                Build my Twin
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="text-sm text-dim">
                Setup takes a few minutes. Text approvals stay optional until you want them.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-rim bg-white px-4 py-2 text-sm font-medium text-ink shadow-soft-card">
                <CheckCircle2 className="h-4 w-4 text-accent" />
                Deterministic portal flows first
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-rim bg-white px-4 py-2 text-sm font-medium text-ink shadow-soft-card">
                <ShieldCheck className="h-4 w-4 text-accent" />
                Visible audit trail after every run
              </div>
            </div>
          </div>

          <div className="animate-rise">
            <div className="rounded-[28px] border border-rim bg-white p-5 shadow-warm-xl">
              <div className="rounded-2xl border border-rim bg-surface px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-dim">
                  Today&apos;s Twin thread
                </p>
                <p className="mt-2 text-base font-semibold text-ink">
                  Morning internship sweep complete
                </p>
              </div>

              <div className="mt-5 space-y-3">
                {THREAD.map((line) => (
                  <div
                    key={line}
                    className="rounded-2xl border border-rim bg-surface px-4 py-3 text-sm leading-6 text-ink"
                  >
                    {line}
                  </div>
                ))}
                <div className="ml-auto max-w-[78%] rounded-2xl rounded-tr-md bg-accent px-4 py-3 text-sm leading-6 text-white shadow-soft-card">
                  Yes. Start with the strongest ones.
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-rim bg-white px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-dim">Matched</p>
                  <p className="mt-2 text-2xl font-semibold text-ink">17</p>
                </div>
                <div className="rounded-2xl border border-rim bg-white px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-dim">Ready now</p>
                  <p className="mt-2 text-2xl font-semibold text-ink">6</p>
                </div>
                <div className="rounded-2xl border border-rim bg-white px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-dim">Queued</p>
                  <p className="mt-2 text-2xl font-semibold text-ink">3</p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {PORTALS.map((portal) => (
                  <span
                    key={portal}
                    className="rounded-full border border-rim bg-accent-wash px-3 py-1.5 text-xs font-medium text-accent"
                  >
                    {portal}
                  </span>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between rounded-2xl border border-rim bg-surface px-4 py-3 text-sm text-ink">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-accent" />
                  Approval stays in the loop
                </div>
                <div className="flex items-center gap-2 text-dim">
                  <ShieldCheck className="h-4 w-4 text-accent" />
                  Dashboard trail saved
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-[28px] border border-rim bg-white p-8 shadow-soft-card">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-dim">
              The core loop
            </p>
            <h2 className="mt-3 text-4xl leading-none text-ink">
              Discover, confirm, apply.
            </h2>
            <p className="mt-4 text-sm leading-7 text-dim">
              Twin should feel like a focused operator. It finds the roles worth your time,
              prepares the application path, and brings you in for one clear decision.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-2xl border border-rim bg-surface px-5 py-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-wash text-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-2xl leading-none text-ink">{title}</h3>
                <p className="mt-4 text-sm leading-7 text-dim">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[28px] bg-accent px-7 py-8 text-white shadow-warm-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/75">
              Why the message is simple
            </p>
            <h2 className="mt-3 text-4xl leading-none">
              The product moment is the approval moment.
            </h2>
          </div>

          <div className="rounded-[28px] border border-rim bg-white px-7 py-8 shadow-soft-card">
            <p className="text-sm leading-7 text-dim">
              The value proposition is not “AI for jobs.” It is that Twin finds relevant
              openings, prepares the repetitive parts, and gets you to one fast confirmation.
              That makes the product easier to trust and easier to scan.
            </p>
            <div className="mt-6">
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-2 rounded-full border border-rim bg-surface px-5 py-3 text-sm font-medium text-ink transition hover:border-accent/40 hover:bg-accent-wash"
              >
                Start with your profile
                <ArrowRight className="h-4 w-4 text-accent" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
