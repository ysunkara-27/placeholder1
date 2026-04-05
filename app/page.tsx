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
    title: "Catch the right openings early",
    description:
      "Twin keeps watch on early-career roles, cleans the noise down, and highlights the jobs worth acting on first.",
  },
  {
    icon: FileText,
    title: "Pair the right resume automatically",
    description:
      "Your fixed facts stay consistent while resume versions, portal routing, and application context line up behind the scenes.",
  },
  {
    icon: MessageSquareText,
    title: "Approve once and move on",
    description:
      "You review the moment that matters, then Twin handles the repetitive portal work instead of making you do it again.",
  },
];

const TRUST_POINTS = [
  "Deterministic portal flows first",
  "Human approval before submit",
  "Visible audit trail after every run",
];

const PLATFORM_CHIPS = ["Greenhouse", "Lever", "Workday", "Dashboard review", "Queued apply runs"];

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
    status: "Reviewing",
  },
];

function MessageBubble({
  align = "left",
  eyebrow,
  children,
}: {
  align?: "left" | "right";
  eyebrow?: string;
  children: React.ReactNode;
}) {
  const isRight = align === "right";

  return (
    <div className={`flex ${isRight ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[88%] rounded-[28px] px-4 py-3 shadow-soft-card",
          isRight
            ? "rounded-tr-md bg-[rgb(187,74,43)] text-white"
            : "rounded-tl-md border border-[rgb(227,205,188)] bg-[rgba(255,250,245,0.95)] text-[rgb(53,36,28)]",
        ].join(" ")}
      >
        {eyebrow ? (
          <p
            className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${
              isRight ? "text-orange-100/80" : "text-[rgb(149,118,98)]"
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
      <section className="mx-auto grid w-full max-w-6xl gap-10 px-6 pb-16 pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="landing-rise">
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgb(227,205,188)] bg-[rgba(255,250,245,0.88)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(149,118,98)] shadow-soft-card">
            <Sparkles className="h-3.5 w-3.5 text-[rgb(187,74,43)]" />
            Application agent for internship season
          </div>

          <h1 className="mt-7 max-w-3xl text-5xl leading-[0.95] text-[rgb(41,28,22)] sm:text-6xl">
            Twin watches the job flow, lines up the right packet, and waits for your
            <span className="text-[rgb(187,74,43)]"> yes</span>.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-[rgb(125,99,82)]">
            Less tab juggling. Less repeated form filling. Twin keeps the repetitive
            application work moving while you keep control over the final approval.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center gap-3 rounded-full bg-[rgb(187,74,43)] px-7 py-4 text-base font-semibold text-white shadow-warm-xl transition hover:-translate-y-0.5 hover:bg-[rgb(169,63,34)]"
            >
              Build my Twin
              <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="text-sm text-[rgb(125,99,82)]">
              Setup takes a few minutes. Text approval stays optional until you want it.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {TRUST_POINTS.map((point) => (
              <div
                key={point}
                className="warm-pill inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-soft-card"
              >
                <CheckCircle2 className="h-4 w-4 text-[rgb(187,74,43)]" />
                {point}
              </div>
            ))}
          </div>
        </div>

        <div className="landing-rise-delayed">
          <div className="surface-panel relative overflow-hidden rounded-[36px] p-5 shadow-warm-xl">
            <div className="bg-warm-grid absolute inset-0 opacity-35" />
            <div className="relative">
              <div className="surface-card flex items-center justify-between rounded-[26px] px-4 py-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(149,118,98)]">
                    Today&apos;s Twin thread
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[rgb(41,28,22)]">
                    Morning internship sweep complete
                  </p>
                </div>
                <div className="warm-pill rounded-full px-3 py-1 text-xs font-semibold">
                  17 matches
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <MessageBubble eyebrow="Twin">
                  Found 17 new roles across SWE, product, and data. I ranked the strongest
                  matches and queued the cleanest applications first.
                </MessageBubble>
                <MessageBubble eyebrow="Twin">
                  Scale AI, WeRide, and Versana are ready for approval. Greenhouse and Lever
                  can move first.
                </MessageBubble>
                <MessageBubble align="right" eyebrow="You">
                  Yes. Start with the strongest ones.
                </MessageBubble>
                <MessageBubble eyebrow="Twin">
                  Submitting the deterministic paths first. Status, screenshots, and run notes
                  will show up in your dashboard.
                </MessageBubble>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {APPLICATION_CARDS.map((card, index) => (
                  <div
                    key={card.company}
                    className={`surface-card rounded-[24px] p-4 ${index === 1 ? "landing-float-delayed" : "landing-float"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[rgb(41,28,22)]">{card.company}</p>
                        <p className="mt-1 text-xs text-[rgb(125,99,82)]">{card.resume}</p>
                      </div>
                      <FileText className="h-4 w-4 shrink-0 text-[rgb(187,74,43)]" />
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs">
                      <span className="warm-pill rounded-full px-2.5 py-1 font-semibold">
                        {card.status}
                      </span>
                      <span className="text-[rgb(125,99,82)]">Tailored packet</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="surface-card flex items-center gap-2 rounded-[22px] px-4 py-3 text-sm text-[rgb(82,57,43)]">
                  <Clock3 className="h-4 w-4 text-[rgb(187,74,43)]" />
                  Human approval stays in the loop.
                </div>
                <div className="surface-card flex items-center gap-2 rounded-[22px] px-4 py-3 text-sm text-[rgb(82,57,43)]">
                  <ShieldCheck className="h-4 w-4 text-[rgb(187,74,43)]" />
                  Every run leaves a visible trail.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="surface-card rounded-[34px] px-6 py-8 sm:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(149,118,98)]">
                The core loop
              </p>
              <h2 className="mt-3 text-4xl leading-none text-[rgb(41,28,22)]">
                Discover. Confirm. Apply.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[rgb(125,99,82)]">
                The product should feel like a sharp operator, not another crowded job board.
                Twin finds openings, chooses the right materials, and asks for one clear decision.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_CHIPS.map((portal) => (
                <span
                  key={portal}
                  className="warm-pill rounded-full px-3 py-2 text-sm font-medium"
                >
                  {portal}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {PROCESS_STEPS.map(({ icon: Icon, title, description }) => (
              <div key={title} className="surface-panel rounded-[28px] p-6 shadow-soft-card">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgb(250,233,221)] text-[rgb(187,74,43)]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-2xl leading-none text-[rgb(41,28,22)]">{title}</h3>
                <p className="mt-4 text-sm leading-7 text-[rgb(125,99,82)]">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-6 px-6 pb-24 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[34px] bg-[linear-gradient(180deg,rgba(154,53,30,1),rgba(109,35,19,1))] p-8 text-white shadow-warm-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-100/70">
            Why the message is simple
          </p>
          <h2 className="mt-3 text-4xl leading-none">
            The value is the approval moment.
          </h2>
          <p className="mt-4 text-sm leading-7 text-orange-50/86">
            Twin is not trying to be another giant dashboard. The product promise is smaller
            and stronger: find the roles worth acting on, prepare the application, and bring
            you in only for the decision that matters.
          </p>
        </div>

        <div className="surface-card rounded-[34px] p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(149,118,98)]">
            What the rest of the platform should feel like
          </p>
          <h2 className="mt-3 text-4xl leading-none text-[rgb(41,28,22)]">
            Clean, warm, calm, and fast to scan.
          </h2>
          <div className="mt-6 space-y-4 text-sm leading-7 text-[rgb(125,99,82)]">
            <p>
              Warm neutrals and deep orange-red accents should carry the site so every page feels
              like the same product instead of separate tools stitched together.
            </p>
            <p>
              The interface should surface operator truth without looking harsh: softer cards,
              fewer cold grays, stronger headings, and cleaner rhythm between sections.
            </p>
            <p>
              Twin should read like a focused assistant, not a generic SaaS dashboard.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-[rgba(227,205,188,0.9)] bg-[rgba(255,248,242,0.78)]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-12 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-brand text-4xl leading-none text-[rgb(41,28,22)]">
              Build your Twin before the next job drop.
            </p>
            <p className="mt-2 text-sm text-[rgb(125,99,82)]">
              Set up your profile once, then keep approval as the only manual step.
            </p>
          </div>
          <Link
            href="/onboarding"
            className="inline-flex items-center justify-center gap-3 rounded-full bg-[rgb(41,28,22)] px-7 py-4 text-sm font-semibold text-white transition hover:bg-[rgb(68,47,37)]"
          >
            Start with your profile
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </footer>
    </main>
  );
}
