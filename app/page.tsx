import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  Clock3,
  FileText,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const PROCESS_STEPS = [
  {
    icon: BellRing,
    title: "Twin catches the new drops fast",
    description:
      "Fresh internship postings are pulled in, filtered by fit, and grouped before feeds get crowded.",
  },
  {
    icon: FileText,
    title: "The right resume gets paired",
    description:
      "Twin keeps your facts fixed, swaps in the right version, and lines up the best application packet for each role.",
  },
  {
    icon: MessageSquareText,
    title: "You approve with one reply",
    description:
      "Instead of babysitting portals, you get one text. Reply yes, and Twin handles the repetitive part.",
  },
];

const TRUST_POINTS = [
  "Deterministic portal flows first",
  "Human approval before apply",
  "Resume variants mapped to each role",
];

const PLATFORM_CHIPS = [
  "Greenhouse",
  "Lever",
  "Workday",
  "Handshake",
  "Custom fallback",
];

const APPLICATION_CARDS = [
  {
    company: "Scale AI",
    resume: "resume-swe-west.pdf",
    status: "Applied",
  },
  {
    company: "Rendezvous Robotics",
    resume: "resume-systems.pdf",
    status: "Queued",
  },
  {
    company: "Versana",
    resume: "resume-fintech.pdf",
    status: "Submitted",
  },
];

