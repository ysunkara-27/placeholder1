"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label?: string;
  placeholder?: string;
  value: string;
  options: string[] | { label: string; value: string }[];
  onChange: (value: string) => void;
  hint?: string;
  required?: boolean;
  allowFreeText?: boolean;
}

function normalizeOptions(options: string[] | { label: string; value: string }[]): { label: string; value: string }[] {
  return options.map((o) =>
    typeof o === "string" ? { label: o, value: o } : o
  );
}

export function SearchableSelect({
  label,
  placeholder = "Select...",
  value,
  options,
  onChange,
  hint,
  required,
  allowFreeText,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const normalized = normalizeOptions(options);

  const filtered = query.trim()
    ? normalized.filter((o) =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        o.value.toLowerCase().includes(query.toLowerCase())
      )
    : normalized;

  const displayLabel = normalized.find((o) => o.value === value)?.label ?? value;

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function select(val: string) {
    onChange(val);
    setOpen(false);
    setQuery("");
  }

  const showFreeText = allowFreeText && query.trim() && filtered.length === 0;

  return (
    <div className="flex flex-col gap-1.5 w-full" ref={containerRef}>
      {label && (
        <label className="text-sm font-medium text-gray-700">{label}</label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-left flex items-center justify-between transition-colors duration-150",
            "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent",
            value ? "text-gray-900" : "text-gray-400"
          )}
        >
          <span className="truncate">{value ? displayLabel : placeholder}</span>
          <ChevronDown className={cn("w-4 h-4 text-gray-400 shrink-0 transition-transform duration-150", open && "rotate-180")} />
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
            <div className="border-b border-gray-100">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="w-full px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none bg-white"
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {showFreeText && (
                <div
                  className="flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                  onMouseDown={() => select(query.trim())}
                >
                  <span>Use: <span className="font-medium">{query.trim()}</span></span>
                </div>
              )}
              {filtered.map((opt) => (
                <div
                  key={opt.value}
                  className="flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                  onMouseDown={() => select(opt.value)}
                >
                  <span>{opt.label}</span>
                  {value === opt.value && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                </div>
              ))}
              {!showFreeText && filtered.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-400">No results</div>
              )}
            </div>
          </div>
        )}
      </div>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}
