"use client";

import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  size?: "sm" | "md";
}

export function Badge({
  children,
  selected = false,
  onClick,
  className,
  size = "md",
}: BadgeProps) {
  const isInteractive = !!onClick;

  const sizes = {
    sm: "px-2.5 py-1 text-xs",
    md: "px-3.5 py-2 text-sm",
  };

  return (
    <span
      role={isInteractive ? "checkbox" : undefined}
      aria-checked={isInteractive ? selected : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium border transition-all duration-150 shadow-soft-card",
        sizes[size],
        isInteractive && "cursor-pointer select-none",
        selected
          ? "bg-accent border-accent text-white"
          : "bg-white border-rim text-dim hover:border-accent/40 hover:bg-accent-wash hover:text-ink",
        className
      )}
    >
      {children}
    </span>
  );
}
