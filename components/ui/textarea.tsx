"use client";

import { cn } from "@/lib/utils";
import { type TextareaHTMLAttributes, forwardRef } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
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
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            "w-full rounded-xl border bg-[rgba(255,250,245,0.92)] px-3 py-2.5 text-sm text-[rgb(41,28,22)] placeholder:text-[rgb(149,118,98)] resize-none",
            "transition-colors duration-150",
            "focus:outline-none focus:ring-2 focus:ring-[rgb(187,74,43)] focus:border-transparent",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error ? "border-[rgb(144,48,28)] focus:ring-[rgb(144,48,28)]" : "border-[rgb(227,205,188)]",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-[rgb(144,48,28)]">{error}</p>}
        {hint && !error && <p className="text-xs text-[rgb(149,118,98)]">{hint}</p>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
export { Textarea };
