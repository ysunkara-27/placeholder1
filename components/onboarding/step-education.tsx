"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  school: string;
  major: string;
  degree: string;
  gpa: string;
  graduation: string;
  authorized_to_work: boolean;
  visa_type: string;
  earliest_start_date: string;
  onChange: (patch: Partial<{
    school: string;
    major: string;
    degree: string;
    gpa: string;
    graduation: string;
    authorized_to_work: boolean;
    visa_type: string;
    earliest_start_date: string;
  }>) => void;
}

const DEGREE_OPTIONS = ["B.S.", "M.S.", "Ph.D.", "M.B.A.", "Associate's", "B.A.", "Other"] as const;

const VISA_OPTIONS = [
  { label: "US Citizen",   value: "citizen" },
  { label: "Green Card",   value: "green_card" },
  { label: "OPT (F-1)",    value: "opt" },
  { label: "CPT (F-1)",    value: "cpt" },
  { label: "H-1B",         value: "h1b" },
  { label: "TN Visa",      value: "tn" },
  { label: "Other",        value: "other" },
] as const;

export function StepEducation({
  school, major, degree, gpa, graduation,
  authorized_to_work, visa_type, earliest_start_date,
  onChange,
}: Props) {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Education &amp; work authorization
        </h1>
        <p className="text-gray-500">
          Portals like Workday pull your school details automatically.
        </p>
      </div>

      {/* Education section */}
      <div className="space-y-4">
        <Input
          label="University"
          placeholder="University of Virginia"
          value={school}
          onChange={(e) => onChange({ school: e.target.value })}
          autoComplete="organization"
          required
        />

        <Input
          label="Major / Field of study"
          placeholder="Computer Science"
          value={major}
          onChange={(e) => onChange({ major: e.target.value })}
          required
        />

        {/* Degree type pill grid */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Degree type</label>
          <div className="flex flex-wrap gap-2">
            {DEGREE_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onChange({ degree: opt })}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors duration-150",
                  degree === opt
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="GPA"
            placeholder="3.7"
            value={gpa}
            onChange={(e) => onChange({ gpa: e.target.value })}
            hint="Optional"
          />
          <Input
            label="Graduation"
            placeholder="May 2026"
            value={graduation}
            onChange={(e) => onChange({ graduation: e.target.value })}
            required
          />
        </div>
      </div>

      {/* Work authorization section */}
      <div className="space-y-4 border-t border-gray-100 pt-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Work Authorization
        </p>

        {/* Yes / No sponsorship toggle */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">
            Are you authorized to work in the US without sponsorship?
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onChange({ authorized_to_work: true })}
              className={cn(
                "rounded-xl border px-4 py-3 text-sm font-medium text-left transition-colors duration-150",
                authorized_to_work
                  ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              )}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => onChange({ authorized_to_work: false })}
              className={cn(
                "rounded-xl border px-4 py-3 text-sm font-medium text-left transition-colors duration-150",
                !authorized_to_work
                  ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              )}
            >
              No — I need sponsorship
            </button>
          </div>
        </div>

        {/* Visa / immigration status chips */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">
            Visa / Immigration status
          </label>
          <div className="flex flex-wrap gap-2">
            {VISA_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ visa_type: opt.value })}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors duration-150",
                  visa_type === opt.value
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <Input
          label="Earliest start date"
          placeholder="May 2026  or  Immediately"
          value={earliest_start_date}
          onChange={(e) => onChange({ earliest_start_date: e.target.value })}
          required
        />
      </div>
    </div>
  );
}
