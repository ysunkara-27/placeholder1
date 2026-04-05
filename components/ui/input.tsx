"use client";

import { cn } from "@/lib/utils";
import { type InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leading?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leading, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-ink"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leading && (
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-dim">
              {leading}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "h-11 w-full rounded-xl border bg-white px-3 text-sm text-ink placeholder:text-dim/60 shadow-soft-card",
              "transition-colors duration-150",
              "focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              error ? "border-red-400 focus:ring-red-200" : "border-rim",
              leading && "pl-9",
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        {hint && !error && <p className="text-xs text-dim">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
export { Input };
