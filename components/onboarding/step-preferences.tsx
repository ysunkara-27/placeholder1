"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { INDUSTRY_OPTIONS, LEVEL_OPTIONS, POPULAR_CITIES, cn } from "@/lib/utils";
import type {
  Industry,
  JobLevel,
  GrayAreaSuggestion,
} from "@/lib/types";
import {
  CheckCircle2,
  MapPin,
  Wifi,
  X,
  DollarSign,
  Globe,
  Building2,
  XCircle,
  Pencil,
  Check,
  Loader2,
} from "lucide-react";

interface Props {
  industries: Industry[];
  levels: JobLevel[];
  locations: string[];
  remoteOk: boolean;
  grayAreas: GrayAreaSuggestion | null;
  onChange: (patch: Partial<{
    industries: Industry[];
    levels: JobLevel[];
    locations: string[];
    remote_ok: boolean;
    gray_areas: GrayAreaSuggestion;
  }>) => void;
}

export function StepPreferences({
  industries, levels, locations, remoteOk, grayAreas, onChange,
}: Props) {
  const [cityInput, setCityInput] = useState("");
  const [grayLoading, setGrayLoading] = useState(false);
  const [grayError, setGrayError] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editState, setEditState] = useState<Record<string, string | boolean>>({});
  const abortRef = useRef<AbortController | null>(null);

  // Auto-fetch gray areas once all 3 prereqs are met, debounced
  useEffect(() => {
    if (industries.length === 0 || levels.length === 0 || (locations.length === 0 && !remoteOk)) {
      return;
    }
    const timeout = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setGrayLoading(true);
      setGrayError(null);
      try {
        const res = await fetch("/api/onboarding/gray-areas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ industries, levels, locations }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed");
        const data: GrayAreaSuggestion = await res.json();
        onChange({ gray_areas: data });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setGrayError("Couldn't load smart defaults.");
        const fallback: GrayAreaSuggestion = {
          salary_min: levels.includes("internship") ? 25 : 80000,
          salary_max: levels.includes("internship") ? 50 : 130000,
          salary_unit: levels.includes("internship") ? "hourly" : "annual",
          sponsorship_required: false,
          min_company_size: null,
          excluded_companies: [],
          excluded_industries: [],
          rationale: {
            salary: "Market average for your field and level",
            sponsorship: "Most students don't need sponsorship",
            company_size: "No minimum size requirement",
          },
        };
        onChange({ gray_areas: fallback });
      } finally {
        setGrayLoading(false);
      }
    }, 600);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [industries.join(), levels.join(), locations.join(), remoteOk]);

  // ── Location helpers ──────────────────────────────────────────────────────
  function addLocation(city: string) {
    const t = city.trim();
    if (!t || locations.includes(t)) return;
    onChange({ locations: [...locations, t] });
    setCityInput("");
  }
  function removeLocation(city: string) {
    onChange({ locations: locations.filter((l) => l !== city) });
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

  // ── Gray area edit helpers ────────────────────────────────────────────────
  function startEdit(field: string) {
    if (!grayAreas) return;
    setEditingField(field);
    setEditState({
      salary_min: String(grayAreas.salary_min),
      salary_max: String(grayAreas.salary_max),
      sponsorship_required: grayAreas.sponsorship_required,
      min_company_size: grayAreas.min_company_size != null ? String(grayAreas.min_company_size) : "",
      excluded_companies: grayAreas.excluded_companies.join(", "),
      excluded_industries: grayAreas.excluded_industries.join(", "),
    });
  }

  function commitEdit() {
    if (!grayAreas) return;
    const updated: GrayAreaSuggestion = {
      ...grayAreas,
      salary_min: Number(editState.salary_min) || grayAreas.salary_min,
      salary_max: Number(editState.salary_max) || grayAreas.salary_max,
      sponsorship_required: editState.sponsorship_required as boolean,
      min_company_size: editState.min_company_size ? Number(editState.min_company_size) : null,
      excluded_companies: (editState.excluded_companies as string).split(",").map((s) => s.trim()).filter(Boolean),
      excluded_industries: (editState.excluded_industries as string).split(",").map((s) => s.trim()).filter(Boolean),
    };
    onChange({ gray_areas: updated });
    setEditingField(null);
  }

  const needsGrayAreas = industries.length > 0 && levels.length > 0 && (locations.length > 0 || remoteOk);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          What are you looking for?
        </h1>
        <p className="text-gray-500">
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
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1",
                  isSelected
                    ? "border-indigo-600 bg-indigo-50"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                )}
              >
                <div className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                  isSelected ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-300 bg-white"
                )}>
                  {isSelected && <CheckCircle2 className="w-3 h-3" />}
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </SubSection>

      {/* Locations */}
      <SubSection label="Where">
        <div className="space-y-3">
          <div className="min-h-[44px] flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-white p-2 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
            {locations.map((city) => (
              <span key={city} className="inline-flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-200 px-2 py-1 text-sm font-medium text-indigo-700">
                <MapPin className="w-3 h-3 opacity-60" />
                {city}
                <button onClick={() => removeLocation(city)} aria-label={`Remove ${city}`} className="ml-0.5 hover:text-indigo-900 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <input
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addLocation(cityInput); }
                if (e.key === "Backspace" && cityInput === "" && locations.length > 0) removeLocation(locations[locations.length - 1]);
              }}
              onBlur={() => addLocation(cityInput)}
              placeholder={locations.length === 0 ? "Type a city..." : ""}
              className="flex-1 min-w-[100px] bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {POPULAR_CITIES.filter((c) => !locations.includes(c)).slice(0, 6).map((city) => (
              <Badge key={city} size="sm" onClick={() => addLocation(city)}>+ {city}</Badge>
            ))}
          </div>
          <button
            onClick={() => onChange({ remote_ok: !remoteOk })}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-3 w-full text-left transition-all duration-150",
              remoteOk ? "border-indigo-600 bg-indigo-50" : "border-gray-200 bg-white hover:border-gray-300"
            )}
          >
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg transition-colors", remoteOk ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-400")}>
              <Wifi className="w-4 h-4" />
            </div>
            <div>
              <p className="font-medium text-sm text-gray-900">Open to remote</p>
              <p className="text-xs text-gray-500">Include fully remote positions</p>
            </div>
            <div className={cn("ml-auto h-5 w-9 rounded-full transition-colors duration-200 relative shrink-0", remoteOk ? "bg-indigo-600" : "bg-gray-200")}>
              <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200", remoteOk ? "left-[18px]" : "left-0.5")} />
            </div>
          </button>
        </div>
      </SubSection>

      {/* Smart defaults (gray areas) */}
      {needsGrayAreas && (
        <SubSection label="Smart defaults">
          {grayLoading ? (
            <div className="flex items-center gap-3 py-4 text-gray-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              Calculating smart defaults for your profile...
            </div>
          ) : grayAreas ? (
            <div className="space-y-2">
              {grayError && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">{grayError}</p>
              )}
              <CompactGrayCard
                icon={DollarSign}
                label="Expected pay"
                display={
                  grayAreas.salary_unit === "hourly"
                    ? `$${grayAreas.salary_min}–$${grayAreas.salary_max}/hr`
                    : `$${Math.round(grayAreas.salary_min / 1000)}K–$${Math.round(grayAreas.salary_max / 1000)}K/yr`
                }
                isEditing={editingField === "salary"}
                onEdit={() => startEdit("salary")}
                onSave={commitEdit}
              >
                {editingField === "salary" && (
                  <div className="flex gap-2 items-end">
                    <Input label="Min" type="number" value={String(editState.salary_min)} onChange={(e) => setEditState((s) => ({ ...s, salary_min: e.target.value }))} />
                    <Input label="Max" type="number" value={String(editState.salary_max)} onChange={(e) => setEditState((s) => ({ ...s, salary_max: e.target.value }))} />
                    <span className="text-sm text-gray-400 pb-2.5 shrink-0">{grayAreas.salary_unit === "hourly" ? "/hr" : "K/yr"}</span>
                  </div>
                )}
              </CompactGrayCard>

              <CompactGrayCard
                icon={Globe}
                label="Visa sponsorship"
                display={grayAreas.sponsorship_required ? "Required" : "Not required"}
                isEditing={editingField === "sponsorship"}
                onEdit={() => startEdit("sponsorship")}
                onSave={commitEdit}
              >
                {editingField === "sponsorship" && (
                  <div className="flex gap-2">
                    {([true, false] as const).map((val) => (
                      <button key={String(val)} onClick={() => setEditState((s) => ({ ...s, sponsorship_required: val }))}
                        className={cn("flex-1 rounded-lg border py-2 text-sm font-medium transition-colors",
                          editState.sponsorship_required === val ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600 hover:border-gray-300")}>
                        {val ? "Required" : "Not required"}
                      </button>
                    ))}
                  </div>
                )}
              </CompactGrayCard>

              <CompactGrayCard
                icon={Building2}
                label="Min company size"
                display={grayAreas.min_company_size ? `${grayAreas.min_company_size}+ employees` : "No minimum"}
                isEditing={editingField === "company_size"}
                onEdit={() => startEdit("company_size")}
                onSave={commitEdit}
              >
                {editingField === "company_size" && (
                  <Input label="Min employees (blank = no min)" type="number" placeholder="e.g. 50"
                    value={String(editState.min_company_size ?? "")}
                    onChange={(e) => setEditState((s) => ({ ...s, min_company_size: e.target.value }))} />
                )}
              </CompactGrayCard>

              <CompactGrayCard
                icon={XCircle}
                label="Exclusions"
                display={
                  [...(grayAreas.excluded_companies ?? []), ...(grayAreas.excluded_industries ?? [])].length === 0
                    ? "None"
                    : [...(grayAreas.excluded_companies ?? []), ...(grayAreas.excluded_industries ?? [])].slice(0, 3).join(", ")
                }
                isEditing={editingField === "exclusions"}
                onEdit={() => startEdit("exclusions")}
                onSave={commitEdit}
              >
                {editingField === "exclusions" && (
                  <div className="space-y-2">
                    <Input label="Exclude companies" placeholder="e.g. Uber, Lyft" value={String(editState.excluded_companies)}
                      onChange={(e) => setEditState((s) => ({ ...s, excluded_companies: e.target.value }))} hint="Comma-separated" />
                    <Input label="Exclude industries" placeholder="e.g. Defense, Gambling" value={String(editState.excluded_industries)}
                      onChange={(e) => setEditState((s) => ({ ...s, excluded_industries: e.target.value }))} hint="Comma-separated" />
                  </div>
                )}
              </CompactGrayCard>
            </div>
          ) : null}
        </SubSection>
      )}
    </div>
  );
}

// ── Sub-section wrapper ───────────────────────────────────────────────────────

function SubSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 pt-6 border-t border-gray-100 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">{label}</h3>
      {children}
    </div>
  );
}

// ── Compact gray area card ────────────────────────────────────────────────────

function CompactGrayCard({
  icon: Icon, label, display, isEditing, onEdit, onSave, children,
}: {
  icon: React.ElementType;
  label: string;
  display: string;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border bg-white p-3 transition-all duration-200", isEditing ? "border-indigo-300 shadow-sm" : "border-gray-200")}>
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400">
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          {!isEditing ? (
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{label}</p>
                <p className="text-sm font-medium text-gray-900">{display}</p>
              </div>
              <button onClick={onEdit} className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 rounded-md px-2 py-1 hover:bg-gray-100 transition-colors">
                <Pencil className="w-3 h-3" /> Edit
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{label}</p>
                <button onClick={onSave} className="inline-flex items-center gap-1 text-xs bg-indigo-600 text-white rounded-md px-2.5 py-1 hover:bg-indigo-700 transition-colors">
                  <Check className="w-3 h-3" /> Save
                </button>
              </div>
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
