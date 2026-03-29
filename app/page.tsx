import Link from "next/link";
import { ArrowRight, Bell, FileText, Zap } from "lucide-react";

const FEATURES = [
  {
    icon: FileText,
    title: "Build once. Reuse forever.",
    description:
      "Upload your resume, lock the facts that cannot change, and let Twin tailor the rest per application.",
  },
  {
    icon: Bell,
    title: "Get the alert first.",
    description:
      "Twin is being built to watch internship portals continuously so you see matches before the feed gets saturated.",
  },
  {
    icon: Zap,
    title: "Portal-first auto-apply.",
    description:
      "Greenhouse and Lever are deterministic first. Vision fallback only handles the weird portals.",
  },
];

const PORTALS = [
  "Greenhouse",
  "Lever",
  "Workday",
  "Handshake",
  "Vision fallback",
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white flex flex-col">
      <header className="px-6 py-5 max-w-5xl mx-auto w-full flex items-center justify-between">
        <span className="text-lg font-semibold tracking-tight text-gray-900">
          Twin
        </span>
        <span className="text-xs font-medium uppercase tracking-[0.22em] text-indigo-500">
          Internship Agent
        </span>
      </header>

      <section className="flex flex-col items-center justify-center text-center px-6 pt-16 pb-24 flex-1">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3.5 py-1.5 text-xs font-medium text-indigo-600 mb-10">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          Building deterministic portal agents first
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-gray-900 max-w-3xl leading-tight text-balance">
          While you sleep,{" "}
          <span className="text-indigo-600">your Twin is applying.</span>
        </h1>

        <p className="mt-6 text-lg text-gray-500 max-w-2xl text-balance leading-relaxed">
          Twin builds your application profile, watches internship portals,
          routes jobs by ATS type, and eventually submits through deterministic
          automations instead of expensive agent calls.
        </p>

        <div className="mt-12">
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-3 rounded-2xl bg-indigo-600 px-10 py-5 text-xl font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:bg-indigo-800 transition-all hover:shadow-xl hover:shadow-indigo-200 hover:-translate-y-0.5"
          >
            Build my Twin
            <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="mt-4 text-sm text-gray-400">
            Free · Takes 4 minutes · Phone optional
          </p>
        </div>
      </section>

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

      <section className="bg-gray-50 border-t border-gray-100 px-6 py-20">
        <div className="max-w-4xl mx-auto grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="text-left">
            <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">
              Apply engine plan
            </p>
            <h2 className="mt-3 text-3xl font-bold text-gray-900">
              Detect portal. Route agent. Fall back only when needed.
            </h2>
            <p className="mt-4 text-sm leading-7 text-gray-500">
              The lowest-cost version of Twin is deterministic first:
              Greenhouse and Lever agents for the most common internship flows,
              Workday later, vision only when the page stops being predictable.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {PORTALS.map((portal) => (
                <span
                  key={portal}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600"
                >
                  {portal}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5 space-y-3">
            <p className="text-xs text-gray-400 text-center uppercase tracking-wider font-medium">
              What an alert looks like
            </p>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold shrink-0">
                T
              </div>
              <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-900 leading-relaxed">
                📌 <strong>SWE Intern @ Scale AI</strong> | San Francisco | Greenhouse
                <br />
                <span className="text-indigo-600 text-xs">job-boards.greenhouse.io/scaleai/...</span>
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
                T
              </div>
              <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-900">
                ✅ <strong>Applied through Greenhouse</strong> — confirmation #A8F21B
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-100 px-6 py-16 text-center">
        <h2 className="text-2xl font-bold text-gray-900">
          Meet your Twin.
        </h2>
        <p className="mt-2 text-gray-500">
          Profile memory, portal routing, deterministic apply agents.
        </p>
        <Link
          href="/onboarding"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-7 py-3.5 text-sm font-semibold text-white hover:bg-gray-800 active:bg-gray-950 transition-colors"
        >
          Start onboarding
          <ArrowRight className="w-4 h-4" />
        </Link>
        <p className="mt-10 text-xs text-gray-400">© 2026 Twin</p>
      </footer>
    </main>
  );
}
