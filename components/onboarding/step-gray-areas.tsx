"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { GrayAreaSuggestion, Industry, JobLevel } from "@/lib/types";
import { DollarSign, Globe, Building2, XCircle, Pencil, Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Props {
  industries: Industry[];
  levels: JobLevel[];
  locations: string[];
  value: Partial<GrayAreaSuggestion> | null;
  onChange: (value: GrayAreaSuggestion) => void;
}

interface EditState {
  salary_min: string;
  salary_max: string;
  sponsorship_required: boolean;
  min_company_size: string;
  excluded_companies: string;
  excluded_industries: string;
}

export function StepGrayAreas({
  industries,
  levels,
  locations,
  value,
  onChange,
}: Props) {
  const [suggestion, setSuggestion] = useState<GrayAreaSuggestion | null>(
    value as GrayAreaSuggestion | null
  );
  const [loading, setLoading] = useState(!value);
  const [error, setError] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);

  useEffect(() => {
    if (value) {
      setSuggestion(value as GrayAreaSuggestion);
      return;
    }
    fetchSuggestions();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchSuggestions() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/gray-areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industries, levels, locations }),
      });
      if (!res.ok) throw new Error("Failed to get suggestions");
      const data: GrayAreaSuggestion = await res.json();
      setSuggestion(data);
      onChange(data);
    } catch {
      setError("Couldn't load suggestions. Using defaults.");
      const fallback: GrayAreaSuggestion = {
        salary_min: levels.includes("internship") ? 25 : 80000,
        salary_max: levels.includes("internship") ? 50 : 120000,
        salary_unit: levels.includes("internship") ? "hourly" : "annual",
        sponsorship_required: false,
        min_company_size: null,
        excluded_companies: [],
        excluded_industries: [],
        rationale: {
          salary: "Market average for your field and level",
          sponsorship: "Most students don't need sponsorship",
          company_size: "No minimum — all company sizes",
        },
      };
      setSuggestion(fallback);
      onChange(fallback);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(field: string) {
    if (!suggestion) return;
    setEditingField(field);
    setEditState({
      salary_min: String(suggestion.salary_min),
      salary_max: String(suggestion.salary_max),
      sponsorship_required: suggestion.sponsorship_required,
      min_company_size: suggestion.min_company_size != null ? String(suggestion.min_company_size) : "",
      excluded_companies: suggestion.excluded_companies.join(", "),
      excluded_industries: suggestion.excluded_industries.join(", "),
    });
  }

  function commitEdit() {
    if (!suggestion || !editState) return;
    const updated: GrayAreaSuggestion = {
      ...suggestion,
      salary_min: Number(editState.salary_min) || suggestion.salary_min,
      salary_max: Number(editState.salary_max) || suggestion.salary_max,
      sponsorship_required: editState.sponsorship_required,
      min_company_size: editState.min_company_size
        ? Number(editState.min_company_size)
        : null,
      excluded_companies: editState.excluded_companies
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      excluded_industries: editState.excluded_industries
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    setSuggestion(updated);
    onChange(updated);
    setEditingField(null);
    setEditState(null);
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
            A few quick questions...
          </h1>
          <p className="text-gray-500">
            We&apos;re generating smart defaults based on your selections.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-12 gap-4 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm">Claude is personalizing your preferences...</p>
        </div>
      </div>
    );
  }

  if (!suggestion) return null;

  const { salary_min, salary_max, salary_unit, sponsorship_required, min_company_size, excluded_companies, excluded_industries, rationale } = suggestion;
  const unit = salary_unit === "hourly" ? "/hr" : "K/yr";
  const salaryDisplay =
    salary_unit === "hourly"
      ? `$${salary_min}–$${salary_max}/hr`
      : `$${Math.round(salary_min / 1000)}K–$${Math.round(salary_max / 1000)}K/yr`;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Review your preferences
        </h1>
        <p className="text-gray-500">
          We pre-filled these based on your profile. Edit anything that&apos;s off.
        </p>
      </div>

      {error && (
        <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {/* Salary */}
        <GrayAreaCard
          icon={DollarSign}
          label="Expected Pay"
          isEditing={editingField === "salary"}
          onEdit={() => startEdit("salary")}
          onSave={commitEdit}
          rationale={rationale.salary}
          display={salaryDisplay}
        >
          {editState && editingField === "salary" && (
            <div className="flex gap-3 items-end">
              <Input
                label="Min"
                type="number"
                value={editState.salary_min}
                onChange={(e) =>
                  setEditState((s) => s && { ...s, salary_min: e.target.value })
                }
              />
              <Input
                label="Max"
                type="number"
                value={editState.salary_max}
                onChange={(e) =>
                  setEditState((s) => s && { ...s, salary_max: e.target.value })
                }
              />
              <span className="text-sm text-gray-500 pb-2.5 shrink-0">{unit}</span>
            </div>
          )}
        </GrayAreaCard>

        {/* Visa */}
        <GrayAreaCard
          icon={Globe}
          label="Visa Sponsorship"
          isEditing={editingField === "sponsorship"}
          onEdit={() => startEdit("sponsorship")}
          onSave={commitEdit}
          rationale={rationale.sponsorship}
          display={sponsorship_required ? "Required" : "Not required"}
        >
          {editState && editingField === "sponsorship" && (
            <div className="flex gap-3">
              {([true, false] as const).map((val) => (
                <button
                  key={String(val)}
                  onClick={() =>
                    setEditState(
                      (s) => s && { ...s, sponsorship_required: val }
                    )
                  }
                  className={cn(
                    "flex-1 rounded-lg border py-2 text-sm font-medium transition-colors",
                    editState.sponsorship_required === val
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  )}
                >
                  {val ? "Required" : "Not required"}
                </button>
              ))}
            </div>
          )}
        </GrayAreaCard>

        {/* Company size */}
        <GrayAreaCard
          icon={Building2}
          label="Minimum Company Size"
          isEditing={editingField === "company_size"}
          onEdit={() => startEdit("company_size")}
          onSave={commitEdit}
          rationale={rationale.company_size}
          display={
            min_company_size ? `${min_company_size}+ employees` : "No minimum"
          }
        >
          {editState && editingField === "company_size" && (
            <Input
              label="Min employees (leave blank for none)"
              type="number"
              placeholder="e.g. 50"
              value={editState.min_company_size}
              onChange={(e) =>
                setEditState(
                  (s) => s && { ...s, min_company_size: e.target.value }
                )
              }
            />
          )}
        </GrayAreaCard>

        {/* Exclusions */}
        <GrayAreaCard
          icon={XCircle}
          label="Exclude Companies / Industries"
          isEditing={editingField === "exclusions"}
          onEdit={() => startEdit("exclusions")}
          onSave={commitEdit}
          rationale="Companies or industries you never want to see in alerts."
          display={
            excluded_companies.length === 0 && excluded_industries.length === 0
              ? "None"
              : [
                  ...excluded_companies,
                  ...excluded_industries,
                ]
                  .slice(0, 3)
                  .join(", ") + (excluded_companies.length + excluded_industries.length > 3 ? "..." : "")
          }
        >
          {editState && editingField === "exclusions" && (
            <div className="space-y-3">
              <Input
                label="Exclude companies"
                placeholder="e.g. Uber, Lyft"
                value={editState.excluded_companies}
                onChange={(e) =>
                  setEditState(
                    (s) => s && { ...s, excluded_companies: e.target.value }
                  )
                }
                hint="Comma-separated"
              />
              <Input
                label="Exclude industries"
                placeholder="e.g. Defense, Gambling"
                value={editState.excluded_industries}
                onChange={(e) =>
                  setEditState(
                    (s) => s && { ...s, excluded_industries: e.target.value }
                  )
                }
                hint="Comma-separated"
              />
            </div>
          )}
        </GrayAreaCard>
      </div>
    </div>
  );
}

// ─── Gray Area Card ───────────────────────────────────────────────────────────

interface CardProps {
  icon: React.ElementType;
  label: string;
  display: string;
  rationale: string;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  children?: React.ReactNode;
}

function GrayAreaCard({
  icon: Icon,
  label,
  display,
  rationale,
  isEditing,
  onEdit,
  onSave,
  children,
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-4 transition-all duration-200",
        isEditing ? "border-indigo-300 shadow-sm" : "border-gray-200"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              {label}
            </p>
            <button
              onClick={isEditing ? onSave : onEdit}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                isEditing
                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              )}
            >
              {isEditing ? (
                <>
                  <Check className="w-3 h-3" /> Save
                </>
              ) : (
                <>
                  <Pencil className="w-3 h-3" /> Edit
                </>
              )}
            </button>
          </div>

          {!isEditing ? (
            <div className="mt-1">
              <p className="font-semibold text-gray-900">{display}</p>
              <p className="text-sm text-gray-400 mt-0.5">{rationale}</p>
            </div>
          ) : (
            <div className="mt-3">{children}</div>
          )}
        </div>
      </div>
    </div>
  );
}
