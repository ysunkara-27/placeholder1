"use client";

import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      children,
      ...props
    },
    ref
    ) => {
    const base =
      "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(187,74,43)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none";

    const variants = {
      primary:
        "bg-[rgb(187,74,43)] text-white hover:-translate-y-0.5 hover:bg-[rgb(169,63,34)] active:bg-[rgb(144,48,28)] shadow-warm",
      secondary:
        "border border-[rgb(227,205,188)] bg-[rgba(255,250,245,0.92)] text-[rgb(82,57,43)] hover:bg-[rgb(250,233,221)] active:bg-[rgb(244,232,221)] shadow-soft-card",
      ghost:
        "text-[rgb(125,99,82)] hover:text-[rgb(41,28,22)] hover:bg-[rgba(250,233,221,0.72)] active:bg-[rgba(244,232,221,0.92)]",
      danger:
        "bg-[rgb(144,48,28)] text-white hover:bg-[rgb(126,40,23)] active:bg-[rgb(108,34,18)] shadow-warm",
    };

    const sizes = {
      sm: "h-8 px-3 text-sm",
      md: "h-10 px-4 text-sm",
      lg: "h-12 px-6 text-base",
    };

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <span className="flex gap-[3px] items-center">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1 h-1 rounded-full bg-current animate-pulse-dot"
                style={{ animationDelay: `${i * 0.16}s` }}
              />
            ))}
          </span>
        )}
        {!loading && children}
      </button>
    );
  }
);

Button.displayName = "Button";
export { Button };
