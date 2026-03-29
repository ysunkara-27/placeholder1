import Link from "next/link";
import { ArrowRight, Zap, Bell, FileText } from "lucide-react";

const FEATURES = [
  {
    icon: FileText,
    title: "Build once",
    description:
      "Chat with Claude to create a perfect, structured resume. Upload a PDF or start from scratch.",
  },
  {
    icon: Bell,
    title: "Get alerted instantly",
    description:
      "We watch every major job board 24/7. You get an SMS or email the moment a match drops.",
  },
  {
    icon: Zap,
    title: "Apply in one tap",
    description:
      "Reply YES to an alert. Our agent fills and submits the application — you don't touch a form.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white flex flex-col">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto w-full">
        <span className="text-lg font-semibold tracking-tight text-gray-900">
          AutoApply
        </span>
        <Link
          href="/onboarding"
          className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
        >
          Get started
        </Link>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-6 pt-20 pb-24 flex-1">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3.5 py-1.5 text-xs font-medium text-indigo-600 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          Now monitoring 50+ job boards
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-gray-900 max-w-2xl leading-tight text-balance">
          Build your profile once.{" "}
          <span className="text-indigo-600">Apply on autopilot.</span>
        </h1>

        <p className="mt-6 text-lg text-gray-500 max-w-xl text-balance">
          AutoApply monitors job boards around the clock. The moment a match drops,
          you get an alert. Reply YES and our agent submits the application for you.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 items-center">
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 active:bg-indigo-800 transition-colors"
          >
            Set up my profile
            <ArrowRight className="w-4 h-4" />
          </Link>
          <span className="text-sm text-gray-400">Takes ~5 minutes</span>
        </div>

        {/* Social proof */}
        <p className="mt-8 text-xs text-gray-400">
          Free to start · No credit card required
        </p>
      </section>

      {/* Features */}
      <section className="border-t border-gray-100 px-6 py-20">
        <div className="max-w-4xl mx-auto grid grid-cols-1 gap-8 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex flex-col gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{title}</h3>
                <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SMS mockup / alert preview */}
      <section className="bg-gray-50 border-t border-gray-100 px-6 py-20">
        <div className="max-w-sm mx-auto">
          <p className="text-xs text-gray-400 text-center mb-6 uppercase tracking-wider font-medium">
            What an alert looks like
          </p>
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold shrink-0">
                AA
              </div>
              <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-900 leading-relaxed">
                📌 <strong>SWE Intern @ Stripe</strong> | New York | Posted 4 min ago
                <br />
                <span className="text-indigo-600">stripe.com/jobs/...</span>
                <br />
                <br />
                Reply <strong>YES</strong> to auto-apply, <strong>NO</strong> to skip, or <strong>STOP</strong> to pause.
              </div>
            </div>
            <div className="flex justify-end">
              <div className="bg-indigo-600 rounded-2xl rounded-tr-sm px-4 py-2 text-sm text-white">
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
      <footer className="border-t border-gray-100 px-6 py-12 text-center">
        <h2 className="text-2xl font-bold text-gray-900">Ready to apply smarter?</h2>
        <p className="mt-2 text-gray-500">Set up your profile in 5 minutes. We handle the rest.</p>
        <Link
          href="/onboarding"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
        >
          Get started for free
          <ArrowRight className="w-4 h-4" />
        </Link>
        <p className="mt-8 text-xs text-gray-400">© 2026 AutoApply</p>
      </footer>
    </main>
  );
}
