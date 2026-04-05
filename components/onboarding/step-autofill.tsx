"use client";

import { cn } from "@/lib/utils";
import type { DisclosurePolicy, EEOData } from "@/lib/types";

interface Props {
  eeo: EEOData | null;
  gpaDisclosurePolicy: DisclosurePolicy;
  eeoDisclosurePolicy: DisclosurePolicy;
  onChange: (patch: {
    eeo?: EEOData | null;
    gpa_disclosure_policy?: DisclosurePolicy;
    eeo_disclosure_policy?: DisclosurePolicy;
  }) => void;
}

const GENDER_OPTIONS = [
  "Man",
  "Woman",
  "Non-binary",
  "Genderqueer / Non-conforming",
  "Agender",
  "Two-spirit",
  "Prefer not to say",
];

const RACE_OPTIONS = [
  "Hispanic or Latino",
  "American Indian or Alaska Native",
  "Asian",
  "Black or African American",
  "Native Hawaiian or Pacific Islander",
  "White",
  "Middle Eastern or North African",
  "Two or more races",
  "Prefer not to say",
];

const VETERAN_OPTIONS = [
  "Not a veteran",
  "Active duty or recently separated",
  "Protected veteran",
  "Disabled veteran",
  "Prefer not to say",
];

const DISABILITY_STATUS_OPTIONS = [
  "No, I do not have a disability",
  "Yes, I have a disability (or have had one)",
  "Prefer not to say",
];

const DISABILITY_TYPE_OPTIONS = [
  "ADHD / Learning disability",
  "Autism / Neurodivergent",
  "Anxiety / Depression / Mental health",
  "Chronic illness / Autoimmune condition",
  "Blind or low vision",
  "Deaf or hard of hearing",
  "Mobility / Physical impairment",
  "Diabetes",
  "Epilepsy / Seizure disorder",
  "Cancer / Serious medical condition",
  "Traumatic brain injury",
  "Other",
];

const GPA_RANGES = [
  "Below 3.0",
  "3.0 – 3.2",
  "3.2 – 3.4",
  "3.4 – 3.6",
  "3.6 – 3.8",
  "3.8 – 4.0",
];

const SAT_RANGES = [
  "Below 1000",
  "1000 – 1100",
  "1100 – 1200",
  "1200 – 1300",
  "1300 – 1400",
  "1400 – 1500",
  "1500 – 1600",
];

