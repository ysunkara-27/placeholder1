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
            className="text-sm font-medium text-[rgb(82,57,43)]"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leading && (
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[rgb(149,118,98)]">
              {leading}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "h-10 w-full rounded-xl border bg-[rgba(255,250,245,0.92)] px-3 text-sm text-[rgb(41,28,22)] placeholder:text-[rgb(149,118,98)]",
              "transition-colors duration-150",
              "focus:outline-none focus:ring-2 focus:ring-[rgb(187,74,43)] focus:border-transparent",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              error ? "border-[rgb(144,48,28)] focus:ring-[rgb(144,48,28)]" : "border-[rgb(227,205,188)]",
              leading && "pl-9",
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-[rgb(144,48,28)]">{error}</p>}
        {hint && !error && <p className="text-xs text-[rgb(149,118,98)]">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
export { Input };
