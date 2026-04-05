"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  INDUSTRY_OPTIONS,
  LEVEL_OPTIONS,
  TARGET_TERM_OPTIONS,
  cn,
} from "@/lib/utils";
import type { Industry, JobLevel, TargetTerm } from "@/lib/types";
import { CheckCircle2, MapPin, Wifi, X } from "lucide-react";

const LOCATION_REGIONS = [
  {
    label: "United States",
    cities: [
      "New York City",
      "San Francisco",
      "Chicago",
      "Los Angeles",
      "Boston",
      "Seattle",
      "Washington DC",
      "Austin",
      "Miami",
      "Denver",
      "Atlanta",
      "Philadelphia",
    ],
  },
  {
    label: "Europe",
    cities: [
      "London",
      "Berlin",
      "Amsterdam",
      "Paris",
      "Dublin",
      "Zurich",
      "Stockholm",
      "Barcelona",
      "Munich",
    ],
  },
  {
    label: "Asia Pacific",
    cities: [
      "Singapore",
      "Tokyo",
      "Seoul",
      "Hong Kong",
      "Sydney",
      "Bangalore",
      "Shanghai",
    ],
  },
  {
    label: "Canada",
    cities: ["Toronto", "Vancouver", "Montreal", "Calgary"],
  },
] as const;

interface Props {
  industries: Industry[];
  levels: JobLevel[];
  targetTerms: TargetTerm[];
  targetYears: number[];
  locations: string[];
  remoteOk: boolean;
  onChange: (
    patch: Partial<{
      industries: Industry[];
      levels: JobLevel[];
      target_terms: TargetTerm[];
      target_years: number[];
      locations: string[];
      remote_ok: boolean;
    }>
  ) => void;
}

