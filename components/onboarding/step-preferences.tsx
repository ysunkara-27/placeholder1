"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  INDUSTRY_OPTIONS,
  LEVEL_OPTIONS,
  TARGET_TERM_OPTIONS,
  cn,
} from "@/lib/utils";
import {
  getGeoLeafLabel,
  getGeoNode,
  getGeoNodeChildren,
  getGeoNodePath,
  getGeoPathLabel,
  getGeoRootNodes,
  isGeoAncestorSelection,
  normalizeStoredLocationSelection,
} from "@/lib/profile-geo";
import type { Industry, JobLevel, TargetTerm, WorkModality } from "@/lib/types";
import { CheckCircle2, ChevronRight, MapPin, Wifi, X } from "lucide-react";

interface Props {
  industries: Industry[];
  levels: JobLevel[];
  targetTerms: TargetTerm[];
  targetYears: number[];
  locations: string[];
  remoteOk: boolean;
  workModalityAllow: WorkModality[];
  openToRelocate: boolean;
  onChange: (
    patch: Partial<{
      industries: Industry[];
      levels: JobLevel[];
      target_terms: TargetTerm[];
      target_years: number[];
      locations: string[];
      remote_ok: boolean;
      work_modality_allow: WorkModality[];
      open_to_relocate: boolean;
    }>
  ) => void;
}

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function StepPreferences({
  industries,
  levels,
  targetTerms,
  targetYears,
  locations,
  remoteOk,
  workModalityAllow,
  openToRelocate,
  onChange,
}: Props) {
  const [yearInput, setYearInput] = useState("");
  const [activeGeoSlug, setActiveGeoSlug] = useState<string | null>(null);

  const normalizedLocations = useMemo(
    () =>
      uniq(
        locations
          .map((value) => normalizeStoredLocationSelection(value) ?? value.trim())
          .filter(Boolean)
      ),
    [locations]
  );
  const activeGeoPath = activeGeoSlug ? getGeoNodePath(activeGeoSlug) : [];
  const activeGeoChildren = getGeoNodeChildren(activeGeoSlug);
  const activeGeoNode = activeGeoSlug ? getGeoNode(activeGeoSlug) : null;

  function replaceLocations(nextLocations: string[]) {
    onChange({ locations: uniq(nextLocations) });
  }

  function removeLocation(slug: string) {
    replaceLocations(normalizedLocations.filter((value) => value !== slug));
  }

  function addLocationSelection(slug: string) {
    const next = normalizedLocations
      .filter((existing) => !isGeoAncestorSelection(existing, slug))
      .filter((existing) => !isGeoAncestorSelection(slug, existing));
    replaceLocations([...next, slug]);
    setActiveGeoSlug(null);
  }

  function chooseGeoNode(slug: string) {
    setActiveGeoSlug(slug);
    if ((getGeoNodeChildren(slug) ?? []).length === 0) {
      addLocationSelection(slug);
    }
  }

  function toggleWorkModality(value: WorkModality) {
    onChange({
      work_modality_allow: workModalityAllow.includes(value)
        ? workModalityAllow.filter((modality) => modality !== value)
        : [...workModalityAllow, value],
    });
  }

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

      <SubSection label="Work setup">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              value: "remote" as WorkModality,
              label: "Remote",
              description: "Include jobs with no office commute.",
              icon: Wifi,
            },
            {
              value: "hybrid" as WorkModality,
              label: "Hybrid",
              description: "Include roles that mix office and remote work.",
              icon: MapPin,
            },
            {
              value: "onsite" as WorkModality,
              label: "Onsite",
              description: "Include office-first roles in your selected places.",
              icon: CheckCircle2,
            },
          ].map(({ value, label, description, icon: Icon }) => {
            const selected = workModalityAllow.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleWorkModality(value)}
                className={cn(
                  "rounded-xl border p-4 text-left transition-all duration-150 shadow-soft-card",
                  selected
                    ? "border-accent bg-accent-wash"
                    : "border-rim bg-white hover:border-accent/30 hover:bg-surface"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 flex h-8 w-8 items-center justify-center rounded-full",
                      selected ? "bg-accent text-white" : "bg-surface text-dim"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-ink">{label}</p>
                    <p className="text-xs leading-5 text-dim">{description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onChange({ open_to_relocate: true })}
            className={cn(
              "rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors duration-150",
              openToRelocate
                ? "border-accent bg-accent-wash text-accent"
                : "border-rim bg-white text-dim hover:border-accent/30 hover:text-ink"
            )}
          >
            Open to relocate
          </button>
          <button
            type="button"
            onClick={() => onChange({ open_to_relocate: false })}
            className={cn(
              "rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors duration-150",
              !openToRelocate
                ? "border-accent bg-accent-wash text-accent"
                : "border-rim bg-white text-dim hover:border-accent/30 hover:text-ink"
            )}
          >
            Prefer selected locations only
          </button>
        </div>
      </SubSection>

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

      <SubSection label="Where">
        <div className="space-y-4">
          {normalizedLocations.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {normalizedLocations.map((slug) => (
                <span
                  key={slug}
                  className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-sm font-medium text-white shadow-warm"
                >
                  <MapPin className="w-3 h-3 opacity-70" />
                  {getGeoPathLabel(slug)}
                  <button
                    onClick={() => removeLocation(slug)}
                    aria-label={`Remove ${getGeoLeafLabel(slug)}`}
                    className="ml-0.5 hover:opacity-70 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="rounded-2xl border border-rim bg-white p-4 shadow-soft-card">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-ink">
                  Build location preferences by area
                </p>
                <p className="text-xs leading-5 text-dim">
                  Start broad, then drill down. Save a continent, country, state, or city node.
                </p>
              </div>
              {activeGeoSlug && (
                <button
                  type="button"
                  onClick={() => setActiveGeoSlug(null)}
                  className="text-xs font-medium text-dim transition-colors hover:text-ink"
                >
                  Reset
                </button>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(activeGeoPath.length > 0 ? activeGeoPath : getGeoRootNodes()).map((node, index) => {
                const isBreadcrumb = activeGeoPath.length > 0;
                return (
                  <button
                    key={node.slug}
                    type="button"
                    onClick={() => setActiveGeoSlug(node.slug)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-colors",
                      isBreadcrumb && index === activeGeoPath.length - 1
                        ? "border-accent bg-accent-wash text-accent"
                        : "border-rim bg-surface text-dim hover:border-accent/30 hover:text-ink"
                    )}
                  >
                    {node.label}
                    {isBreadcrumb && index < activeGeoPath.length - 1 && (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </button>
                );
              })}
            </div>

            {activeGeoNode && (
              <div className="mt-4 rounded-xl border border-accent/15 bg-accent-wash/60 p-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {getGeoPathLabel(activeGeoNode.slug)}
                    </p>
                    <p className="text-xs text-dim">
                      Save this node now or keep narrowing below.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addLocationSelection(activeGeoNode.slug)}
                    className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    Add this area
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-dim">
                {activeGeoNode ? `Narrow within ${activeGeoNode.label}` : "Start with a region"}
              </p>
              <div className="flex flex-wrap gap-2">
                {activeGeoChildren.length > 0
                  ? activeGeoChildren.map((node) => (
                      <Badge
                        key={node.slug}
                        size="md"
                        selected={normalizedLocations.includes(node.slug)}
                        onClick={() => chooseGeoNode(node.slug)}
                      >
                        {node.label}
                      </Badge>
                    ))
                  : !activeGeoNode
                    ? getGeoRootNodes().map((node) => (
                        <Badge
                          key={node.slug}
                          size="md"
                          selected={normalizedLocations.includes(node.slug)}
                          onClick={() => chooseGeoNode(node.slug)}
                        >
                          {node.label}
                        </Badge>
                      ))
                    : (
                      <p className="text-sm text-dim">
                        No narrower nodes under this selection.
                      </p>
                    )}
              </div>
            </div>
          </div>

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
