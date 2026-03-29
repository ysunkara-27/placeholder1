"use client";

import { cn } from "@/lib/utils";
import { LEVEL_OPTIONS } from "@/lib/utils";
import type { JobLevel } from "@/lib/types";
import { CheckCircle2 } from "lucide-react";

interface Props {
  selected: JobLevel[];
  onChange: (levels: JobLevel[]) => void;
}

export function StepLevel({ selected, onChange }: Props) {
  function toggle(value: JobLevel) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          What type of roles?
        </h1>
        <p className="text-gray-500">
          Pick the types you want to be matched against.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {LEVEL_OPTIONS.map(({ value, label, description }) => {
          const isSelected = selected.includes(value as JobLevel);
          return (
            <button
              key={value}
              onClick={() => toggle(value as JobLevel)}
              className={cn(
                "relative flex items-start gap-4 rounded-xl border p-4 text-left transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1",
                isSelected
                  ? "border-indigo-600 bg-indigo-50"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
              )}
            >
              <div
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                  isSelected
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-gray-300 bg-white"
                )}
              >
                {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
              </div>
              <div>
                <p className="font-medium text-gray-900">{label}</p>
                <p className="text-sm text-gray-500 mt-0.5">{description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