export function StepPreferences({
  industries,
  levels,
  targetTerms,
  targetYears,
  locations,
  remoteOk,
  onChange,
}: Props) {
  const [cityInput, setCityInput] = useState("");
  const [yearInput, setYearInput] = useState("");

  // ── Location helpers ──────────────────────────────────────────────────────
  function toggleLocation(city: string) {
    if (locations.includes(city)) {
      onChange({ locations: locations.filter((l) => l !== city) });
    } else {
      onChange({ locations: [...locations, city] });
    }
  }
  function addCustomLocation(city: string) {
    const t = city.trim();
    if (!t || locations.includes(t)) return;
    onChange({ locations: [...locations, t] });
    setCityInput("");
  }

  // ── Toggle helpers ────────────────────────────────────────────────────────
  function toggleIndustry(v: Industry) {
    onChange({
      industries: industries.includes(v)
        ? industries.filter((i) => i !== v)
        : [...industries, v],
    });
  }
  function toggleLevel(v: JobLevel) {
    onChange({
      levels: levels.includes(v)
        ? levels.filter((l) => l !== v)
        : [...levels, v],
    });
  }
  function toggleTargetTerm(v: TargetTerm) {
    onChange({
      target_terms: targetTerms.includes(v)
        ? targetTerms.filter((term) => term !== v)
        : [...targetTerms, v],
    });
  }
  function addTargetYear(raw: string) {
    const year = Number(raw.trim());
    if (
      !Number.isInteger(year) ||
      year < 2025 ||
      year > 2035 ||
      targetYears.includes(year)
    ) {
      setYearInput("");
      return;
    }
    onChange({ target_years: [...targetYears, year].sort() });
    setYearInput("");
  }
  function removeTargetYear(year: number) {
    onChange({ target_years: targetYears.filter((v) => v !== year) });
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-4xl leading-none text-ink">
          What are you looking for?
        </h1>
        <p className="text-dim leading-7">
          Your Twin will only apply to jobs that match these filters.
        </p>
      </div>

      {/* Industries */}
      <SubSection label="Industries">
        <div className="flex flex-wrap gap-2">
          {INDUSTRY_OPTIONS.map(({ value, label }) => (
            <Badge
              key={value}
              selected={industries.includes(value as Industry)}
              onClick={() => toggleIndustry(value as Industry)}
              size="md"
            >
              {label}
            </Badge>
          ))}
        </div>
      </SubSection>

      {/* Role type */}
      <SubSection label="Role type">
        <div className="grid grid-cols-2 gap-2">
          {LEVEL_OPTIONS.map(({ value, label, description }) => {
            const isSelected = levels.includes(value as JobLevel);
            return (
              <button
                key={value}
                onClick={() => toggleLevel(value as JobLevel)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3 text-left transition-all duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-1 shadow-soft-card",
                  isSelected
                    ? "border-accent bg-accent-wash"
                    : "border-rim bg-white hover:border-accent/30 hover:bg-surface"
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                    isSelected
                      ? "border-accent bg-accent text-white"
                      : "border-rim bg-white text-dim"
                  )}
                >
                  {isSelected && <CheckCircle2 className="w-3 h-3" />}
                </div>
                <div>
                  <p className="font-medium text-ink text-sm">{label}</p>
                  <p className="text-xs text-dim mt-0.5">{description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </SubSection>

      {/* Timing */}
      <SubSection label="Timing">
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-ink">
              Target terms
            </p>
            <div className="flex flex-wrap gap-2">
              {TARGET_TERM_OPTIONS.map(({ value, label }) => (
                <Badge
                  key={value}
                  selected={targetTerms.includes(value)}
                  onClick={() => toggleTargetTerm(value)}
                  size="md"
                >
                  {label}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-ink">
              Target years
            </p>
            <div className="min-h-[44px] flex flex-wrap gap-2 rounded-xl border border-rim bg-white p-2 shadow-soft-card">
              {targetYears.map((year) => (
                <span
                  key={year}
                  className="inline-flex items-center gap-1 rounded-md bg-accent-wash border border-accent/20 px-2 py-1 text-sm font-medium text-accent"
                >
                  {year}
                  <button
                    onClick={() => removeTargetYear(year)}
                    aria-label={`Remove ${year}`}
                    className="ml-0.5 hover:text-ink transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input
                value={yearInput}
                onChange={(e) => setYearInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTargetYear(yearInput);
                  }
                }}
                onBlur={() => addTargetYear(yearInput)}
                placeholder={
                  targetYears.length === 0 ? "Add year, e.g. 2027" : ""
                }
                className="flex-1 min-w-[140px] bg-transparent text-sm text-ink placeholder:text-dim/60 outline-none"
              />
            </div>
          </div>
        </div>
      </SubSection>

      {/* Locations */}
      <SubSection label="Where">
        <div className="space-y-4">
          {/* Selected chips */}
          {locations.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {locations.map((city) => (
                <span
                  key={city}
                  className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-sm font-medium text-white shadow-warm"
                >
                  <MapPin className="w-3 h-3 opacity-70" />
                  {city}
                  <button
                    onClick={() => toggleLocation(city)}
                    aria-label={`Remove ${city}`}
                    className="ml-0.5 hover:opacity-70 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Regional presets */}
          <div className="space-y-3">
            {LOCATION_REGIONS.map((region) => (
              <div key={region.label}>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-dim">
                  {region.label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {region.cities.map((city) => (
                    <Badge
                      key={city}
                      size="sm"
                      selected={locations.includes(city)}
                      onClick={() => toggleLocation(city)}
                    >
                      {city}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Custom city input */}
          <div className="flex gap-2">
            <input
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addCustomLocation(cityInput);
                }
              }}
              onBlur={() => addCustomLocation(cityInput)}
              placeholder="Add another city..."
              className="flex-1 rounded-xl border border-rim bg-white px-3 py-2 text-sm text-ink placeholder:text-dim/60 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 transition-colors shadow-soft-card"
            />
          </div>

          {/* Remote toggle */}
          <button
            onClick={() => onChange({ remote_ok: !remoteOk })}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-3 w-full text-left transition-all duration-150",
              remoteOk
                ? "border-accent bg-accent-wash shadow-soft-card"
                : "border-rim bg-white hover:border-accent/30 shadow-soft-card"
            )}
          >
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                remoteOk ? "bg-accent text-white" : "bg-surface text-dim"
              )}
            >
              <Wifi className="w-4 h-4" />
            </div>
            <div>
              <p className="font-medium text-sm text-ink">
                Open to remote
              </p>
              <p className="text-xs text-dim">
                Include fully remote positions
              </p>
            </div>
            <div
              className={cn(
                "ml-auto h-5 w-9 rounded-full transition-colors duration-200 relative shrink-0",
                remoteOk ? "bg-accent" : "bg-surface-strong"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200",
                  remoteOk ? "left-[18px]" : "left-0.5"
                )}
              />
            </div>
          </button>
        </div>
      </SubSection>
    </div>
  );
}

// ── Sub-section wrapper ───────────────────────────────────────────────────────

function SubSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 pt-6 border-t border-rim first:border-t-0 first:pt-0">
      <h3 className="text-xs font-bold uppercase tracking-widest text-dim">
        {label}
      </h3>
      {children}
    </div>
  );
}
