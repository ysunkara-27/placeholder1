"use client";

import { Badge } from "@/components/ui/badge";
import { INDUSTRY_OPTIONS } from "@/lib/utils";
import type { Industry } from "@/lib/types";

interface Props {
  selected: Industry[];
  onChange: (industries: Industry[]) => void;
}

export function StepIndustries({ selected, onChange }: Props) {
  function toggle(value: Industry) {
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
          What industries are you targeting?
        </h1>
        <p className="text-gray-500">
          Select all that apply — we&apos;ll match jobs from these fields.
        </p>
      </div>

      <div className="flex flex-wrap gap-2.5">
        {INDUSTRY_OPTIONS.map(({ value, label }) => (
          <Badge
            key={value}
            selected={selected.includes(value as Industry)}
            onClick={() => toggle(value as Industry)}
            size="md"
          >
            {label}
          </Badge>
        ))}
      </div>

      {selected.length > 0 && (
        <p className="text-sm text-gray-400 animate-fade-in">
          {selected.length} selected
        </p>
      )}
    </div>
  );
}
