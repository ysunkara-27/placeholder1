"use client";

import { Input } from "@/components/ui/input";

interface Props {
  phone: string;
  name: string;
  onChange: (phone: string) => void;
  onSkip: () => void;
}

export function StepPhone({ phone, name, onChange, onSkip }: Props) {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          One last thing — how does your Twin reach you?
        </h1>
        <p className="text-gray-500">
          Get an SMS the moment a match drops. Reply YES and your Twin applies
          instantly. No phone number means email/app alerts later instead.
        </p>
      </div>

      {/* Phone input */}
      <div className="flex gap-2 items-end">
        <div className="flex h-10 items-center rounded-l-lg border border-r-0 border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-500 shrink-0">
          +1
        </div>
        <Input
          placeholder="(555) 000-0000"
          type="tel"
          value={phone}
          onChange={(e) => {
            // Strip non-numeric for storage, display as-is
            onChange(e.target.value.replace(/[^\d]/g, "").slice(0, 10));
          }}
          autoComplete="tel-national"
          className="rounded-l-none"
        />
      </div>

      {/* SMS mockup */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3 shadow-sm">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-4">
          What an alert looks like
        </p>
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold shrink-0">
            AA
          </div>
          <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-900 leading-relaxed">
            📌 <strong>SWE Intern @ Stripe</strong> | New York | Posted 2 min ago
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
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold shrink-0">
            AA
          </div>
          <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-900">
            ✅ <strong>Applied to Stripe</strong>
            {name && ` for ${name.split(" ")[0]}`} — confirmation #A8F21B
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Phone is optional · Standard messaging rates apply · Reply STOP anytime to pause alerts
      </p>

      {/* Skip */}
      <div className="flex justify-center">
        <button
          onClick={onSkip}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2"
        >
          Skip for now — use email alerts instead
        </button>
      </div>
    </div>
  );
}