const ACT_RANGES = [
  "Below 24",
  "24 – 27",
  "27 – 30",
  "30 – 33",
  "33 – 36",
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
            "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-150",
            selected === opt
              ? "border-accent bg-accent text-white shadow-warm"
              : "border-rim bg-white text-dim hover:border-accent/30 hover:bg-surface"
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-ink">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-rim bg-white px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 transition-colors duration-150 shadow-soft-card"
      >
        <option value="">{placeholder ?? "Select…"}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

export function StepAutofill({
  eeo,
  gpaDisclosurePolicy,
  eeoDisclosurePolicy,
  onChange,
}: Props) {
  function patch(key: keyof EEOData, val: string) {
    const current: EEOData = eeo ?? {};
    const updated: EEOData = { ...current };

    if (val.trim() === "") {
      delete updated[key];
    } else {
      updated[key] = val;
    }

    // Clear disability_type if disability_status is no longer "yes"
    if (key === "disability_status" && !val.toLowerCase().startsWith("yes")) {
      delete updated.disability_type;
    }

    const hasValues = Object.keys(updated).some(
      (k) => (updated[k as keyof EEOData] ?? "").trim() !== ""
    );

    onChange({ eeo: hasValues ? updated : null });
  }

  const val = (key: keyof EEOData) => eeo?.[key] ?? "";
  const hasDisability = val("disability_status").toLowerCase().startsWith("yes");

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-4xl leading-none text-ink">
          Application autofill
        </h1>
        <p className="text-dim leading-7">
          Most applications require these fields. Your Twin pre-fills them
          automatically — saving you time on every form.
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        🔒 This data never leaves your account and is only used to pre-fill forms.
      </div>

      <div className="space-y-4 rounded-2xl border border-rim bg-surface/60 p-4">
        <div>
          <p className="text-sm font-semibold text-ink">Disclosure rules</p>
          <p className="mt-1 text-xs leading-5 text-dim">
            Keep optional details private unless a portal explicitly requires them.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <PolicyField
            label="GPA"
            value={gpaDisclosurePolicy}
            onChange={(value) => onChange({ gpa_disclosure_policy: value })}
          />
          <PolicyField
            label="Demographic responses"
            value={eeoDisclosurePolicy}
            onChange={(value) => onChange({ eeo_disclosure_policy: value })}
          />
        </div>
      </div>

      <div className="space-y-6">
        {/* Pronouns */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">Pronouns</label>
          <input
            type="text"
            placeholder="e.g. they/them, she/her"
            value={val("pronouns")}
            onChange={(e) => patch("pronouns", e.target.value)}
            className="w-full rounded-xl border border-rim bg-white px-4 py-3 text-sm text-ink placeholder:text-dim/60 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 transition-colors duration-150 shadow-soft-card"
          />
        </div>

        {/* Gender identity */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">
            Gender identity
          </label>
          <ChipGroup
            options={GENDER_OPTIONS}
            selected={val("gender")}
            onSelect={(v) => patch("gender", v)}
          />
        </div>

        {/* Race / Ethnicity */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">
            Race / Ethnicity
          </label>
          <ChipGroup
            options={RACE_OPTIONS}
            selected={val("race_ethnicity")}
            onSelect={(v) => patch("race_ethnicity", v)}
          />
        </div>

        {/* Veteran status */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">
            Veteran status
          </label>
          <ChipGroup
            options={VETERAN_OPTIONS}
            selected={val("veteran_status")}
            onSelect={(v) => patch("veteran_status", v)}
          />
        </div>

        {/* Disability status */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">
            Disability status
          </label>
          <ChipGroup
            options={DISABILITY_STATUS_OPTIONS}
            selected={val("disability_status")}
            onSelect={(v) => patch("disability_status", v)}
          />
          {hasDisability && (
            <div className="mt-2 flex flex-col gap-1.5">
              <label className="text-xs font-medium text-dim">
                Condition type{" "}
                <span className="text-dim/80 font-normal">
                  (select the most accurate — used when applications show a
                  prepopulated list)
                </span>
              </label>
              <ChipGroup
                options={DISABILITY_TYPE_OPTIONS}
                selected={val("disability_type")}
                onSelect={(v) => patch("disability_type", v)}
              />
            </div>
          )}
        </div>

        {/* Academic scores */}
        <div className="space-y-3 border-t border-rim pt-6">
          <p className="text-xs font-bold uppercase tracking-widest text-dim">
            Academic scores
          </p>
          <p className="text-sm text-dim">
            Some applications ask for ranges rather than exact numbers. Pre-fill
            these so your Twin selects the right bucket automatically.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <SelectField
              label="GPA range"
              value={val("gpa_range")}
              options={GPA_RANGES}
              placeholder="Select range"
              onChange={(v) => patch("gpa_range", v)}
            />
            <SelectField
              label="SAT score range"
              value={val("sat_range")}
              options={SAT_RANGES}
              placeholder="Select range"
              onChange={(v) => patch("sat_range", v)}
            />
            <SelectField
              label="ACT score range"
              value={val("act_range")}
              options={ACT_RANGES}
              placeholder="Select range"
              onChange={(v) => patch("act_range", v)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PolicyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: DisclosurePolicy;
  onChange: (value: DisclosurePolicy) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-ink">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange("required_only")}
          className={cn(
            "rounded-xl border px-3 py-3 text-left text-sm font-medium transition-colors duration-150",
            value === "required_only"
              ? "border-accent bg-accent-wash text-accent"
              : "border-rim bg-white text-dim hover:border-accent/30 hover:text-ink"
          )}
        >
          Only when required
        </button>
        <button
          type="button"
          onClick={() => onChange("always")}
          className={cn(
            "rounded-xl border px-3 py-3 text-left text-sm font-medium transition-colors duration-150",
            value === "always"
              ? "border-accent bg-accent-wash text-accent"
              : "border-rim bg-white text-dim hover:border-accent/30 hover:text-ink"
          )}
        >
          Always include
        </button>
      </div>
    </div>
  );
}
