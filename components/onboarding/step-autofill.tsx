"use client";

import { cn } from "@/lib/utils";

interface EEOData {
  pronouns?: string;
  gender?: string;
  race_ethnicity?: string;
  veteran_status?: string;
  disability_status?: string;
}

interface Props {
  eeo: EEOData | null;
  onChange: (eeo: EEOData | null) => void;
}

const GENDER_OPTIONS = [
  "Man",
  "Woman",
  "Non-binary",
  "Genderqueer / Non-conforming",
  "Prefer not to say",
];

const RACE_OPTIONS = [
  "Hispanic or Latino",
  "American Indian or Alaska Native",
  "Asian",
  "Black or African American",
  "Native Hawaiian or Pacific Islander",
  "White",
  "Two or more races",
  "Prefer not to say",
];

const VETERAN_OPTIONS = [
  "Not a veteran",
  "Protected veteran",
  "Recently separated veteran",
  "Prefer not to say",
];

const DISABILITY_OPTIONS = [
  "No disability",
  "Yes, I have a disability",
  "Prefer not to say",
];

function ChipGroup({
  options,
  selected,
  onSelect,
}: {
  options: string[];
  selected: string;
  onSelect: (val: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onSelect(selected === opt ? "" : opt)}
          className={cn(
            "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors duration-150",
            selected === opt
              ? "border-indigo-600 bg-indigo-600 text-white"
              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export function StepAutofill({ eeo, onChange }: Props) {
  function patch(key: keyof EEOData, val: string) {
    const current: EEOData = eeo ?? {};
    const updated: EEOData = { ...current };

    if (val.trim() === "") {
      delete updated[key];
    } else {
      updated[key] = val;
    }

    const hasValues = Object.keys(updated).some(
      (k) => (updated[k as keyof EEOData] ?? "").trim() !== ""
    );

    onChange(hasValues ? updated : null);
  }

  const val = (key: keyof EEOData) => eeo?.[key] ?? "";

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Autofill extras
        </h1>
        <p className="text-gray-500">
          Used only to fill optional diversity sections on job applications.
          Skip anything you&apos;d rather not share.
        </p>
      </div>

      {/* Privacy callout */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        🔒 This data never leaves your account and is only used to pre-fill forms.
      </div>

      <div className="space-y-5">
        {/* Pronouns */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Pronouns</label>
          <input
            type="text"
            placeholder="e.g. they/them, she/her"
            value={val("pronouns")}
            onChange={(e) => patch("pronouns", e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors duration-150"
          />
        </div>

        {/* Gender identity */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Gender identity</label>
          <ChipGroup
            options={GENDER_OPTIONS}
            selected={val("gender")}
            onSelect={(v) => patch("gender", v)}
          />
        </div>

        {/* Race / Ethnicity */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Race / Ethnicity</label>
          <ChipGroup
            options={RACE_OPTIONS}
            selected={val("race_ethnicity")}
            onSelect={(v) => patch("race_ethnicity", v)}
          />
        </div>

        {/* Veteran status */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Veteran status</label>
          <ChipGroup
            options={VETERAN_OPTIONS}
            selected={val("veteran_status")}
            onSelect={(v) => patch("veteran_status", v)}
          />
        </div>

        {/* Disability status */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Disability status</label>
          <ChipGroup
            options={DISABILITY_OPTIONS}
            selected={val("disability_status")}
            onSelect={(v) => patch("disability_status", v)}
          />
        </div>
      </div>
    </div>
  );
}
