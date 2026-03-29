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
        "inline-flex items-center gap-1.5 rounded-full font-medium border transition-all duration-150",
        sizes[size],
        isInteractive && "cursor-pointer select-none",
        selected
          ? "bg-indigo-600 border-indigo-600 text-white"
          : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50",
        className
      )}
    >
      {children}
    </span>
  );
}
