import Link from "next/link";
import { ArrowRight, Zap, Bell, FileText } from "lucide-react";

const FEATURES = [
  {
    icon: FileText,
    title: "Build once. Clone forever.",
    description:
      "Upload your resume. Tell us what to lock and what to adapt. Your Twin uses that blueprint to tailor every application — no re-entering anything.",
  },
  {
    icon: Bell,
    title: "Get the alert first.",
    description:
      "We watch 50+ job boards around the clock. You hear about a role within minutes of it posting — before most applicants even know it exists.",
  },
  {
    icon: Zap,
    title: "One word. Applied.",
    description:
      "Reply YES to an alert and your Twin fills out the full application, attaches your resume, and submits it — while you're in class.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white flex flex-col">
      {/* Nav — logo only, no competing links */}
      <header className="px-6 py-5 max-w-5xl mx-auto w-full">
        <span className="text-lg font-semibold tracking-tight text-gray-900">
          AutoApply
        </span>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-6 pt-16 pb-24 flex-1">
        {/* Live badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3.5 py-1.5 text-xs font-medium text-indigo-600 mb-10">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          1,240 applications submitted this week
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-gray-900 max-w-2xl leading-tight text-balance">
          While you sleep,{" "}
          <span className="text-indigo-600">your Twin is applying.</span>
        </h1>

        <p className="mt-6 text-lg text-gray-500 max-w-xl text-balance leading-relaxed">
          AutoApply builds your digital Twin — an AI agent watching every job
          board 24/7, tailoring your resume per role, and submitting
          applications the moment a match drops. You reply YES.
        </p>

        {/* Single dominant CTA */}
        <div className="mt-12">
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-3 rounded-2xl bg-indigo-600 px-10 py-5 text-xl font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:bg-indigo-800 transition-all hover:shadow-xl hover:shadow-indigo-200 hover:-translate-y-0.5"
          >
            Apply to everything, now
            <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="mt-4 text-sm text-gray-400">
            Free · Takes 4 minutes · No credit card
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-gray-100 px-6 py-20">
        <div className="max-w-4xl mx-auto grid grid-cols-1 gap-10 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex flex-col gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SMS alert mockup */}
      <section className="bg-gray-50 border-t border-gray-100 px-6 py-20">
        <div className="max-w-sm mx-auto">
          <p className="text-xs text-gray-400 text-center mb-8 uppercase tracking-wider font-medium">
            What an alert looks like
          </p>
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold shrink-0">
                AA
              </div>
              <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-900 leading-relaxed">
                📌 <strong>SWE Intern @ Stripe</strong> | New York | Posted 3 min ago
                <br />
                <span className="text-indigo-600 text-xs">stripe.com/jobs/engineering-intern</span>
                <br />
                <br />
                Reply <strong>YES</strong> to auto-apply, <strong>NO</strong> to skip.
              </div>
            </div>
            <div className="flex justify-end">
              <div className="bg-indigo-600 rounded-2xl rounded-tr-sm px-4 py-2 text-sm text-white font-medium">
                YES
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold shrink-0">
                AA
              </div>
              <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-900">
                ✅ <strong>Applied to Stripe</strong> — confirmation #A8F21B
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <footer className="border-t border-gray-100 px-6 py-16 text-center">
        <h2 className="text-2xl font-bold text-gray-900">
          Meet your Twin.
        </h2>
        <p className="mt-2 text-gray-500">
          Set up in 4 minutes. Runs forever.
        </p>
        <Link
          href="/onboarding"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-7 py-3.5 text-sm font-semibold text-white hover:bg-gray-800 active:bg-gray-950 transition-colors"
        >
          Apply to everything, now
          <ArrowRight className="w-4 h-4" />
        </Link>
        <p className="mt-10 text-xs text-gray-400">© 2026 AutoApply</p>
      </footer>
    </main>
  );
}