function MessageBubble({
  align = "left",
  eyebrow,
  children,
  className = "",
}: {
  align?: "left" | "right";
  eyebrow?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const isRight = align === "right";

  return (
    <div className={`flex ${isRight ? "justify-end" : "justify-start"} ${className}`}>
      <div
        className={[
          "max-w-[88%] rounded-[26px] px-4 py-3 shadow-sm",
          isRight
            ? "rounded-tr-md bg-[rgb(188,84,49)] text-white"
            : "rounded-tl-md border border-[rgb(235,220,204)] bg-[rgb(255,251,247)] text-[rgb(50,38,29)]",
        ].join(" ")}
      >
        {eyebrow ? (
          <p
            className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${
              isRight ? "text-orange-100/80" : "text-[rgb(162,120,91)]"
            }`}
          >
            {eyebrow}
          </p>
        ) : null}
        <div className={`text-sm leading-6 ${eyebrow ? "mt-1.5" : ""}`}>{children}</div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgb(188,84,49)] text-sm font-bold text-white shadow-lg shadow-orange-200/70">
            T
          </div>
          <div>
            <p className="text-base font-semibold tracking-tight text-[rgb(32,24,20)]">Twin</p>
            <p className="text-xs text-[rgb(122,96,80)]">Approve once. Let it handle the rest.</p>
          </div>
        </div>

        <nav className="flex items-center gap-3">
          <Link
            href="/auth"
            className="rounded-full px-4 py-2 text-sm font-medium text-[rgb(122,96,80)] transition-colors hover:bg-white/80 hover:text-[rgb(32,24,20)]"
          >
            Sign in
          </Link>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 rounded-full border border-[rgb(214,183,161)] bg-white/90 px-4 py-2 text-sm font-semibold text-[rgb(32,24,20)] shadow-sm transition hover:border-[rgb(188,84,49)] hover:text-[rgb(188,84,49)]"
          >
            Start profile
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid w-full max-w-6xl gap-14 px-6 pb-20 pt-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="landing-rise">
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgb(235,220,204)] bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[rgb(162,120,91)] shadow-sm backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-[rgb(188,84,49)]" />
            Text-to-apply for internship season
          </div>

          <h1 className="mt-8 max-w-3xl text-5xl font-extrabold tracking-[-0.05em] text-[rgb(32,24,20)] sm:text-6xl">
            Twin finds the latest relevant internships, matches the right resume,
            and waits on your <span className="text-[rgb(188,84,49)]">yes</span>.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-[rgb(122,96,80)]">
            The point is not more dashboards. The point is fewer portals. Twin watches
            the job flow, lines up the best application packet for each role, and asks
            for one fast confirmation before it submits.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center gap-3 rounded-full bg-[rgb(188,84,49)] px-7 py-4 text-base font-semibold text-white shadow-warm-xl transition hover:-translate-y-0.5 hover:bg-[rgb(170,74,42)]"
            >
              Build my Twin
              <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="text-sm text-[rgb(122,96,80)]">
              Takes about 4 minutes. Phone is optional until you want text approvals.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            {TRUST_POINTS.map((point) => (
              <div
                key={point}
                className="inline-flex items-center gap-2 rounded-full border border-[rgb(235,220,204)] bg-white/85 px-4 py-2 text-sm font-medium text-[rgb(85,62,48)] shadow-sm"
              >
                <CheckCircle2 className="h-4 w-4 text-[rgb(188,84,49)]" />
                {point}
              </div>
            ))}
          </div>
        </div>

        <div className="landing-rise-delayed">
          <div className="relative overflow-hidden rounded-[34px] border border-[rgb(230,214,197)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(251,243,234,0.98))] p-5 shadow-warm-xl">
            <div className="bg-warm-grid absolute inset-0 opacity-45" />
            <div className="relative">
              <div className="flex items-center justify-between rounded-[24px] border border-[rgb(235,220,204)] bg-white/90 px-4 py-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(162,120,91)]">
                    Today&apos;s Twin thread
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[rgb(32,24,20)]">
                    Daily internship sweep complete
                  </p>
                </div>
                <div className="rounded-full bg-[rgb(247,236,223)] px-3 py-1 text-xs font-semibold text-[rgb(188,84,49)]">
                  17 matches
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <MessageBubble eyebrow="Twin" className="landing-rise">
                  Found <strong>17 internships released today</strong> across SWE, product,
                  and data. I matched the strongest resume for each one and grouped the
                  Greenhouse + Lever applications first.
                </MessageBubble>

                <MessageBubble eyebrow="Twin" className="landing-rise-delayed">
                  Ready to apply to Scale AI, WeRide, Versana, and 14 more. Waiting on
                  confirmation.
                </MessageBubble>

                <MessageBubble align="right" eyebrow="You" className="landing-rise-delayed">
                  Yes, let&apos;s do it.
                </MessageBubble>

                <MessageBubble eyebrow="Twin" className="landing-rise-delayed">
                  On it. Submitting the deterministic ones first and saving the PDFs +
                  confirmations back to your dashboard.
                </MessageBubble>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {APPLICATION_CARDS.map((card, index) => (
                  <div
                    key={card.company}
                    className={`rounded-[24px] border border-[rgb(235,220,204)] bg-white/90 p-4 shadow-sm ${
                      index === 1 ? "landing-float-delayed" : "landing-float"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[rgb(32,24,20)]">
                          {card.company}
                        </p>
                        <p className="mt-1 text-xs text-[rgb(122,96,80)]">{card.resume}</p>
                      </div>
                      <FileText className="h-4 w-4 shrink-0 text-[rgb(188,84,49)]" />
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs">
                      <span className="rounded-full bg-[rgb(247,236,223)] px-2.5 py-1 font-semibold text-[rgb(188,84,49)]">
                        {card.status}
                      </span>
                      <span className="text-[rgb(122,96,80)]">Tailored packet</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between rounded-[24px] border border-[rgb(235,220,204)] bg-[rgb(255,251,247)] px-4 py-3 text-sm text-[rgb(85,62,48)]">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-[rgb(188,84,49)]" />
                  Human approval stays in the loop.
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[rgb(188,84,49)]" />
                  Audit trail saved
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="rounded-[36px] border border-[rgb(230,214,197)] bg-white/80 px-6 py-8 shadow-sm backdrop-blur sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(162,120,91)]">
                What Twin is designed to do well
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-[rgb(32,24,20)]">
                Cut the repetitive part out of internship season.
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_CHIPS.map((portal) => (
                <span
                  key={portal}
                  className="rounded-full border border-[rgb(235,220,204)] bg-[rgb(255,251,247)] px-3 py-2 text-sm font-medium text-[rgb(85,62,48)]"
                >
                  {portal}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {PROCESS_STEPS.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-[28px] border border-[rgb(235,220,204)] bg-[rgb(255,251,247)] p-6"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgb(247,236,223)] text-[rgb(188,84,49)]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-[rgb(32,24,20)]">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-[rgb(122,96,80)]">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-8 px-6 pb-24 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[34px] bg-[rgb(41,30,24)] p-8 text-white shadow-warm-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-200/70">
            The interaction model
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">
            Simple enough to trust.
          </h2>
          <p className="mt-4 text-sm leading-7 text-orange-50/78">
            Twin should feel more like a sharp operator than another job board. You get a
            compact summary, the system shows what it matched, and you stay in control of
            the final yes.
          </p>

          <div className="mt-8 space-y-4">
            <div className="rounded-[26px] border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-semibold">What you see</p>
              <p className="mt-2 text-sm leading-6 text-orange-50/74">
                Role count, companies, resume choice, portal route, and what is about to be
                submitted.
              </p>
            </div>
            <div className="rounded-[26px] border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-semibold">What you do</p>
              <p className="mt-2 text-sm leading-6 text-orange-50/74">
                Reply yes, no, or wait. No tab jungle. No filling the same profile for the
                hundredth time.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[34px] border border-[rgb(230,214,197)] bg-white/80 p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(162,120,91)]">
            Why this landing is centered on texting
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[rgb(32,24,20)]">
            The product moment is the approval moment.
          </h2>
          <div className="mt-6 space-y-5 text-sm leading-7 text-[rgb(122,96,80)]">
            <p>
              The strongest value prop is not “AI for jobs.” It is: Twin finds the new
              openings, chooses the right resume, and gets you to one fast confirmation.
            </p>
            <p>
              That makes the landing page easier to understand. A student should land here
              and immediately see the loop: <strong>discover → match → confirm → apply</strong>.
            </p>
            <p>
              Keeping the hero simple also avoids the usual AI-product problem where the UI
              looks generated before the user even reads the copy. Warm colors, fewer claims,
              and one visible interaction are the right direction here.
            </p>
          </div>

          <div className="mt-8 rounded-[28px] border border-[rgb(235,220,204)] bg-[rgb(255,251,247)] p-5">
            <p className="text-sm font-semibold text-[rgb(32,24,20)]">
              Best follow-up sections for the rest of the homepage
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[rgb(122,96,80)]">
              <li>Explain how resume versions are chosen and locked facts stay fixed.</li>
              <li>Show the supported portals and what happens on custom sites.</li>
              <li>Show where confirmations, PDFs, and application status live afterward.</li>
            </ul>
          </div>
        </div>
      </section>

      <footer className="border-t border-[rgb(230,214,197)] bg-white/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-12 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-2xl font-bold tracking-tight text-[rgb(32,24,20)]">
              Build your Twin before the next job drop.
            </p>
            <p className="mt-2 text-sm text-[rgb(122,96,80)]">
              Set up your profile once, then keep approval as the only manual step.
            </p>
          </div>
          <Link
            href="/onboarding"
            className="inline-flex items-center justify-center gap-3 rounded-full bg-[rgb(32,24,20)] px-7 py-4 text-sm font-semibold text-white transition hover:bg-[rgb(55,41,33)]"
          >
            Start with your profile
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </footer>
    </main>
  );
}
